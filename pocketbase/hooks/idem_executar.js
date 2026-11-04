/// <reference path="../pb_data/types.d.ts" />

// T2.1 / Etapa 1 + 2 — Operacao idempotente com evento de auditoria ATOMICO.
// POST /backend/v1/idem/executar (re-path: Skip RETÉM rotas novas sob /api/)
//
// Garantias:
//  - chave concluida + payload identico  -> 200 replay com resultado original
//  - chave concluida + payload diferente -> 409 IDEMPOTENCY_PAYLOAD_MISMATCH
//  - chave em processamento (lease vivo) -> 409 IDEMPOTENCY_IN_PROGRESS + retry_after
//  - chave em processamento (lease vencido) -> takeover permitido
//  - falha interna real -> 500 com o erro real (NUNCA vira sucesso)
//  - efeito + evento + chave: uma unica transacao (rollback integral)
//
// DECISÃO A/Opção 1 (owner, 04/11): o EVENTO é o efeito mínimo da infraestrutura
// (resultado_id = record.id do evento). NÃO comprova efeitos comerciais externos —
// o efeito físico real será gravado pelo consumidor futuro (T2.19/20 Altforce)
// na coleção do próprio domínio.

routerAdd('POST', '/backend/v1/idem/executar', (e) => {
  // ---------- helpers inline (runtime Goja separado por callback) ----------
  const canonizar = (v) => {
    if (v === null || v === undefined) return 'null'
    if (Array.isArray(v)) return '[' + v.map(canonizar).join(',') + ']'
    if (typeof v === 'object') {
      const ks = Object.keys(v).sort()
      return '{' + ks.map((k) => JSON.stringify(k) + ':' + canonizar(v[k])).join(',') + '}'
    }
    return JSON.stringify(v)
  }
  const agoraMs = () => Date.now()
  const isoMs = (ms) => new Date(ms).toISOString()

  const resp = (status, obj) => e.json(status, obj)

  // ---------- entrada ----------
  const info = e.requestInfo()
  const body = info.body || {}
  const chave = String(body.chave || '').trim()
  const payload = body.payload === undefined ? {} : body.payload
  const falharEfeito = body.falhar_efeito === true
  const falharAuditoria = body.falhar_auditoria === true
  const origem = String(body.origem || 'api')
  const ttlLeaseMs = Number(body.ttl_lease_ms || 30000)

  if (!chave) return resp(400, { codigo: 'CHAVE_OBRIGATORIA' })

  const hashPayload = $security.sha256(canonizar(payload))
  const t0 = agoraMs()

  const buscarChave = (app) => {
    try {
      const rs = app.findRecordsByFilter(
        'idempotency_keys',
        'idempotency_key = {:k}',
        '-created',
        1,
        0,
        { k: chave },
      )
      return rs && rs.length ? rs[0] : null
    } catch (_) {
      return null
    }
  }

  const replayDe = (reg) => ({
    replay: true,
    chave: chave,
    estado: reg.getString('estado'),
    resultado_id: reg.getString('resultado_id'),
    payload_hash: reg.getString('payload_hash'),
  })

  // ---------- 1) chave ja existe? ----------
  let existente = buscarChave($app)

  if (existente) {
    const estado = existente.getString('estado')

    if (estado === 'ok') {
      if (existente.getString('payload_hash') === hashPayload) {
        return resp(200, replayDe(existente))
      }
      return resp(409, {
        codigo: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
        chave: chave,
        payload_hash_original: existente.getString('payload_hash'),
        payload_hash_recebido: hashPayload,
        resultado_id: existente.getString('resultado_id'),
      })
    }

    if (estado === 'processando') {
      let lease = 0
      try {
        const l = existente.getString('lease_expira_em')
        lease = l ? new Date(l).getTime() : 0
      } catch (_) {
        lease = 0
      }
      if (lease > agoraMs()) {
        return resp(409, {
          codigo: 'IDEMPOTENCY_IN_PROGRESS',
          chave: chave,
          retry_after_ms: lease - agoraMs(),
        })
      }
      // lease vencido -> cai no fluxo de takeover abaixo
    }
    // estado 'falhou' ou 'processando' com lease vencido -> tentar de novo
  }

  // ---------- 2) transacao unica: chave + efeito + evento ----------
  let resultadoId = null
  let eventoId = null
  let colisaoUnique = false
  let erroReal = ''

  try {
    $app.runInTransaction((txApp) => {
      const agora = agoraMs()

      // 2a) reservar a chave em 'processando'
      let reg = null
      if (existente) {
        reg = txApp.findRecordById('idempotency_keys', existente.id)
        reg.set('estado', 'processando')
        reg.set('payload_hash', hashPayload)
        reg.set('lease_expira_em', isoMs(agora + ttlLeaseMs))
        reg.set('tentativas', (reg.getInt('tentativas') || 0) + 1)
        reg.set('erro', '')
      } else {
        reg = new Record(txApp.findCollectionByNameOrId('idempotency_keys'))
        reg.set('idempotency_key', chave)
        reg.set('payload_hash', hashPayload)
        reg.set('operacao', 'executar')
        reg.set('estado', 'processando')
        reg.set('lease_expira_em', isoMs(agora + ttlLeaseMs))
        reg.set('tentativas', 1)
      }
      txApp.save(reg)

      // 2b) EFEITO MINIMO = o evento append-only (decisão A, Opção 1 — aprovada 04/11):
      // a infraestrutura T2.1 não tem consumidor de negócio ainda; o efeito físico
      // real será gravado pelo consumidor futuro (T2.19/20 Altforce) na coleção do
      // próprio domínio. NÃO comprova efeitos comerciais externos.
      // falha injetada ANTES do evento -> deve reverter tudo
      if (falharEfeito) throw new Error('FALHA_INJETADA_EFEITO')

      // 2c) evento append-only (obrigatorio) — É o efeito mínimo
      const corr = String(body.correlation_id || chave)
      let seq = 1
      try {
        const ult = txApp.findRecordsByFilter(
          'eventos_negocio',
          'correlation_id = {:c}',
          '-sequencia',
          1,
          0,
          { c: corr },
        )
        if (ult && ult.length) seq = (ult[0].getInt('sequencia') || 0) + 1
      } catch (_) {
        seq = 1
      }

      const novoEventId = $security.randomString(24)
      const ev = new Record(txApp.findCollectionByNameOrId('eventos_negocio'))
      ev.set('event_id', novoEventId)
      ev.set('correlation_id', corr)
      ev.set('tipo', 'operacao.executada')
      ev.set('agregado', 'operacao_idempotente')
      ev.set('agregado_id', novoEventId)
      ev.set('origem', origem)
      ev.set('payload', { chave: chave, payload_hash: hashPayload })
      ev.set('ocorrido_em', isoMs(agora))
      ev.set('sequencia', seq)
      txApp.save(ev)
      eventoId = ev.id
      resultadoId = ev.id // A/Opção 1: o evento é o efeito mínimo

      // falha injetada na auditoria -> operacao critica NAO pode persistir
      if (falharAuditoria) throw new Error('FALHA_INJETADA_AUDITORIA')

      // 2d) concluir a chave
      reg.set('estado', 'ok')
      reg.set('resultado_id', resultadoId)
      reg.set('lease_expira_em', '')
      txApp.save(reg)
    })
  } catch (err) {
    const msg = String(err)

    // ---- tratamento de colisao UNIQUE (Etapa 1.1) ----
    // NAO presumir que e corrida: so tratar como replay se houver registro real.
    const pareceUnique = /unique|not_unique/i.test(msg)
    const concorrente = buscarChave($app)

    if (pareceUnique && concorrente && concorrente.getString('estado') === 'ok') {
      if (concorrente.getString('payload_hash') === hashPayload) {
        return resp(200, replayDe(concorrente))
      }
      return resp(409, {
        codigo: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
        chave: chave,
        payload_hash_original: concorrente.getString('payload_hash'),
        payload_hash_recebido: hashPayload,
        resultado_id: concorrente.getString('resultado_id'),
      })
    }
    if (pareceUnique && concorrente && concorrente.getString('estado') === 'processando') {
      return resp(409, {
        codigo: 'IDEMPOTENCY_IN_PROGRESS',
        chave: chave,
        retry_after_ms: ttlLeaseMs,
      })
    }

    // ---- falha interna REAL: registra e devolve erro (nunca sucesso) ----
    erroReal = msg
    try {
      const aindaExiste = buscarChave($app)
      if (aindaExiste && !aindaExiste.getString('resultado_id')) {
        aindaExiste.set('estado', 'falhou')
        aindaExiste.set('lease_expira_em', '')
        aindaExiste.set('erro', msg.substring(0, 480))
        $app.save(aindaExiste)
      }
    } catch (_) {
      /* nao mascarar o erro original */
    }

    return resp(500, { codigo: 'FALHA_INTERNA', erro: msg, rollback: true })
  }

  return resp(201, {
    replay: false,
    chave: chave,
    resultado_id: resultadoId,
    evento_id: eventoId,
    payload_hash: hashPayload,
    duracao_ms: agoraMs() - t0,
  })
})
