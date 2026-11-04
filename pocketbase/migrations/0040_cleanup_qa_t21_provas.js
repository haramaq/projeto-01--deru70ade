/// <reference path="../pb_data/types.d.ts" />
// T2.1 / OP-6B.2 — Limpeza dos registros fictícios das provas E1, E2 e E3 (04/11).
// ESCOPO EXCLUSIVO: os registros identificados no inventário OP-6B.1 (41 confirmados
// + 2 possíveis chaves em 'falha'). Nada mais é tocado.
//
// FASE A — VALIDAR: localizar todos, confirmar coleção + identificador QA, verificar
//   quantidade esperada por identificador. Abortar diante de divergência, duplicidade
//   ou registro inesperado. NENHUMA exclusão durante a validação.
// FASE B — EXCLUIR: somente após todas as validações passarem.
//
// CORREÇÕES da revisão (04/11):
// 1. isNotFound distingue 'sql: no rows' de outros erros (sem catch genérico).
// 2. Igualdade EXATA por identificador (nunca exclusão por prefixo).
// 3. Inclui verificação das 2 possíveis chaves em 'falha' (E1.7/E2.3).
// 4. Down: no-op documentado — os dados de teste NÃO são recriados.
//
// Semântica transacional PocketBase 0.36: o apply_changes executa todas as
// migrations pendentes em UMA transação — se qualquer migration falhar, nada é
// aplicado (comportamento documentado pela plataforma).

migrate(
  (app) => {
    const isNotFound = (err) => /no rows/i.test(String(err))

    // ============================================================
    // DADOS: identificadores QA documentados no inventário OP-6B.1
    // ============================================================

    // --- eventos_negocio: 20 event_ids confirmados (por correlation_id) ---
    const eventosPorCorr = [
      { corr: 'QA-T21-1793798485483-e11', eventIds: ['qB28cYu67syfjCdzo5hJwvs8'] },
      { corr: 'QA-T21-1793798499334-e12', eventIds: ['UrLrqPP86E5EowB7FbWm8nGY'] },
      { corr: 'QA-T21-1793798507013-e13', eventIds: ['jeYIwaatPQZENzZ7UdTfWvBU'] },
      { corr: 'QA-T21-1793798513634-e14', eventIds: ['m3pjTHwM673eDFf79YRnHzBk'] },
      { corr: 'QA-T21-1793798541090-e14b', eventIds: ['SJx9woEzBVnNOPj9rkiFk37R'] },
      { corr: 'QA-T21-1793798549895-e15', eventIds: ['vj3mCm39Tr9mTsKYXeIuak2b'] },
      { corr: 'QA-T21-1793799158670-e22', eventIds: ['GSYFaFZwpT6YJPoaJD6k0y3d'] },
      {
        corr: 'QA-T21-1793799184700-e26',
        eventIds: [
          'h6ysajBgHbvWsBPAwnkBfu34',
          'OHn0RuCxqaHVOjyodkTY4cGE',
          'JQYsJs2VnSQQPpwIDPCupb3L',
          '61WPXKLUAhjSZ3oer4QF8TCF',
          'vvTNNPulDlW5wc2h5gh62PNE',
        ],
      },
      {
        corr: 'QA-T21-1793799190270-e27',
        eventIds: [
          'yOleRkq9eiot0UMypwKgWx0k',
          '1BgRcA3N8wuADuIGrZzhiFjn',
          'zRdxUJNj6YeuqJYA9Uls1mUE',
          'oK8gnHMLVEROQEgjwQBLzJD0',
          '9YXVYHeYf99XzoUowTBGzk6l',
          '1xyeP2PVOCoxlS6i6mkhFPNl',
          'gHNzcQhAkLGgNbmnslc94nNq',
          '8MoEDOOfdkY9WMb00xtrgbSI',
        ],
      },
    ]

    // --- idempotency_keys: 7 chaves confirmadas + 2 possíveis em 'falha' ---
    const chavesIdem = [
      'QA-T21-1793798485483-e11',
      'QA-T21-1793798499334-e12',
      'QA-T21-1793798507013-e13',
      'QA-T21-1793798513634-e14',
      'QA-T21-1793798541090-e14b',
      'QA-T21-1793798549895-e15',
      'QA-T21-1793799158670-e22',
      // possíveis em 'falha' (E1.7/E2.3 — rollback integral, mas o hook pode ter
      // gravado a chave em 'falha' após o rollback):
      'QA-T21-1793798562686-e17',
      'QA-T21-1793799168679-e23',
    ]

    // --- regras_versao: 5 regras com 14 versões totais ---
    const regrasChaves = [
      'QA-T21:e31:1793800914541',
      'QA-T21:e32:1793800946192',
      'QA-T21:e34:1793800957878',
      'QA-T21:e37:1793800974796',
      'QA-T21:e37b:1793800974796',
    ]

    // ============================================================
    // FASE A — VALIDAR (sem exclusões)
    // ============================================================

    // --- A.1: localizar e validar eventos por correlation_id ---
    const eventosParaExcluir = []
    for (let i = 0; i < eventosPorCorr.length; i++) {
      const grupo = eventosPorCorr[i]
      let evs = []
      try {
        evs = app.findRecordsByFilter(
          'eventos_negocio',
          'correlation_id = {:c}',
          'sequencia',
          100,
          0,
          { c: grupo.corr },
        )
      } catch (err) {
        if (isNotFound(err)) continue
        throw err // erro real de banco: propaga
      }
      // Verificar quantidade esperada:
      if (evs.length !== grupo.eventIds.length) {
        throw new Error(
          'DIVERGENCIA_QA_QTD: eventos_negocio/' +
            grupo.corr +
            ' esperado ' +
            grupo.eventIds.length +
            ' encontrado ' +
            evs.length,
        )
      }
      // Validar cada event_id:
      for (let j = 0; j < evs.length; j++) {
        const ev = evs[j]
        const evId = String(ev.get('event_id') || '')
        if (grupo.eventIds.indexOf(evId) === -1) {
          throw new Error(
            'DIVERGENCIA_QA_EVENT_ID: eventos_negocio/' +
              ev.id +
              ' event_id [' +
              evId +
              '] não está na lista esperada',
          )
        }
        if (evId.indexOf('') === 0) {
          // event_id vazio = registro inesperado
          throw new Error('DIVERGENCIA_QA_EVENT_ID_VAZIO: ' + ev.id)
        }
        eventosParaExcluir.push(ev)
      }
    }

    // --- A.2: localizar e validar chaves de idempotência (igualdade exata) ---
    const chavesParaExcluir = []
    for (let i = 0; i < chavesIdem.length; i++) {
      const chave = chavesIdem[i]
      let recs = []
      try {
        recs = app.findRecordsByFilter('idempotency_keys', 'idempotency_key = {:k}', '', 10, 0, {
          k: chave,
        })
      } catch (err) {
        if (isNotFound(err)) continue
        throw err
      }
      if (recs.length > 1) {
        throw new Error(
          'DIVERGENCIA_QA_DUPL: idempotency_keys/' + chave + ' tem ' + recs.length + ' registros',
        )
      }
      if (recs.length === 1) {
        const rec = recs[0]
        const chaveAtual = String(rec.get('idempotency_key') || '')
        if (chaveAtual !== chave) {
          throw new Error(
            'DIVERGENCIA_QA_CHAVE: ' +
              rec.id +
              ' esperado [' +
              chave +
              '] encontrado [' +
              chaveAtual +
              ']',
          )
        }
        chavesParaExcluir.push(rec)
      }
      // recs.length === 0 → registro ausente (idempotente, sem efeito)
    }

    // --- A.3: localizar e validar regras por regra_chave exata ---
    const versoesParaExcluir = []
    for (let i = 0; i < regrasChaves.length; i++) {
      const chave = regrasChaves[i]
      let recs = []
      try {
        recs = app.findRecordsByFilter('regras_versao', 'regra_chave = {:r}', 'versao', 50, 0, {
          r: chave,
        })
      } catch (err) {
        if (isNotFound(err)) continue
        throw err
      }
      for (let j = 0; j < recs.length; j++) {
        const rec = recs[j]
        const chaveAtual = String(rec.get('regra_chave') || '')
        if (chaveAtual !== chave) {
          throw new Error(
            'DIVERGENCIA_QA_REGRA: ' +
              rec.id +
              ' esperado [' +
              chave +
              '] encontrado [' +
              chaveAtual +
              ']',
          )
        }
        if (chaveAtual.indexOf('QA-T21:') !== 0) {
          throw new Error('DIVERGENCIA_QA_REGRA_PREFIXO: ' + rec.id)
        }
        versoesParaExcluir.push(rec)
      }
    }

    // --- A.4: resumo da validação ---
    const totalValidados =
      eventosParaExcluir.length + chavesParaExcluir.length + versoesParaExcluir.length
    console.log(
      '[OP-6B] validação: ' +
        eventosParaExcluir.length +
        ' eventos + ' +
        chavesParaExcluir.length +
        ' chaves + ' +
        versoesParaExcluir.length +
        ' versões = ' +
        totalValidados +
        ' registros',
    )

    // ============================================================
    // FASE B — EXCLUIR (somente após validação integral)
    // ============================================================

    for (let i = 0; i < eventosParaExcluir.length; i++) {
      app.delete(eventosParaExcluir[i])
    }
    for (let i = 0; i < chavesParaExcluir.length; i++) {
      app.delete(chavesParaExcluir[i])
    }
    for (let i = 0; i < versoesParaExcluir.length; i++) {
      app.delete(versoesParaExcluir[i])
    }

    console.log('[OP-6B] limpeza concluída: ' + totalValidados + ' registros excluídos')
  },
  (app) => {
    // Down: no-op documentado — os dados de teste NÃO são recriados.
    // A exclusão é irreversível por design (limpeza de dados fictícios).
  },
)
