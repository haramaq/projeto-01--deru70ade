/// <reference path="../pb_data/types.d.ts" />
// 0045_regras_versao_rbac.js — Correção RBAC da collection regras_versao (OP-R6.1-RBAC-0045).
//
// CAUSA: a migration 0038 criou regras_versao com TODAS as regras como null
// (somente superusers). O admin/gestor do CRM não consegue LER o histórico
// de versões — a interface R6.1 falha com 403.
//
// CORREÇÃO: definir listRule e viewRule para admin/gestor, usando a MESMA
// sintaxe das regras da collection users (comprovada funcional).
//
// createRule, updateRule e deleteRule permanecem null (somente superusers):
// a gravação é feita exclusivamente via hook regras_publicar.js, que tem
// autenticação, autorização e auditoria próprias.
//
// Migration ADITIVA — não remove nem altera dados, apenas regras de acesso.

migrate(
  (app) => {
    const c = app.findCollectionByNameOrId('regras_versao')
    c.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')"
    c.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')"
    // createRule, updateRule, deleteRule: permanecem null (somente superusers)
    // A gravação é exclusivamente via hook regras_publicar.js (server-side).
    app.save(c)
  },
  (app) => {
    // Down: restaurar as regras originais (null)
    const c = app.findCollectionByNameOrId('regras_versao')
    c.listRule = null
    c.viewRule = null
    app.save(c)
  },
)
