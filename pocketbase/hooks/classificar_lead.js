/// <reference path="../pb_data/types.d.ts" />
// T2.2-T4-B — Hook classificar_lead: classificação comercial determinística.
// Rota: POST /backend/v1/qualificacao/classificar
//
// T2.2-T4-C4 (04/11): separação por tipo de lead — origem_captura='sintetico'
// usa roteiro:qualificacao:qa; demais leads comerciais usam roteiro:qualificacao.
// A escolha é determinada pelo BACKEND (registro persistido do lead),
// nunca por um parâmetro enviado pelo cliente.
//
// Fluxo:
// 1. Autenticação e autorização (RBAC — triagem/vendedor/admin/gestor/suporte)
// 2. Validação de lead e sessão
// 3. Resolução do roteiro versionado (separado por tipo de lead)
// 4. Validação de respostas obrigatórias
// 5. Aplicação determinística das regras_classificacao
// 6. Tratamento de respostas incompletas → pendente
// 7. Tratamento de nao_sei → pendente (não fora_perfil)
// 8. Deduplicação DEC-08 (telefone normalizado)
// 9. Auditoria transacional (eventos_negocio)
//
// IMPORTANTE: este hook calcula a SUGESTÃO de classificação. A CONFIRMAÇÃO
// humana é obrigatória (constituição §3). A sugestão é registrada em
// eventos_negocio; a confirmação é feita via update em vendas.classificacao.

routerAdd('POST', '/backend/v1/qualificacao/classificar', (e) => {
  const resp = (status, obj) => e.json(status, obj)

  try {
    // ---------- 0) Autenticação e autorização ----------
    const auth = e.auth
    if (!auth) {
      return resp(401, { codigo: 'AUTENTICACAO_OBRIGATORIA' })
    }
    const role = String(auth.get('role') || '')
    const authId = String(auth.get('id') || '')
    const perfisAutorizados = ['admin', 'gestor', 'triagem', 'suporte', 'vendedor']
    if (perfisAutorizados.indexOf(role) === -1) {
      return resp(403, { codigo: 'PERFIL_NAO_AUTORIZADO', perfil: role })
    }

    const info = e.requestInfo()
    const body = info.body || {}
    const leadId = String(body.lead_id || '').trim()
    const sessaoId = String(body.sessao_id || '').trim()

    if (!leadId) return resp(400, { codigo: 'LEAD_OBRIGATORIO' })
    if (!sessaoId) return resp(400, { codigo: 'SESSAO_OBRIGATORIA' })

    // Bloquear simulador de classificar leads comerciais
    if (sessaoId.indexOf('sim_') === 0) {
      return resp(403, {
        codigo: 'SIMULADOR_BLOQUEADO',
        message: 'O simulador não pode classificar leads comerciais.',
      })
    }

    // ---------- 1) Validar lead ----------
    let lead = null
    try {
      lead = $app.findRecordById('vendas', leadId)
    } catch (err) {
      if (/no rows/i.test(String(err))) {
        return resp(400, { codigo: 'LEAD_INEXISTENTE' })
      }
      throw err
    }

    // ---------- 1b) Verificar acesso ao lead (isolamento por vendedor/carteira) ----------
    if (role !== 'admin' && role !== 'gestor' && role !== 'triagem' && role !== 'suporte') {
      const leadVendedor = String(lead.get('vendedor') || '')
      const leadCarteira = String(lead.get('carteira') || '')
      const authCarteira = String(auth.get('carteira') || '')
      if (leadVendedor !== authId && (authCarteira === '' || leadCarteira !== authCarteira)) {
        return resp(403, { codigo: 'SEM_ACESSO_LEAD' })
      }
    }

    // ---------- 2) Resolver roteiro vigente (separação por tipo de lead) ----------
    // - origem_captura='sintetico' → roteiro:qualificacao:qa (roteiro QA isolado)
    // - demais leads comerciais → roteiro:qualificacao (roteiro comercial)
    // A escolha é determinada pelo BACKEND (registro persistido do lead),
    // nunca por um parâmetro enviado pelo cliente.
    const leadOrigemCaptura = String(lead.get('origem_captura') || '')
    const regraChave =
      leadOrigemCaptura === 'sintetico' ? 'roteiro:qualificacao:qa' : 'roteiro:qualificacao'

    let roteiroVersao = null
    try {
      const versoes = $app.findRecordsByFilter(
        'regras_versao',
        "regra_chave = '" + regraChave + "' && vigente_ate = ''",
        '-versao',
        1,
        0,
      )
      if (versoes && versoes.length) roteiroVersao = versoes[0]
    } catch (_) {
      roteiroVersao = null
    }

    if (!roteiroVersao) {
      return resp(404, { codigo: 'SEM_ROTEIRO_VIGENTE', regra_chave: regraChave })
    }

    const roteiroVersaoId = roteiroVersao.id
    const conteudoRaw = roteiroVersao.get('conteudo')
    let roteiro = null
    try {
      roteiro = JSON.parse(String(conteudoRaw))
    } catch (_) {
      roteiro = null
    }

    if (!roteiro || !roteiro.perguntas || !roteiro.regras_classificacao) {
      return resp(500, { codigo: 'ROTEIRO_INVALIDO' })
    }

    // ---------- 3) Buscar respostas da sessão ----------
    const respostas = $app.findRecordsByFilter(
      'qualificacao_respostas',
      'lead_id = {:l} && sessao_id = {:s}',
      '',
      200,
      0,
      { l: leadId, s: sessaoId },
    )

    const respostasMap = {}
    for (let i = 0; i < respostas.length; i++) {
      const r = respostas[i]
      const pid = String(r.get('pergunta_id') || '')
      const respVal = String(r.get('resposta') || '')
      respostasMap[pid] = respVal
    }

    // ---------- 4) Verificar respostas obrigatórias ----------
    const perguntas = roteiro.perguntas
    const ausentes = []
    for (let i = 0; i < perguntas.length; i++) {
      const p = perguntas[i]
      if (p.obrigatoria && !respostasMap[p.id]) {
        ausentes.push(p.id)
      }
    }

    if (ausentes.length > 0) {
      lead.set('classificacao', 'pendente')
      lead.set('roteiro_versao', roteiroVersaoId)
      $app.save(lead)

      const ev = new Record($app.findCollectionByNameOrId('eventos_negocio'))
      ev.set('event_id', $security.randomString(24))
      ev.set('correlation_id', sessaoId)
      ev.set('tipo', 'qualificacao_classificada')
      ev.set('agregado', 'vendas')
      ev.set('agregado_id', leadId)
      ev.set('origem', 'sistema')
      ev.set('payload', {
        classificacao: 'pendente',
        motivo: 'respostas_incompletas',
        ausentes: ausentes,
        roteiro_versao_id: roteiroVersaoId,
      })
      ev.set('ocorrido_em', new Date().toISOString())
      let seq = 1
      try {
        const ult = $app.findRecordsByFilter(
          'eventos_negocio',
          'correlation_id = {:c}',
          '-sequencia',
          1,
          0,
          { c: sessaoId },
        )
        if (ult && ult.length) seq = (ult[0].getInt('sequencia') || 0) + 1
      } catch (_) {
        seq = 1
      }
      ev.set('sequencia', seq)
      $app.save(ev)

      return resp(200, {
        classificacao: 'pendente',
        motivo: 'respostas_incompletas',
        perguntas_ausentes: ausentes,
        roteiro_versao_id: roteiroVersaoId,
      })
    }

    // ---------- 5) Aplicar regras de classificação (determinístico) ----------
    const regras = roteiro.regras_classificacao
    let classificacao = null

    for (let i = 0; i < regras.length; i++) {
      const regra = regras[i]
      if (regra.operador === 'DEFAULT') {
        classificacao = regra.estado
        break
      }
      if (regra.operador === 'E') {
        let todas = true
        for (let j = 0; j < regra.condicoes.length; j++) {
          const cond = regra.condicoes[j]
          const resposta = respostasMap[cond.pergunta_id] || ''
          if (cond.valor && resposta !== cond.valor) {
            todas = false
            break
          }
          if (cond.preenchida && !resposta) {
            todas = false
            break
          }
        }
        if (todas) {
          classificacao = regra.estado
          break
        }
      }
      if (regra.operador === 'OU') {
        for (let j = 0; j < regra.condicoes.length; j++) {
          const cond = regra.condicoes[j]
          const resposta = respostasMap[cond.pergunta_id] || ''
          if (cond.valor && resposta === cond.valor) {
            classificacao = regra.estado
            break
          }
        }
        if (classificacao) break
      }
    }

    if (!classificacao) {
      classificacao = 'pendente'
    }

    // ---------- 6) Deduplicação DEC-08 (telefone normalizado) ----------
    const clienteId = String(lead.get('cliente') || '')
    if (clienteId) {
      try {
        const cliente = $app.findRecordById('clientes', clienteId)
        const telefone = String(cliente.get('telefone') || '').replace(/\D/g, '')
        if (telefone) {
          const duplicados = $app.findRecordsByFilter(
            'clientes',
            'telefone = {:t} && id != {:id}',
            '',
            2,
            0,
            { t: telefone, id: clienteId },
          )
          if (duplicados && duplicados.length > 0) {
            classificacao = 'duplicado'
          }
        }
      } catch (_) {
        /* dedup é best-effort */
      }
    }

    // ---------- 7) Atualizar vendas (classificacao + roteiro_versao) ----------
    lead.set('classificacao', classificacao)
    lead.set('roteiro_versao', roteiroVersaoId)
    $app.save(lead)

    // ---------- 8) Registrar evento de auditoria ----------
    const ev = new Record($app.findCollectionByNameOrId('eventos_negocio'))
    ev.set('event_id', $security.randomString(24))
    ev.set('correlation_id', sessaoId)
    ev.set('tipo', 'qualificacao_classificada')
    ev.set('agregado', 'vendas')
    ev.set('agregado_id', leadId)
    ev.set('origem', 'sistema')
    ev.set('payload', {
      classificacao: classificacao,
      roteiro_versao_id: roteiroVersaoId,
      sugestao: true,
      confirmacao_humana: false,
    })
    ev.set('ocorrido_em', new Date().toISOString())
    let seqEv = 1
    try {
      const ult = $app.findRecordsByFilter(
        'eventos_negocio',
        'correlation_id = {:c}',
        '-sequencia',
        1,
        0,
        { c: sessaoId },
      )
      if (ult && ult.length) seqEv = (ult[0].getInt('sequencia') || 0) + 1
    } catch (_) {
      seqEv = 1
    }
    ev.set('sequencia', seqEv)
    $app.save(ev)

    return resp(200, {
      classificacao: classificacao,
      roteiro_versao_id: roteiroVersaoId,
      sugestao: true,
      confirmacao_humana: false,
      lead_id: leadId,
      sessao_id: sessaoId,
    })
  } catch (err) {
    return resp(500, { codigo: 'FALHA_INTERNA', erro: String(err).slice(0, 200), rollback: true })
  }
})
