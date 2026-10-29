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
// RISCO REGISTRADO (owner, 29/10): a auditoria NÃO é totalmente atômica. Mecanismo de
// reconciliação sugerido: consulta periódica de eventos 'transferencia' cujo vendedor atual
// do lead difere de usuario_destino (evento órfão) — a ser implementada como rotina admin.
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
    if (!atorAdmin && role !== 'vendedor' && role !== 'revendedor') {
      return e.json(400, {
        code: 'alvo_nao_autorizado',
        message: 'Perfil de destino não autorizado para receber leads.',
      })
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
      hist.set('observacao', 'Transferência de vendedor registrada automaticamente pelo servidor.')
      e.app.save(hist)
    } catch (errHist) {
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
