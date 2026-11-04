/// <reference path="../pb_data/types.d.ts" />
// T2.2-T4-B9 — Liberação controlada do RBAC de qualificacao_respostas.
// ESCOPO: altera exclusivamente createRule e updateRule. Nada mais é tocado.
//
// createRule: liberada para perfis autorizados (com validação do hook CREATE)
// updateRule: liberada para perfis autorizados (com validação do hook UPDATE)
// deleteRule: MANTIDA null (só admin)
// listRule/viewRule: INALTERADAS (isolamento por carteira)
//
// Down: restaura createRule=null, updateRule=null (bloqueio preventivo).

migrate(
  (app) => {
    const c = app.findCollectionByNameOrId('qualificacao_respostas')
    c.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'triagem' || @request.auth.role = 'suporte' || lead_id.vendedor = @request.auth.id)"
    c.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'triagem' || @request.auth.role = 'suporte' || lead_id.vendedor = @request.auth.id)"
    app.save(c)
  },
  (app) => {
    const c = app.findCollectionByNameOrId('qualificacao_respostas')
    c.createRule = null
    c.updateRule = null
    app.save(c)
  },
)
