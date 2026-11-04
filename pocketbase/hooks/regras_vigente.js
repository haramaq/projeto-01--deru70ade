/// <reference path="../pb_data/types.d.ts" />

// T2.1 / Etapa 3 — resolver a versao vigente de uma regra numa data (rastreabilidade).
// GET /backend/v1/regras/vigente?regra_chave=X&em=YYYY-MM-DDTHH:MM:SSZ
// (re-path: Skip RETÉM /api/)
//
// Devolve a versao exata que uma decisao tomada naquele instante teria usado.
// Se nao houver versao vigente -> 404 SEM inventar regra.

routerAdd('GET', '/backend/v1/regras/vigente', (e) => {
  const q = e.requestInfo().query
  const chave = String(q['regra_chave'] || '').trim()
  if (!chave) return e.json(400, { codigo: 'REGRA_CHAVE_OBRIGATORIA' })

  const emStr = String(q['em'] || new Date().toISOString())
  const emMs = new Date(emStr).getTime()
  if (isNaN(emMs)) return e.json(400, { codigo: 'DATA_INVALIDA' })

  let candidatas = []
  try {
    candidatas = $app.findRecordsByFilter('regras_versao', 'regra_chave = {:r}', 'versao', 200, 0, {
      r: chave,
    })
  } catch (err) {
    return e.json(500, { codigo: 'ERRO_CONSULTA', erro: String(err) })
  }

  // vigente = vigente_de <= em && (vigente_ate vazio || vigente_ate > em)
  let achou = null
  for (let i = 0; i < candidatas.length; i++) {
    const r = candidatas[i]
    const de = r.getString('vigente_de')
    const ate = r.getString('vigente_ate')
    const deMs = de ? new Date(de).getTime() : 0
    const ateMs = ate ? new Date(ate).getTime() : null
    if (deMs <= emMs && (ateMs === null || ateMs > emMs)) {
      achou = r
      break
    }
  }

  if (!achou) {
    return e.json(404, {
      codigo: 'SEM_VERSAO_VIGENTE',
      regra_chave: chave,
      em: emStr,
      total_versoes: candidatas.length,
    })
  }

  return e.json(200, {
    regra_chave: chave,
    em: emStr,
    versao: achou.getInt('versao'),
    versao_id: achou.id,
    hash_conteudo: achou.getString('hash_conteudo'),
    status: achou.getString('status'),
    vigente_de: achou.getString('vigente_de'),
    vigente_ate: achou.getString('vigente_ate'),
    conteudo: achou.get('conteudo'),
  })
})
