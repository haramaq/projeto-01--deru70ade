migrate(
  (app) => {
    const revendas = app.findCollectionByNameOrId('revendas')
    const authenticated = "@request.auth.id != ''"
    const access =
      "(@request.auth.role = 'admin' || @request.auth.role = 'vendedor' || @request.auth.perm_revendas = true)"
    const scope =
      "(@request.auth.role = 'admin' || @request.auth.role = 'gestor' || responsavel = @request.auth.id || responsavel_usuario = @request.auth.id || (@request.auth.carteira != '' && carteira = @request.auth.carteira) || (responsavel = '' && carteira = ''))"
    revendas.listRule = `${authenticated} && ${access} && ${scope}`
    revendas.viewRule = revendas.listRule
    revendas.createRule = `${authenticated} && (@request.auth.role = 'admin' || @request.auth.perm_revendas = true)`
    revendas.updateRule = `${authenticated} && (@request.auth.role = 'admin' || @request.auth.perm_revendas = true) && ${scope}`
    revendas.deleteRule = `${authenticated} && @request.auth.role = 'admin'`
    app.save(revendas)
  },
  (app) => {},
)
