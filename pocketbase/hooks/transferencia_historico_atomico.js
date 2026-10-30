// transferencia_historico_atomico — V3 final (Q1/Q2/Q3/Q4) — hook único de transferência.
// Absorve a validação do alvo (ex-validar_transferencia_lead) + auditoria automática.
//
// POR QUE HOOK ÚNICO: em onRecordUpdateRequest, um handler que responde erro DEPOIS de outro
// ter chamado e.next() NÃO interrompe o handler anterior — com 2 hooks encadeados, a
// auditoria era gravada mesmo com o update abortado (defeito comprovado em teste).
//
// POR QUE AUDITAR ANTES DO e.next(): prova empírica (PB 0.36 JSVM) — (a) saves via e.app no
// hook de request NÃO compartilham a transação do update (sobrevivem ao rollback); (b) erros
// lançados APÓS e.next() são engolidos: o update persiste e o cliente recebe 200 mesmo com
// a auditoria falhada. Gravando o histórico ANTES: falha de auditoria responde erro e o
// e.next() nunca roda → NÃO HÁ transferência sem auditoria. O caso inverso (histórico gravado
// e update falhando depois nas regras do PB) é raro (validação prévia + regras R1–R18b já
// testadas) e produz evento órfão DETECTÁVEL (transferencia sem mudança de vendedor) —
// trade-off deliberado: prefere-se evento órfão raro a transferência sem auditoria.
//
// Reenvio idêntico não duplica: novo === vendedor do banco → sem reatribuição, sem evento.
onRecordUpdateRequest((e) => {
  try {
    if (e.hasSuperuserAuth()) return e.next()
    const info = e.requestInfo()
    const body = info && info.body ? info.body : {}
    if (!Object.prototype.hasOwnProperty.call(body, 'vendedor')) return e.next()
    const novo = body.vendedor
    if (!novo) return e.next()

    // vendedor ATUAL (do banco — e.record já contém o body):
    let atual = ''
    try {
      const fresco = e.app.findRecordById('vendas', e.record.id)
      atual = fresco.get('vendedor') || ''
    } catch (errFresco) {
      atual = ''
    }
    if (novo === atual) return e.next()

    // VALIDAÇÃO DO ALVO (server-side):
    let alvo = null
    let erroBusca = ''
    try {
      alvo = e.app.findRecordById('users', novo)
    } catch (errBusca) {
      erroBusca = String(errBusca)
    }
    if (!alvo || erroBusca !== '') {
      return e.json(400, { code: 'alvo_inexistente', message: 'Usuário de destino não existe.' })
    }
    const ativoAlvo = alvo.get('ativo')
    if (ativoAlvo === false || ativoAlvo === 0 || String(ativoAlvo) === 'false') {
      return e.json(400, { code: 'alvo_inativo', message: 'Usuário de destino está inativo.' })
    }
    const role = alvo.get('role') || ''
    const atorRole = (e.auth && e.auth.get('role')) || ''
    const atorAdmin = atorRole === 'admin' || atorRole === 'gestor'
    // Decisão owner 30/10 09:43: não-admin pode transferir lead PRÓPRIO também para a
    // TRIAGEM ativa (encaminhamento). Perfis de destino autorizados p/ não-admin:
    const PERFIS_DESTINO = ['vendedor', 'revendedor', 'triagem']
    if (!atorAdmin && PERFIS_DESTINO.indexOf(role) === -1) {
      return e.json(400, {
        code: 'alvo_nao_autorizado',
        message: 'Perfil de destino não autorizado para receber leads.',
      })
    }

    // TRANSFERÊNCIA CONJUNTA DO CLIENTE (decisão owner 30/10 14:41):
    // o cliente vinculado acompanha o novo responsável QUANDO não houver conflito —
    // conflito = outro lead ATIVO do mesmo cliente com vendedor diferente do novo E do atual.
    // Em conflito: preservar os responsáveis existentes e sinalizar revisão no histórico.
    let conflitoCliente = false
    let clienteAtualizado = false
    let clienteOriginal = null
    const clienteId = e.record.get('cliente') || ''
    if (clienteId) {
      try {
        const outros = e.app.findRecordsByFilter(
          'vendas',
          'cliente = {:cliente} && id != {:lead}',
          '',
          50,
          0,
          { cliente: clienteId, lead: e.record.id },
        )
        let temAtivoDivergente = false
        for (let i = 0; i < outros.length; i++) {
          const vendedorOutro = outros[i].get('vendedor') || ''
          const statusOutro = outros[i].get('status_lead') || ''
          const ativo = statusOutro === '' || statusOutro === 'em_andamento'
          if (ativo && vendedorOutro && vendedorOutro !== novo && vendedorOutro !== atual) {
            temAtivoDivergente = true
            break
          }
        }
        if (!temAtivoDivergente) {
          const cliente = e.app.findRecordById('clientes', clienteId)
          clienteOriginal = {
            id: clienteId,
            responsavel: cliente.get('responsavel') || '',
            responsavel_usuario: cliente.get('responsavel_usuario') || '',
            carteira: cliente.get('carteira') || '',
          }
          cliente.set('responsavel', novo)
          cliente.set('responsavel_usuario', novo)
          cliente.set('carteira', alvo.get('carteira') || '')
          e.app.save(cliente)
          clienteAtualizado = true
        } else {
          conflitoCliente = true
        }
      } catch (errCliente) {
        // Falha na atualização do cliente NÃO bloqueia a transferência do lead
        // (auditoria do lead é o registro primário) — sinaliza revisão no histórico.
        conflitoCliente = true
      }
    }

    // AUDITORIA PRIMEIRO (se falhar, a transferência não ocorre):
    const atorId = e.auth ? e.auth.id : ''
    const etapa = e.record.get('etapa') || ''
    let hist = null
    try {
      hist = new Record(e.app.findCollectionByNameOrId('lead_historico'))
      hist.set('lead_id', e.record.id)
      hist.set('etapa_anterior', etapa)
      hist.set('etapa_nova', etapa)
      hist.set('responsavel', novo)
      hist.set('data_hora', new Date().toISOString())
      hist.set('tipo_evento', 'transferencia')
      hist.set('usuario_origem', atorId)
      hist.set('usuario_destino', novo)
      hist.set(
        'observacao',
        conflitoCliente
          ? 'Transferência registrada; revisão necessária: responsável do cliente preservado (conflito ou falha na atualização).'
          : 'Transferência de vendedor registrada automaticamente pelo servidor.',
      )
      e.app.save(hist)
    } catch (errHist) {
      // COMPENSAÇÃO idempotente: a auditoria falhou DEPOIS de o cliente ter sido atualizado —
      // reverter o cliente ao estado original (a transferência NÃO ocorrerá). Se a reversão
      // também falhar, o erro é reportado com código específico p/ reconciliação manual.
      if (clienteAtualizado && clienteOriginal) {
        try {
          const clienteRev = e.app.findRecordById('clientes', clienteOriginal.id)
          // PROTEÇÃO POR ESTADO ESPERADO (CAS lógico): compensar SÓ SE o cliente ainda está
          // exatamente no estado que ESTE handler deixou. Se um usuário (admin/gestor) alterou
          // o cliente concorrentemente, a alteração dele VENCE — o rollback NÃO sobrescreve;
          // a divergência fica detectável pela reconciliação (cliente ≠ vendedor do lead).
          const aindaNosso =
            (clienteRev.get('responsavel') || '') === novo &&
            (clienteRev.get('responsavel_usuario') || '') === novo
          if (aindaNosso) {
            clienteRev.set('responsavel', clienteOriginal.responsavel)
            clienteRev.set('responsavel_usuario', clienteOriginal.responsavel_usuario)
            clienteRev.set('carteira', clienteOriginal.carteira)
            e.app.save(clienteRev)
          }
        } catch (errComp) {
          return e.json(500, {
            code: 'compensacao_falhou',
            message:
              'Transferência não realizada; falha ao registrar auditoria E ao reverter o cliente. Reconciliação manual necessária.',
          })
        }
      }
      return e.json(500, {
        code: 'auditoria_falhou',
        message: 'Transferência não realizada: falha ao registrar auditoria.',
      })
    }

    return e.next()
  } catch (err) {
    return e.json(500, { code: 'hook_transferencia', message: String(err).slice(0, 120) })
  }
}, 'vendas')
