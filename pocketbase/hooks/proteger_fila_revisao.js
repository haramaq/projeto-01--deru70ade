// proteger_fila_revisao — item 3 (impedir resolução duplicada/concorrente).
// Regras:
//   1. Item concluído (resolvida/descartada) NÃO volta a 'pendente' (conclusão é definitiva);
//   2. PATCH de conclusão em item JÁ concluído → 409 se a decisão difere (concorrência
//      detectável); idêntica → 200 idempotente (reenvio não duplica nem corrompe);
//   3. Superuser bypass (recuperação administrativa).
onRecordUpdateRequest((e) => {
  try {
    if (e.hasSuperuserAuth()) return e.next()
    const info = e.requestInfo()
    const body = info && info.body ? info.body : {}
    if (!Object.prototype.hasOwnProperty.call(body, 'status')) return e.next()

    // estado ATUAL do banco (e.record já contém o body — runbook Goja):
    let atual = ''
    try {
      const fresco = e.app.findRecordById('fila_revisao', e.record.id)
      atual = fresco.get('status') || ''
    } catch (errFresco) {
      atual = ''
    }
    if (atual !== 'resolvida' && atual !== 'descartada') return e.next()

    const novo = body.status
    // 1. conclusão → pendente é proibido:
    if (novo === 'pendente') {
      return e.json(409, {
        code: 'item_ja_concluido',
        message:
          'Item já concluído (' + atual + '); não pode reabrir. Crie um novo item se necessário.',
      })
    }
    // 2. re-conclusão: idempotente se a decisão for a mesma; 409 se divergir:
    let decisaoAnterior = ''
    try {
      const fresco = e.app.findRecordById('fila_revisao', e.record.id)
      decisaoAnterior = fresco.get('decisao') || ''
    } catch (errF2) {
      decisaoAnterior = ''
    }
    const decisaoNova = body.decisao !== undefined ? String(body.decisao) : ''
    if (novo === atual && decisaoNova === decisaoAnterior) {
      return e.next() // reenvio idêntico: idempotente
    }
    return e.json(409, {
      code: 'resolucao_concorrente',
      message: 'Item já concluído (' + atual + ') com decisão registrada; divergência bloqueada.',
    })
  } catch (err) {
    return e.json(500, { code: 'hook_fila', message: String(err).slice(0, 120) })
  }
}, 'fila_revisao')
