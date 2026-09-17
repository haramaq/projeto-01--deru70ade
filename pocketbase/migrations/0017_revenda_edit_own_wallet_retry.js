migrate(
  (app) => {
    const revendas = app.findCollectionByNameOrId('revendas')
    const authenticated = "@request.auth.id != ''"
    const access =
      "(@request.auth.role = 'admin' || @request.auth.role = 'vendedor' || @request.auth.perm_revendas = true)"
    const ownScope =
      "(@request.auth.role = 'admin' || responsavel = @request.auth.id || responsavel_usuario = @request.auth.id || (@request.auth.carteira != '' && carteira = @request.auth.carteira))"
    revendas.updateRule = `${authenticated} && ${access} && ${ownScope}`
    app.save(revendas)
  },
  (app) => {},
)
