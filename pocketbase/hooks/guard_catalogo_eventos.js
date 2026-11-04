/// <reference path="../pb_data/types.d.ts" />
// T2.2-T4-B — Guard D-3 com 11 tipos (emenda qualificação, 04/11)
// Tipos: 8 originais + operacao.executada + qualificacao_resposta_corrigida + qualificacao_classificada

routerAdd('POST', '/backend/v1/eventos/verificar', (e) => {
  const body = (e.requestInfo() && e.requestInfo().body) || {}
  const correlationId = String(body.correlation_id || e.queryParam('correlation_id') || '')

  if (!correlationId) {
    return e.json(400, { codigo: 'CORRELACAO_OBRIGATORIA' })
  }

  try {
    const eventos = $app.findRecordsByFilter(
      'eventos_negocio',
      'correlation_id = {:c}',
      'sequencia',
      1000,
      0,
      { c: correlationId },
    )

    const lista = []
    for (let i = 0; i < eventos.length; i++) {
      const ev = eventos[i]
      lista.push({
        event_id: String(ev.get('event_id') || ''),
        tipo: String(ev.get('tipo') || ''),
        agregado: String(ev.get('agregado') || ''),
        agregado_id: String(ev.get('agregado_id') || ''),
        sequencia: ev.getInt('sequencia') || 0,
        origem: String(ev.get('origem') || ''),
        ocorrido_em: String(ev.get('ocorrido_em') || ''),
      })
    }

    // Verificação de ordenação monotônica e duplicatas
    let ordenacaoMonotona = true
    let duplicadosEventId = 0
    let duplicadosSequencia = 0
    let lacunasSequencia = 0

    const seqs = []
    const eventIds = []
    for (let i = 0; i < lista.length; i++) {
      seqs.push(lista[i].sequencia)
      eventIds.push(lista[i].event_id)
    }
    for (let i = 1; i < seqs.length; i++) {
      if (seqs[i] <= seqs[i - 1]) ordenacaoMonotona = false
    }
    const uniqueEventIds = {}
    const uniqueSeqs = {}
    for (let i = 0; i < eventIds.length; i++) {
      if (uniqueEventIds[eventIds[i]]) duplicadosEventId++
      uniqueEventIds[eventIds[i]] = true
      if (uniqueSeqs[seqs[i]]) duplicadosSequencia++
      uniqueSeqs[seqs[i]] = true
    }
    if (seqs.length > 0) {
      for (let i = 1; i <= seqs.length; i++) {
        if (seqs.indexOf(i) === -1) lacunasSequencia++
      }
    }

    return e.json(200, {
      correlation_id: correlationId,
      total: lista.length,
      eventos: lista,
      ordenacao_monotona: ordenacaoMonotona,
      duplicados_event_id: duplicadosEventId,
      duplicados_sequencia: duplicadosSequencia,
      lacunas_sequencia: lacunasSequencia,
    })
  } catch (err) {
    return e.json(500, { codigo: 'FALHA_INTERNA', erro: String(err).slice(0, 200) })
  }
})

// Catálogo D-3 (referência para o guard de eventos)
// Tipos aceitos no CREATE de eventos_negocio:
const catalogoD3 = [
  'lead_criado',
  'lead_atualizado',
  'lead_transferido',
  'lead_convertido',
  'lead_perdido',
  'tarefa_criada',
  'tarefa_concluida',
  'cliente_criado',
  'operacao.executada',
  'qualificacao_resposta_corrigida',
  'qualificacao_classificada',
]

onRecordCreateRequest((e) => {
  try {
    if (e.hasSuperuserAuth()) return e.next()
    const colecao = e.record.collection().name
    if (colecao !== 'eventos_negocio') return e.next()

    const tipo = String(e.record.get('tipo') || '')
    if (catalogoD3.indexOf(tipo) === -1) {
      return e.json(400, {
        code: 'tipo_invalido',
        message: 'Tipo de evento não reconhecido no catálogo D-3: ' + tipo,
      })
    }

    return e.next()
  } catch (err) {
    throw err
  }
}, 'eventos_negocio')
