/// <reference path="../pb_data/types.d.ts" />

// T2.1 / Etapa 3 — publicar nova versao de regra (fecha a anterior atomicamente).
// POST /backend/v1/regras/publicar (re-path: Skip RETÉM /api/)
//
// ORDEM CORRETA: fecha a anterior ANTES de criar a nova.
// O indice parcial UNIQUE (regra_chave) WHERE vigente_ate='' so admite
// uma versao aberta por regra — criar primeiro e violar o proprio invariante.

routerAdd('POST', '/backend/v1/regras/publicar', (e) => {
  const body = e.requestInfo().body || {}
  const chave = String(body.regra_chave || '').trim()
  const conteudo = body.conteudo === undefined ? {} : body.conteudo
  const criadoPor = String(body.criado_por || 'desconhecido')
  if (!chave) return e.json(400, { codigo: 'REGRA_CHAVE_OBRIGATORIA' })

  const canonizar = (v) => {
    if (v === null || v === undefined) return 'null'
    if (Array.isArray(v)) return '[' + v.map(canonizar).join(',') + ']'
    if (typeof v === 'object') {
      const ks = Object.keys(v).sort()
      return '{' + ks.map((k) => JSON.stringify(k) + ':' + canonizar(v[k])).join(',') + '}'
    }
    return JSON.stringify(v)
  }
  const hash = $security.sha256(canonizar(conteudo))
  const vigenteDe = String(body.vigente_de || new Date().toISOString())

  let novaVersao = 1
  let idNova = null
  let idsFechadas = []

  try {
    $app.runInTransaction((txApp) => {
      // 1) proxima versao
      let maxV = 0
      try {
        const todas = txApp.findRecordsByFilter(
          'regras_versao',
          'regra_chave = {:r}',
          '-versao',
          1,
          0,
          { r: chave },
        )
        if (todas && todas.length) maxV = todas[0].getInt('versao') || 0
      } catch (_) {
        maxV = 0
      }
      novaVersao = maxV + 1

      // 2) FECHAR as abertas PRIMEIRO (libera o indice parcial)
      let antigas = []
      try {
        antigas = txApp.findRecordsByFilter(
          'regras_versao',
          'regra_chave = {:r} && vigente_ate = ""',
          '-versao',
          50,
          0,
          { r: chave },
        )
      } catch (_) {
        antigas = []
      }

      for (let i = 0; i < antigas.length; i++) {
        const o = txApp.findRecordById('regras_versao', antigas[i].id)
        o.set('vigente_ate', vigenteDe)
        o.set('status', 'encerrada')
        txApp.save(o)
        idsFechadas.push(o.id)
      }

      // 3) criar a nova (agora o indice permite)
      const nova = new Record(txApp.findCollectionByNameOrId('regras_versao'))
      nova.set('regra_chave', chave)
      nova.set('versao', novaVersao)
      nova.set('conteudo', conteudo)
      nova.set('vigente_de', vigenteDe)
      nova.set('hash_conteudo', hash)
      nova.set('status', 'vigente')
      nova.set('criado_por', criadoPor)
      txApp.save(nova)
      idNova = nova.id
    })
  } catch (err) {
    const msg = String(err)
    if (/unique|not_unique/i.test(msg)) {
      return e.json(409, {
        codigo: 'CONFLITO_VERSAO_CONCORRENTE',
        regra_chave: chave,
        detalhe: msg.substring(0, 200),
      })
    }
    return e.json(500, { codigo: 'FALHA_INTERNA', erro: msg, rollback: true })
  }

  return e.json(201, {
    regra_chave: chave,
    versao: novaVersao,
    versao_id: idNova,
    versoes_fechadas: idsFechadas,
    hash_conteudo: hash,
    vigente_de: vigenteDe,
  })
})
