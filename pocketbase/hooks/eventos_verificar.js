/// <reference path="../pb_data/types.d.ts" />

// T2.1 / Etapa 2 — rota de consulta de eventos (append-only, somente leitura)
// GET /backend/v1/eventos/verificar?correlation_id=X   -> checa ordenacao e duplicidade
// (re-path: Skip RETÉM /api/)

routerAdd('GET', '/backend/v1/eventos/verificar', (e) => {
  const corr = String(e.requestInfo().query['correlation_id'] || '')
  if (!corr) return e.json(400, { codigo: 'CORRELATION_OBRIGATORIA' })

  let evs = []
  try {
    evs = $app.findRecordsByFilter(
      'eventos_negocio',
      'correlation_id = {:c}',
      'sequencia',
      500,
      0,
      { c: corr },
    )
  } catch (err) {
    return e.json(500, { codigo: 'ERRO_CONSULTA', erro: String(err) })
  }

  const ids = {}
  const seqs = {}
  let dupId = 0
  let dupSeq = 0
  const lista = []

  for (let i = 0; i < evs.length; i++) {
    const r = evs[i]
    const id = r.getString('event_id')
    const sq = r.getInt('sequencia')
    if (ids[id]) dupId++
    ids[id] = true
    if (seqs[String(sq)]) dupSeq++
    seqs[String(sq)] = true
    lista.push({
      sequencia: sq,
      event_id: id,
      tipo: r.getString('tipo'),
      ocorrido_em: r.getString('ocorrido_em'),
      agregado_id: r.getString('agregado_id'),
      origem: r.getString('origem'),
    })
  }

  // a ordenacao por 'sequencia' deve ser estritamente crescente e contigua
  let monotona = true
  let lacunas = 0
  for (let i = 1; i < lista.length; i++) {
    if (lista[i].sequencia < lista[i - 1].sequencia) monotona = false
    if (lista[i].sequencia !== lista[i - 1].sequencia + 1) lacunas++
  }

  return e.json(200, {
    correlation_id: corr,
    total: lista.length,
    duplicados_event_id: dupId,
    duplicados_sequencia: dupSeq,
    ordenacao_monotona: monotona,
    lacunas_sequencia: lacunas,
    eventos: lista,
  })
})
