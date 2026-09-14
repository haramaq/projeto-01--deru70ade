migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const vendas = app.findCollectionByNameOrId('vendas')
    const addBool = (collection, name) => {
      if (!collection.fields.getByName(name)) collection.fields.add(new BoolField({ name, required: false }))
    }
    const addText = (collection, name, max = 120) => {
      if (!collection.fields.getByName(name)) collection.fields.add(new TextField({ name, required: false, max }))
    }
    ;['perm_dashboard', 'perm_leads', 'perm_clientes', 'perm_revendas', 'perm_suporte', 'perm_relatorios', 'perm_configuracoes'].forEach((name) => addBool(users, name))
    addText(vendas, 'carteira')
    const leads = app.findRecordsByFilter('vendas', '', '-created', 1000, 0)
    for (const lead of leads) {
      if (lead.get('carteira')) continue
      const vendedorId = lead.get('vendedor')
      if (vendedorId) {
        try {
          const vendedor = app.findRecordById('_pb_users_auth_', vendedorId)
          if (vendedor.get('carteira')) { lead.set('carteira', vendedor.get('carteira')); app.save(lead); continue }
        } catch (_) {}
      }
      const clienteId = lead.get('cliente')
      if (clienteId) {
        try {
          const cliente = app.findRecordById('clientes', clienteId)
          if (cliente.get('carteira')) { lead.set('carteira', cliente.get('carteira')); app.save(lead) }
        } catch (_) {}
      }
    }
    const authenticated = "@request.auth.id != ''"
    const adminOrManager = "(@request.auth.role = 'admin' || @request.auth.role = 'gestor')"
    const leadOperators = "(@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'triagem' || @request.auth.role = 'vendedor' || @request.auth.role = 'revendedor' || @request.auth.role = 'suporte' || @request.auth.perm_leads = true)"
    const fullLeadAccess = "(@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'suporte')"
    const leadScope = `(${fullLeadAccess} || vendedor = @request.auth.id || (@request.auth.carteira != '' && carteira = @request.auth.carteira))`
    users.listRule = `${authenticated} && ${adminOrManager}`
    users.viewRule = `${authenticated} && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || id = @request.auth.id)`
    users.createRule = `${authenticated} && @request.auth.role = 'admin'`
    users.updateRule = `${authenticated} && @request.auth.role = 'admin'`
    users.deleteRule = `${authenticated} && @request.auth.role = 'admin'`
    app.save(users)
    vendas.listRule = `${authenticated} && ${leadOperators} && ${leadScope}`
    vendas.viewRule = vendas.listRule
    vendas.createRule = `${authenticated} && (${adminOrManager} || @request.auth.role = 'triagem' || @request.auth.role = 'vendedor' || @request.auth.role = 'revendedor' || @request.auth.perm_leads = true) && (${adminOrManager} || @request.body.vendedor = @request.auth.id || (@request.auth.carteira != '' && @request.body.carteira = @request.auth.carteira))`
    vendas.updateRule = `${authenticated} && (${adminOrManager} || @request.auth.perm_leads = true || @request.auth.role = 'triagem' || @request.auth.role = 'vendedor' || @request.auth.role = 'revendedor') && (${adminOrManager} || vendedor = @request.auth.id || (@request.auth.carteira != '' && carteira = @request.auth.carteira))`
    vendas.deleteRule = `${authenticated} && ${adminOrManager}`
    app.save(vendas)
    try {
      const history = app.findCollectionByNameOrId('lead_historico')
      history.listRule = `${authenticated} && (${adminOrManager} || lead_id.vendedor = @request.auth.id || (@request.auth.carteira != '' && lead_id.carteira = @request.auth.carteira))`
      history.viewRule = history.listRule; history.createRule = history.listRule; history.updateRule = ''; history.deleteRule = ''; app.save(history)
    } catch (_) {}
    try {
      const tasks = app.findCollectionByNameOrId('lead_tarefas')
      tasks.listRule = `${authenticated} && (${adminOrManager} || lead_id.vendedor = @request.auth.id || (@request.auth.carteira != '' && lead_id.carteira = @request.auth.carteira))`
      tasks.viewRule = tasks.listRule; tasks.createRule = tasks.listRule; tasks.updateRule = tasks.listRule; tasks.deleteRule = `${authenticated} && ${adminOrManager}`; app.save(tasks)
    } catch (_) {}
    const clientes = app.findCollectionByNameOrId('clientes')
    const revendas = app.findCollectionByNameOrId('revendas')
    const tickets = app.findCollectionByNameOrId('tickets')
    const clientScope = `(${adminOrManager} || ((@request.auth.role = 'triagem' || @request.auth.role = 'vendedor' || @request.auth.role = 'revendedor' || @request.auth.role = 'suporte' || @request.auth.perm_clientes = true) && (responsavel = @request.auth.id || (@request.auth.carteira != '' && carteira = @request.auth.carteira))))`
    clientes.listRule = `${authenticated} && ${clientScope}`; clientes.viewRule = clientes.listRule; clientes.createRule = `${authenticated} && (${adminOrManager} || @request.auth.role = 'triagem' || @request.auth.role = 'vendedor' || @request.auth.role = 'revendedor' || @request.auth.perm_clientes = true)`; clientes.updateRule = `${authenticated} && ${clientScope}`; clientes.deleteRule = `${authenticated} && @request.auth.role = 'admin'`; app.save(clientes)
    revendas.listRule = `${authenticated} && (@request.auth.role = 'admin' || @request.auth.role = 'vendedor' || @request.auth.perm_revendas = true)`; revendas.viewRule = revendas.listRule; revendas.createRule = `${authenticated} && (@request.auth.role = 'admin' || @request.auth.perm_revendas = true)`; revendas.updateRule = revendas.createRule; revendas.deleteRule = `${authenticated} && @request.auth.role = 'admin'`; app.save(revendas)
    tickets.listRule = `${authenticated} && (@request.auth.role = 'admin' || @request.auth.role = 'suporte' || @request.auth.perm_suporte = true)`; tickets.viewRule = tickets.listRule; tickets.createRule = tickets.listRule; tickets.updateRule = tickets.listRule; tickets.deleteRule = `${authenticated} && @request.auth.role = 'admin'`; app.save(tickets)
    const audit = app.findCollectionByNameOrId('auditoria_acesso')
    audit.listRule = `${authenticated} && @request.auth.role = 'admin'`; audit.viewRule = audit.listRule; audit.createRule = audit.listRule; audit.updateRule = ''; audit.deleteRule = ''; app.save(audit)
  },
  (app) => {},
)
