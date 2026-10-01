migrate(
  (app) => {
    const addText = (collection, name, max) => {
      if (!collection.fields.getByName(name)) {
        collection.fields.add(new TextField({ name, required: false, max: max || 255 }))
      }
    }
    const addSelect = (collection, name, values) => {
      if (!collection.fields.getByName(name)) {
        collection.fields.add(new SelectField({ name, required: false, maxSelect: 1, values }))
      }
    }
    const addRelation = (collection, name, collectionId) => {
      if (!collection.fields.getByName(name)) {
        collection.fields.add(
          new RelationField({
            name,
            required: false,
            collectionId,
            cascadeDelete: false,
            minSelect: 0,
            maxSelect: 1,
          }),
        )
      }
    }
    const fill = (record, name, value) => {
      const current = record.get(name)
      if (current === undefined || current === null || current === '') record.set(name, value)
    }

    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    users.listRule = "@request.auth.id != ''"
    users.viewRule = "@request.auth.id != ''"
    users.createRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
    users.updateRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
    users.deleteRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
    app.save(users)

    const clientes = app.findCollectionByNameOrId('clientes')
    addSelect(clientes, 'tipo_cadastro', ['cliente_final', 'revenda'])
    addText(clientes, 'external_id', 120)
    addText(clientes, 'razao_social', 255)
    addText(clientes, 'nome_fantasia', 255)
    addText(clientes, 'documento', 32)
    addSelect(clientes, 'documento_tipo', ['cpf', 'cnpj'])
    addText(clientes, 'inscricao_estadual', 40)
    addText(clientes, 'pais', 80)
    addText(clientes, 'cep', 12)
    addText(clientes, 'bairro', 120)
    addText(clientes, 'rua', 180)
    addText(clientes, 'numero', 30)
    addRelation(clientes, 'responsavel_usuario', '_pb_users_auth_')

    const clientRoles =
      "(@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'triagem' || @request.auth.role = 'vendedor' || @request.auth.role = 'revendedor' || @request.auth.role = 'suporte' || @request.auth.perm_clientes = true)"
    const clientScope =
      "(@request.auth.role = 'admin' || @request.auth.role = 'gestor' || responsavel = @request.auth.id || responsavel_usuario = @request.auth.id || (@request.auth.carteira != '' && carteira = @request.auth.carteira))"
    clientes.listRule = `@request.auth.id != '' && ${clientRoles} && ${clientScope}`
    clientes.viewRule = clientes.listRule
    clientes.createRule = `@request.auth.id != '' && ${clientRoles}`
    clientes.updateRule = `@request.auth.id != '' && ${clientRoles} && ${clientScope}`
    clientes.deleteRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
    app.save(clientes)

    const clientRecords = app.findRecordsByFilter('clientes', '', '-created', 5000, 0)
    for (const record of clientRecords) {
      fill(record, 'tipo_cadastro', 'cliente_final')
      fill(record, 'external_id', '')
      fill(record, 'razao_social', record.get('empresa') || record.get('nome') || '')
      fill(record, 'nome_fantasia', record.get('empresa') || '')
      fill(record, 'documento', record.get('cnpj') || '')
      fill(record, 'documento_tipo', record.get('cnpj') ? 'cnpj' : '')
      fill(record, 'inscricao_estadual', '')
      fill(record, 'pais', 'Brasil')
      fill(record, 'cep', '')
      fill(record, 'bairro', '')
      fill(record, 'rua', '')
      fill(record, 'numero', '')
      if (record.get('responsavel')) record.set('responsavel_usuario', record.get('responsavel'))
      app.save(record)
    }

    const revendas = app.findCollectionByNameOrId('revendas')
    addText(revendas, 'external_id', 120)
    addSelect(revendas, 'tipo_cadastro', ['revenda'])
    addText(revendas, 'razao_social', 255)
    addText(revendas, 'nome_fantasia', 255)
    addText(revendas, 'documento', 32)
    addSelect(revendas, 'documento_tipo', ['cnpj'])
    addText(revendas, 'inscricao_estadual', 40)
    addText(revendas, 'pais', 80)
    addText(revendas, 'cep', 12)
    addText(revendas, 'bairro', 120)
    addText(revendas, 'rua', 180)
    addText(revendas, 'numero', 30)
    addText(revendas, 'responsavel', 40)
    addText(revendas, 'carteira', 120)
    addRelation(revendas, 'responsavel_usuario', '_pb_users_auth_')

    const revendaScope =
      "(@request.auth.role = 'admin' || @request.auth.role = 'gestor' || responsavel = @request.auth.id || responsavel_usuario = @request.auth.id || (@request.auth.carteira != '' && carteira = @request.auth.carteira) || (responsavel = '' && carteira = ''))"
    revendas.listRule = `@request.auth.id != '' && ${clientRoles} && ${revendaScope}`
    revendas.viewRule = revendas.listRule
    revendas.createRule = `@request.auth.id != '' && ${clientRoles}`
    revendas.updateRule = `@request.auth.id != '' && ${clientRoles} && ${revendaScope}`
    revendas.deleteRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
    app.save(revendas)

    const resellerRecords = app.findRecordsByFilter('revendas', '', '-created', 5000, 0)
    for (const record of resellerRecords) {
      fill(record, 'external_id', '')
      fill(record, 'tipo_cadastro', 'revenda')
      fill(record, 'razao_social', record.get('nome') || '')
      fill(record, 'nome_fantasia', '')
      fill(record, 'documento', record.get('cnpj') || '')
      fill(record, 'documento_tipo', 'cnpj')
      fill(record, 'inscricao_estadual', '')
      fill(record, 'pais', 'Brasil')
      fill(record, 'cep', '')
      fill(record, 'bairro', '')
      fill(record, 'rua', '')
      fill(record, 'numero', '')
      fill(record, 'responsavel', '')
      fill(record, 'carteira', '')
      app.save(record)
    }

    const vendas = app.findCollectionByNameOrId('vendas')
    const restrictedRoles =
      "(@request.auth.role = 'admin' || @request.auth.role = 'triagem' || @request.auth.role = 'suporte')"
    const unrestrictedStage =
      "(etapa != 'pecas_pos_vendas' && etapa != 'financeiro_fiscal' && etapa != 'fornecedores')"
    const unrestrictedBodyStage =
      "(@request.body.etapa != 'pecas_pos_vendas' && @request.body.etapa != 'financeiro_fiscal' && @request.body.etapa != 'fornecedores')"
    const leadOperators =
      "(@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'triagem' || @request.auth.role = 'vendedor' || @request.auth.role = 'revendedor' || @request.auth.role = 'suporte' || @request.auth.perm_leads = true)"
    const leadScope =
      "((@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'suporte') || vendedor = @request.auth.id || (@request.auth.carteira != '' && carteira = @request.auth.carteira))"
    vendas.listRule = `@request.auth.id != '' && ${leadOperators} && ${leadScope} && (${restrictedRoles} || ${unrestrictedStage})`
    vendas.viewRule = vendas.listRule
    vendas.createRule = `@request.auth.id != '' && (${leadOperators}) && (${restrictedRoles} || ${unrestrictedBodyStage}) && ((@request.auth.role = 'admin' || @request.auth.role = 'gestor') || @request.body.vendedor = @request.auth.id || (@request.auth.carteira != '' && @request.body.carteira = @request.auth.carteira))`
    vendas.updateRule = `@request.auth.id != '' && ${leadOperators} && (${restrictedRoles} || (${unrestrictedStage} && ${unrestrictedBodyStage})) && ${leadScope}`
    vendas.deleteRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')"
    app.save(vendas)

    const history = app.findCollectionByNameOrId('lead_historico')
    addText(history, 'tipo_evento', 60)
    addRelation(history, 'usuario_origem', '_pb_users_auth_')
    addRelation(history, 'usuario_destino', '_pb_users_auth_')
    const historyVisibility =
      "((@request.auth.role = 'admin' || @request.auth.role = 'gestor') || (@request.auth.role = 'triagem' || @request.auth.role = 'suporte') || (lead_id.vendedor = @request.auth.id || (@request.auth.carteira != '' && lead_id.carteira = @request.auth.carteira)))"
    const transferCreate =
      "(@request.body.tipo_evento = 'transferencia' && @request.body.usuario_origem = @request.auth.id)"
    history.listRule = `@request.auth.id != '' && ${historyVisibility} && (${restrictedRoles} || ${unrestrictedStage.replace(/etapa/g, 'lead_id.etapa')})`
    history.viewRule = history.listRule
    history.createRule = `@request.auth.id != '' && (${historyVisibility} || ${transferCreate})`
    history.updateRule = ''
    history.deleteRule = ''
    app.save(history)

    const audit = app.findCollectionByNameOrId('auditoria_acesso')
    audit.listRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
    audit.viewRule = audit.listRule
    audit.createRule = "@request.auth.id != ''"
    audit.updateRule = ''
    audit.deleteRule = ''
    app.save(audit)
  },
  (app) => {},
)
