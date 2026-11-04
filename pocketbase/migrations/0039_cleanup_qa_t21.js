/// <reference path="../pb_data/types.d.ts" />
// T2.1 / OP-6 — Limpeza dos 2 registros de teste criados no OP-4 mínimo (04/11).
// ESCOPO EXCLUSIVO: os 2 IDs especificados pelo responsável. Nada mais é tocado.
// - idempotency_keys: et824wyvv5ewn6s (idempotency_key = QA-T21-OP4-1793795046)
// - eventos_negocio: 1alb9107jbboqqa (correlation_id = QA-T21-OP4-1793795046)
// regras_versao: NÃO tocada (permanece vazia).
//
// CORREÇÕES da revisão final (04/11):
// 1. findRecordById distingue 'não encontrado' (sql: no rows) de outros erros.
// 2. Sem catch genérico: erros inesperados propagam (a migration falha e o apply
//    é revertido — nada é aplicado).
// 3. Validação PRÉVIA de TODOS os registros antes de iniciar qualquer exclusão.
// 4. Comportamento idempotente: registro já ausente = sem efeito (não é erro).
// 5. Down: no-op documentado — os dados de teste NÃO são recriados.
//
// Semântica transacional PocketBase 0.36: o apply_changes executa todas as
// migrations pendentes em UMA transação — se qualquer migration falhar, nada é
// aplicado (comportamento documentado pela plataforma).

migrate(
  (app) => {
    const alvos = [
      {
        colecao: 'idempotency_keys',
        id: 'et824wyvv5ewn6s',
        campoChave: 'idempotency_key',
        valorChave: 'QA-T21-OP4-1793795046',
      },
      {
        colecao: 'eventos_negocio',
        id: '1alb9107jbboqqa',
        campoChave: 'correlation_id',
        valorChave: 'QA-T21-OP4-1793795046',
      },
    ]

    const isNotFound = (err) => /no rows/i.test(String(err))

    // ---------- FASE 1: localizar e validar TODOS antes de qualquer exclusão ----------
    const encontrados = []
    for (let i = 0; i < alvos.length; i++) {
      const alvo = alvos[i]
      let rec = null
      try {
        rec = app.findRecordById(alvo.colecao, alvo.id)
      } catch (err) {
        if (isNotFound(err)) {
          continue // idempotente: registro já ausente — sem efeito, não é erro
        }
        throw err // erro real de banco: propaga (a migration falha, nada é aplicado)
      }
      encontrados.push({ alvo: alvo, rec: rec })
    }

    // ---------- FASE 2: validar TODOS os identificadores QA ----------
    for (let i = 0; i < encontrados.length; i++) {
      const { alvo, rec } = encontrados[i]
      const chaveAtual = String(rec.get(alvo.campoChave) || '')
      if (chaveAtual !== alvo.valorChave) {
        throw new Error(
          'DIVERGENCIA_QA: ' +
            alvo.colecao +
            '/' +
            alvo.id +
            ' esperado [' +
            alvo.valorChave +
            '] encontrado [' +
            chaveAtual +
            ']',
        )
      }
      if (chaveAtual.indexOf('QA-T21-OP4-') !== 0) {
        throw new Error('DIVERGENCIA_QA_PREFIXO: ' + alvo.colecao + '/' + alvo.id)
      }
    }

    // ---------- FASE 3: excluir (somente após validação integral) ----------
    for (let i = 0; i < encontrados.length; i++) {
      app.delete(encontrados[i].rec)
    }
  },
  (app) => {
    // Down: no-op documentado — os dados de teste NÃO são recriados.
    // A exclusão é irreversível por design (limpeza de dados fictícios).
  },
)
