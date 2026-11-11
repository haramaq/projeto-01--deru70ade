// distribuir_lead_automatico — Motor de distribuição DDI/DDD (Lote 2 da spec 29/10).
// Gatilho: CREATE de vendas SEM vendedor (vazio/ausente). Leads com vendedor atribuído
// manualmente NUNCA são reatribuídos (regra 7: nunca escolher arbitrariamente).
// Fluxo: DDI/DDD do telefone do cliente → vendedor_ddd ativos →
//   1 elegível  → atribui (vendedor = elegível) + registra decisão;
//   0 ou 2+     → revisão humana (registra motivo estruturado; fase mapa/IBGE não implementada).
// Idempotente: roda só no create; registro sem vendedor após a 1ª passada não reprocessa
// (o motor nunca roda em update; reexecução do create gera registro novo, sem estado global).
// RBAC/hooks preservados: usa e.app (sistema); não toca users; External ID Altforce intocado.
// Sem integração WhatsApp/Altforce (contratos não validados).
//
// Telefone: lido de clientes.telefone (formato livre). Parser: dígitos; DDI = prefixo
// internacional (55 = Brasil); DDD = 2 dígitos após o DDI nacional.
// Revisão humana: registrada em lead_historico (tipo 'observacao', motivo estruturado) e
// observacoes_ia do lead (prefixo [DISTRIBUICAO]) — fila formal depende de migration futura.
onRecordCreateRequest((e) => {
  try {
    if (e.hasSuperuserAuth()) return e.next()

    const info = e.requestInfo()
    const body = info && info.body ? info.body : {}
    const vendedorBody = Object.prototype.hasOwnProperty.call(body, 'vendedor') ? body.vendedor : ''
    if (vendedorBody) return e.next() // atribuição manual/explicita — motor não interfere

    const clienteId = e.record.get('cliente') || ''
    if (!clienteId) return e.next() // sem cliente não há telefone; regras exigem cliente

    // Telefone do cliente (do banco — body pode não trazer):
    let telefone = ''
    try {
      const cliente = e.app.findRecordById('clientes', clienteId)
      telefone = cliente.get('telefone') || ''
    } catch (errCli) {
      telefone = ''
    }
    const digitos = String(telefone).replace(/\D/g, '')

    // Parser DDI/DDD (Brasil: 10-11 dígitos sem DDI; 12-13 com DDI 55):
    let ddi = ''
    let ddd = ''
    if (digitos.length >= 12 && digitos.indexOf('55') === 0) {
      // DDI 55 explícito: 12-13 dígitos (55 + DDD + 8/9)
      ddi = '55'
      ddd = digitos.slice(2, 4)
    } else if (digitos.length >= 10 && digitos.length <= 11) {
      // sem DDI (padrão BR: DDD + 8/9 dígitos) → DDD = 2 primeiros
      ddi = '55'
      ddd = digitos.slice(0, 2)
    } else if (digitos.length >= 11) {
      // DDI explícito não-55 (ex.: 595...) — sem regra de país cadastrada → revisão
      ddi = digitos.slice(0, 2)
    }

    // Decisão: observacoes_ia é gravada COM o lead (mesmo update); o lead_historico é gravado
    // DEPOIS do e.next() (o lead precisa existir no banco p/ a relation lead_id — gravar antes
    // falha silenciosamente; provado em teste). Histórico é best-effort: a fonte da decisão
    // é a observacao_ia persistida no próprio lead.
    const decisao = { codigo: '', detalhe: '', atribuir: '', candidatos: null }
    const justificar = function (codigo, detalhe, atribuir, candidatosJson) {
      decisao.codigo = codigo
      decisao.detalhe = detalhe
      decisao.atribuir = atribuir || ''
      decisao.candidatos = candidatosJson || null
      try {
        const obs = e.record.get('observacoes_ia') || ''
        e.record.set(
          'observacoes_ia',
          (obs ? obs + ' | ' : '') + '[DISTRIBUICAO] ' + codigo + ' — ' + detalhe,
        )
      } catch (errObs) {
        /* best-effort */
      }
    }
    const registrarHistorico = function () {
      if (!decisao.codigo) return
      const texto = '[DISTRIBUICAO] ' + decisao.codigo + ' — ' + decisao.detalhe
      let ok = false
      let ultimoErro = ''
      // 1 tentativa + 1 retry: a relation lead_id exige o lead commitado; falha transitória
      // (lock/concorrência) é recuperável na 2ª. Se ambas falharem, marca na observacao
      // (rastreabilidade) — reconciliação periódica regrava (mesma rotina da transferência).
      for (let tentativa = 0; tentativa < 2 && !ok; tentativa++) {
        try {
          const hist = new Record(e.app.findCollectionByNameOrId('lead_historico'))
          hist.set('lead_id', e.record.id)
          hist.set('etapa_nova', e.record.get('etapa') || '')
          hist.set('responsavel', decisao.atribuir)
          hist.set('data_hora', new Date().toISOString())
          hist.set('tipo_evento', 'observacao')
          hist.set('usuario_origem', e.auth ? e.auth.id : '')
          hist.set('observacao', texto)
          e.app.save(hist)
          ok = true
        } catch (errHist) {
          ultimoErro = String(errHist).slice(0, 80)
        }
      }
      if (!ok) {
        try {
          const obs = e.record.get('observacoes_ia') || ''
          e.record.set('observacoes_ia', obs + ' | [DISTRIBUICAO-HISTORICO-FALHOU] ' + ultimoErro)
          e.app.save(e.record)
        } catch (errMark) {
          /* best-effort */
        }
      }
      // Fila de revisão humana: só casos de revisão (sem atribuição) e lead ainda sem vendedor.
      // Falha da fila é DETECTÁVEL: marca na observacao (reconciliação regrava depois):
      if (!decisao.atribuir && decisao.codigo !== 'atribuido-ddd') {
        let filaOk = false
        let erroFila = ''
        try {
          const fila = new Record(e.app.findCollectionByNameOrId('fila_revisao'))
          fila.set('lead_id', e.record.id)
          fila.set('motivo', decisao.codigo)
          fila.set('detalhe', decisao.detalhe)
          if (decisao.candidatos) fila.set('candidatos', decisao.candidatos)
          fila.set('status', 'pendente')
          e.app.save(fila)
          filaOk = true
        } catch (errFila) {
          erroFila = String(errFila).slice(0, 80)
        }
        if (!filaOk) {
          try {
            const obs2 = e.record.get('observacoes_ia') || ''
            e.record.set('observacoes_ia', obs2 + ' | [DISTRIBUICAO-FILA-FALHOU] ' + erroFila)
            e.app.save(e.record)
          } catch (errMark2) {
            /* best-effort */
          }
        }
      }
    }

    // Sem telefone / sem DDI reconhecível:
    if (!digitos || !ddi) {
      justificar(
        'sem-telefone-valido',
        'Telefone ausente ou não reconhecido: "' + telefone + '"',
        '',
      )
      const r3 = e.next()
      registrarHistorico()
      return r3
    }

    // DDI != 55: sem regra de país (ddi_paises sem cadastro de regras de vendedor) → revisão
    if (ddi !== '55') {
      justificar('ddi-sem-regra', 'DDI +' + ddi + ' sem regra de distribuição cadastrada.', '')
      const r4 = e.next()
      registrarHistorico()
      return r4
    }

    // DDI 55: DDD obrigatório com 2 dígitos:
    if (!ddd || ddd.length !== 2) {
      justificar('ddd-invalido', 'DDD não reconhecido no telefone: "' + telefone + '"', '')
      const r5 = e.next()
      registrarHistorico()
      return r5
    }

    // Candidatos: vendedor_ddd ativos (ddi=55, ddd=X) cujo usuário está ativo e é
    // vendedor/revendedor (elegibilidade; admin/gestor não recebem leads):
    // Runbook PB 0.36: filtro composto pode retornar vazio — filtrar SÓ pela chave (ddd)
    // e validar ativo/ddi em código:
    let candidatos = []
    try {
      candidatos = e.app.findRecordsByFilter('vendedor_ddd', "ddd = '" + ddd + "'", '', 50, 0)
    } catch (errVdd) {
      candidatos = []
    }
    const ddiNormalizado = function (v) {
      return String(v || '').replace(/[^0-9]/g, '')
    }

    const elegiveis = []
    for (let i = 0; i < candidatos.length; i++) {
      let u = null
      try {
        u = e.app.findRecordById('users', candidatos[i].get('usuario_id') || '')
      } catch (errU) {
        u = null
      }
      if (!u) continue
      if (ddiNormalizado(candidatos[i].get('ddi')) !== '55') continue
      const ativo = u.get('ativo')
      const role = u.get('role') || ''
      if (ativo === false || String(ativo) === 'false' || ativo === 0) continue
      if (role !== 'vendedor' && role !== 'revendedor') continue
      elegiveis.push(u.id)
    }

    // Dedup (mesmo vendedor com 2 vínculos no mesmo DDD):
    const unicos = []
    for (let i = 0; i < elegiveis.length; i++) {
      if (unicos.indexOf(elegiveis[i]) === -1) unicos.push(elegiveis[i])
    }

    // MODO DE OPERAÇÃO (controlado pelo servidor — coleção config_motor; default 'so_decide'):
    let modo = 'so_decide'
    try {
      const cfg = e.app.findFirstRecordByFilter('config_motor', 'id != ""')
      modo = cfg.get('modo') || 'so_decide'
    } catch (errCfg) {
      modo = 'so_decide'
    }

    if (unicos.length === 1) {
      const alvo = unicos[0]
      // Verificação de conflito territorial (decisão owner 11/11/2026):
      // quando há 1 vendedor único pelo DDD, verificar se a cidade/UF
      // informada pertence ao território desse vendedor.
      let cidadeCliente = ''
      let ufCliente = ''
      try {
        const cliente = e.app.findRecordById('clientes', clienteId)
        cidadeCliente = String(cliente.get('cidade') || '').trim()
        ufCliente = String(cliente.get('estado') || '')
          .trim()
          .toUpperCase()
      } catch (errCli) {
        cidadeCliente = ''
        ufCliente = ''
      }
      const normalizar = function (t) {
        return String(t || '')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .replace(/\s+/g, ' ')
          .trim()
      }
      const cidadeNorm = normalizar(cidadeCliente)
      if (cidadeNorm && ufCliente.length === 2) {
        // cidade/UF informadas — verificar cadastro territorial
        let cidades = []
        try {
          cidades = e.app.findRecordsByFilter(
            'cidades_atendidas',
            "cidade_normalizada = '" +
              cidadeNorm.replace(/'/g, "\\'") +
              "' && uf = '" +
              ufCliente +
              "' && ativo = true",
            '',
            5,
            0,
          )
        } catch (errCid) {
          cidades = []
        }
        if (cidades.length === 1) {
          // cidade cadastrada — verificar território do vendedor único
          const cidadeId = cidades[0].id
          let vinculos = []
          try {
            vinculos = e.app.findRecordsByFilter(
              'territorio_cidades',
              "cidade_id = '" + cidadeId + "'",
              '',
              50,
              0,
            )
          } catch (errTerr) {
            vinculos = []
          }
          const vendedoresTerritorio = []
          for (let t = 0; t < vinculos.length; t++) {
            let regiao = null
            try {
              regiao = e.app.findRecordById(
                'territorio_regioes',
                vinculos[t].get('regiao_id') || '',
              )
            } catch (errReg) {
              regiao = null
            }
            if (!regiao) continue
            const regAtiva = regiao.get('ativo')
            if (regAtiva === false || String(regAtiva) === 'false' || regAtiva === 0) continue
            const vid = regiao.get('vendedor_id') || ''
            if (vid && vendedoresTerritorio.indexOf(vid) === -1) vendedoresTerritorio.push(vid)
          }
          if (vendedoresTerritorio.length > 0 && vendedoresTerritorio.indexOf(alvo) === -1) {
            // CENÁRIO T1b: cidade informada e cadastrada, mas território INCOMPATÍVEL
            justificar(
              'conflito-ddd-cidade',
              'DDD ' +
                ddd +
                ' com vendedor único (' +
                alvo +
                '), mas cidade ' +
                cidadeCliente +
                '/' +
                ufCliente +
                ' pertence a território de: ' +
                vendedoresTerritorio.join(', ') +
                ' — revisão humana.',
              '',
              JSON.stringify(vendedoresTerritorio),
            )
            const rC = e.next()
            registrarHistorico()
            return rC
          }
          // CENÁRIO T1a: cidade cadastrada e território COMPATÍVEL (ou sem território ativo)
          // → prosseguir com atribuição/recomendação normal
        } else {
          // CENÁRIO T1c: cidade/UF informadas mas NÃO CADASTRADAS
          // → registrar na fila de revisão, SEM atribuir nem recomendar
          justificar(
            'cidade-nao-cadastrada-ddd',
            'DDD ' +
              ddd +
              ' com vendedor único (' +
              alvo +
              '); cidade ' +
              cidadeCliente +
              '/' +
              ufCliente +
              ' não consta no cadastro de cidades atendidas — revisão humana.',
            '',
            JSON.stringify([alvo]),
          )
          const rNC = e.next()
          registrarHistorico()
          return rNC
        }
      } else {
        // CENÁRIO T1d: cidade/UF AUSENTES
        // → prosseguir com atribuição/recomendação normal
        // → registrar que a localização não foi informada
        justificar(
          'sem-localizacao-informada',
          'DDD ' +
            ddd +
            ' com vendedor único (' +
            alvo +
            '); cidade/UF não informadas pelo cliente.',
          alvo,
        )
        // prosseguir com atribuição/recomendação normal
      }
      if (modo === 'automatico') {
        e.record.set('vendedor', alvo)
        justificar(
          'atribuido-ddd',
          'DDD ' + ddd + ' com único vendedor elegível; atribuído automaticamente.',
          alvo,
        )
        const r = e.next()
        registrarHistorico()
        return r
      }
      // modo so_decide: recomenda sem atribuir — item na fila p/ o admin aceitar:
      justificar(
        'recomendacao-ddd',
        'DDD ' +
          ddd +
          ' com único vendedor elegível; recomendado: ' +
          alvo +
          ' (modo só decide — não atribuído).',
        '',
        JSON.stringify([alvo]),
      )
      const r = e.next()
      registrarHistorico()
      return r
    }

    // 0 elegíveis → revisão:
    if (unicos.length === 0) {
      justificar('sem-vendedor-ddd', 'DDD ' + ddd + ' sem vendedor ativo elegível.', '')
      const r2 = e.next()
      registrarHistorico()
      return r2
    }

    // 2+ elegíveis → FASE TERRITORIAL (universo fechado: só os elegíveis do DDD).
    // Decisão owner 30/10: NÃO usar IBGE — cadastro interno de cidades/UF aprovadas
    // (cidades_atendidas + territorio_cidades). Cidade/UF informadas pelo cliente (texto
    // livre), normalizadas (regra 7) e resolvidas por correspondência EXATA (regra 8).
    let cidade = ''
    let uf = ''
    try {
      const cliente = e.app.findRecordById('clientes', clienteId)
      cidade = String(cliente.get('cidade') || '').trim()
      uf = String(cliente.get('estado') || '')
        .trim()
        .toUpperCase()
    } catch (errCli2) {
      cidade = ''
      uf = ''
    }
    const normalizar = function (t) {
      return String(t || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim()
    }
    const cidadeNorm = normalizar(cidade)

    if (!cidadeNorm || uf.length !== 2) {
      justificar(
        'dados-insuficientes',
        'Cidade/UF do cliente ausentes ou inválidos para resolução territorial.',
        '',
        JSON.stringify(unicos),
      )
      const r3 = e.next()
      registrarHistorico()
      return r3
    }

    // Cadastro interno: cidade_normalizada + uf → 1 única cidade aprovada (UNIQUE).
    // 0 resultados = cidade desconhecida (não aprovada); homônima no MESMO UF não existe
    // (UNIQUE impede); homônima em UF diferente é desambiguada pela UF.
    let cidades = []
    try {
      cidades = e.app.findRecordsByFilter(
        'cidades_atendidas',
        "cidade_normalizada = '" +
          cidadeNorm.replace(/'/g, "\\'") +
          "' && uf = '" +
          uf +
          "' && ativo = true",
        '',
        5,
        0,
      )
    } catch (errCid) {
      cidades = []
    }
    if (cidades.length !== 1) {
      justificar(
        'cidade-nao-atendida',
        'Cidade "' +
          cidade +
          '/' +
          uf +
          '" sem cadastro interno único de cidade atendida (' +
          cidades.length +
          ' resultados).',
        '',
        JSON.stringify(unicos),
      )
      const r4 = e.next()
      registrarHistorico()
      return r4
    }
    const cidadeId = cidades[0].id

    // Território: cidade aprovada → regiões ativas → vendedores (∩ elegíveis do DDD):
    let vinculos = []
    try {
      vinculos = e.app.findRecordsByFilter(
        'territorio_cidades',
        "cidade_id = '" + cidadeId + "'",
        '',
        50,
        0,
      )
    } catch (errTerr) {
      vinculos = []
    }

    const candidatosTerritorio = []
    for (let t = 0; t < vinculos.length; t++) {
      let regiao = null
      try {
        regiao = e.app.findRecordById('territorio_regioes', vinculos[t].get('regiao_id') || '')
      } catch (errReg) {
        regiao = null
      }
      if (!regiao) continue
      const regAtiva = regiao.get('ativo')
      if (regAtiva === false || String(regAtiva) === 'false' || regAtiva === 0) continue
      const vendedorRegiao = regiao.get('vendedor_id') || ''
      // universo fechado (ajuste 1 da spec): só quem já é elegível pelo DDD:
      if (
        unicos.indexOf(vendedorRegiao) !== -1 &&
        candidatosTerritorio.indexOf(vendedorRegiao) === -1
      ) {
        candidatosTerritorio.push(vendedorRegiao)
      }
    }

    if (candidatosTerritorio.length === 1) {
      const alvo = candidatosTerritorio[0]
      if (modo === 'automatico') {
        e.record.set('vendedor', alvo)
        justificar(
          'atribuido-territorio',
          'Cidade ' +
            cidade +
            '/' +
            uf +
            ' pertence a território único do elegível do DDD ' +
            ddd +
            '; atribuído automaticamente.',
          alvo,
        )
        const r5 = e.next()
        registrarHistorico()
        return r5
      }
      justificar(
        'recomendacao-territorio',
        'Cidade ' +
          cidade +
          '/' +
          uf +
          ' com território único; recomendado: ' +
          alvo +
          ' (modo só decide — não atribuído).',
        '',
        JSON.stringify([alvo]),
      )
      const r5 = e.next()
      registrarHistorico()
      return r5
    }

    if (candidatosTerritorio.length === 0) {
      justificar(
        'sem-cobertura-territorial',
        'Cidade ' +
          cidade +
          '/' +
          uf +
          ' sem território ativo entre os elegíveis do DDD ' +
          ddd +
          '.',
        '',
        JSON.stringify(unicos),
      )
    } else {
      justificar(
        'conflito-territorial',
        'Cidade ' +
          cidade +
          '/' +
          uf +
          ' pertence a ' +
          candidatosTerritorio.length +
          ' territórios entre os elegíveis do DDD ' +
          ddd +
          ' — revisão humana.',
        '',
        JSON.stringify(candidatosTerritorio),
      )
    }
    const r6 = e.next()
    registrarHistorico()
    return r6
  } catch (err) {
    // Falha do motor NUNCA bloqueia a criação do lead (degradação graciosa):
    return e.next()
  }
}, 'vendas')
