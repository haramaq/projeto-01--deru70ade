migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const role = users.fields.getByName('role')
    if (role) {
      role.values = ['admin', 'triagem', 'vendedor', 'revendedor', 'gestor', 'suporte']
      app.save(users)
    }
    if (!users.fields.getByName('ativo'))
      users.fields.add(new BoolField({ name: 'ativo', required: false }))
    if (!users.fields.getByName('carteira'))
      users.fields.add(new TextField({ name: 'carteira', required: false, max: 120 }))
    users.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')"
    users.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || id = @request.auth.id)"
    users.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')"
    users.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')"
    users.deleteRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
    app.save(users)

    const clientes = app.findCollectionByNameOrId('clientes')
    if (!clientes.fields.getByName('responsavel'))
      clientes.fields.add(new TextField({ name: 'responsavel', required: false, max: 40 }))
    if (!clientes.fields.getByName('carteira'))
      clientes.fields.add(new TextField({ name: 'carteira', required: false, max: 120 }))
    clientes.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || responsavel = @request.auth.id || carteira = @request.auth.carteira)"
    clientes.viewRule = clientes.listRule
    clientes.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'triagem' || @request.auth.role = 'vendedor' || @request.auth.role = 'revendedor')"
    clientes.updateRule = clientes.listRule
    clientes.deleteRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')"
    app.save(clientes)

    try {
      app.findCollectionByNameOrId('auditoria_acesso')
    } catch (_) {
      const audit = new Collection({
        name: 'auditoria_acesso',
        type: 'base',
        listRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')",
        viewRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')",
        createRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')",
        updateRule: '',
        deleteRule: '',
        fields: [
          { name: 'autor', type: 'text', required: true },
          { name: 'alvo', type: 'text', required: true },
          { name: 'acao', type: 'text', required: true },
          { name: 'antes', type: 'json' },
          { name: 'depois', type: 'json' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        ],
      })
      app.save(audit)
    }
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('auditoria_acesso'))
    } catch (_) {}
  },
)
