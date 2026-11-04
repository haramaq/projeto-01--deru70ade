/// <reference path="../pb_data/types.d.ts" />
// T2.2-T4-B15-SECURITY — Proteção de leads sintéticos em vendas.
// Impede que usuários comerciais (não-admin) criem ou convertam leads em sintéticos.
//
// CREATE: bloqueia origem_captura='sintetico' para não-admin.
// UPDATE: bloqueia alteração de origem_captura para 'sintetico' por não-admin.
//
// Superuser bypass (padrão da plataforma — ferramenta administrativa).

// CREATE de vendas
onRecordCreateRequest((e) => {
  try {
    if (e.hasSuperuserAuth()) return e.next()
    const colecao = e.record.collection().name
    if (colecao !== 'vendas') return e.next()

    const body = (e.requestInfo() && e.requestInfo().body) || {}
    const origemCaptura = String(body.origem_captura || e.record.get('origem_captura') || '')

    if (origemCaptura === 'sintetico') {
      const role = String((e.auth && e.auth.get('role')) || '')
      if (role !== 'admin') {
        return e.json(403, {
          code: 'lead_sintetico_restrito',
          message: 'Somente administradores podem criar leads sintéticos.',
        })
      }
    }

    return e.next()
  } catch (err) {
    throw err
  }
}, 'vendas')

// UPDATE de vendas
onRecordUpdateRequest((e) => {
  try {
    if (e.hasSuperuserAuth()) return e.next()
    const colecaoUp = e.record.collection().name
    if (colecaoUp !== 'vendas') return e.next()

    const rec = e.record
    const orig = rec.original()
    const origemAnterior = String(orig.get('origem_captura') || '')
    const origemNova = String(rec.get('origem_captura') || '')

    // Bloquear conversão para 'sintetico' por não-admin
    if (origemNova === 'sintetico' && origemAnterior !== 'sintetico') {
      const role = String((e.auth && e.auth.get('role')) || '')
      if (role !== 'admin') {
        return e.json(403, {
          code: 'lead_sintetico_restrito',
          message: 'Somente administradores podem converter leads em sintéticos.',
        })
      }
    }

    return e.next()
  } catch (err) {
    throw err
  }
}, 'vendas')
