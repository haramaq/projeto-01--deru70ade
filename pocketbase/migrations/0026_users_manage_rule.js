// 0026 — manageRule administrativa para a collection users.
// Permite ao admin autenticado VER o e-mail de usuários com emailVisibility=false
// e GERENCIAR credenciais (senha provisória, emailVisibility) pelo painel.
// NÃO altera emailVisibility, listRule, viewRule, createRule, updateRule ou deleteRule.
// NOTA JSVM: constantes declaradas DENTRO do callback do migrate — helpers/constantes
// do escopo do arquivo não são visíveis no runtime Goja do PocketBase (runbook Goja).
// Rollback: restaura o valor anterior da regra. O valor anterior verificado no ambiente
// de origem (leitura indireta) foi null; confirmar na aplicação real antes de aplicar.
migrate(
  (app) => {
    const MANAGE_RULE = "@request.auth.id != '' && @request.auth.role = 'admin'"
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    if (users.manageRule !== MANAGE_RULE) {
      users.manageRule = MANAGE_RULE
      app.save(users)
    }
  },
  (app) => {
    const PREVIOUS_MANAGE_RULE = null
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    users.manageRule = PREVIOUS_MANAGE_RULE
    app.save(users)
  },
)
