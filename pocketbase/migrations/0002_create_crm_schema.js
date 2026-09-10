migrate(
  (app) => {
    // 1. Add role field to users collection
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    if (!users.fields.getByName('role')) {
      users.fields.add(
        new SelectField({
          name: 'role',
          values: ['admin', 'vendedor', 'suporte'],
          maxSelect: 1,
          required: false,
        }),
      )
      users.addIndex('idx_users_role', false, 'role', '')
      app.save(users)
    }

    // Set existing admin user role to 'admin'
    try {
      const adminUser = app.findAuthRecordByEmail(
        '_pb_users_auth_',
        'elisandrodesousaharamaq@gmail.com',
      )
      adminUser.set('role', 'admin')
      app.save(adminUser)
    } catch (_) {}

    // 2. Create clientes collection
    try {
      app.findCollectionByNameOrId('clientes')
    } catch (_) {
      const clientes = new Collection({
        name: 'clientes',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'vendedor')",
        updateRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'vendedor')",
        deleteRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'vendedor')",
        fields: [
          { name: 'nome', type: 'text', required: true },
          { name: 'empresa', type: 'text' },
          { name: 'cnpj', type: 'text' },
          { name: 'email', type: 'email' },
          { name: 'telefone', type: 'text' },
          { name: 'cidade', type: 'text' },
          { name: 'estado', type: 'text' },
          { name: 'status', type: 'select', values: ['ativo', 'inativo'], maxSelect: 1 },
          { name: 'observacoes', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_clientes_cidade ON clientes (cidade)',
          'CREATE INDEX idx_clientes_status ON clientes (status)',
        ],
      })
      app.save(clientes)
    }

    // 3. Create revendas collection
    try {
      app.findCollectionByNameOrId('revendas')
    } catch (_) {
      const revendas = new Collection({
        name: 'revendas',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        fields: [
          { name: 'nome', type: 'text', required: true },
          { name: 'cnpj', type: 'text' },
          { name: 'cidade', type: 'text' },
          { name: 'estado', type: 'text' },
          { name: 'telefone', type: 'text' },
          { name: 'contato_principal', type: 'text' },
          { name: 'email', type: 'email' },
          { name: 'modelos', type: 'select', values: ['PROHMIX', 'SUPERMIX'], maxSelect: 2 },
          { name: 'status', type: 'select', values: ['autorizada', 'pendente'], maxSelect: 1 },
          { name: 'observacoes', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
      })
      app.save(revendas)
    }

    // 4. Create vendas collection
    const clientesCol = app.findCollectionByNameOrId('clientes')
    try {
      app.findCollectionByNameOrId('vendas')
    } catch (_) {
      const vendas = new Collection({
        name: 'vendas',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'vendedor')",
        updateRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'vendedor')",
        deleteRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'vendedor')",
        fields: [
          {
            name: 'cliente',
            type: 'relation',
            collectionId: clientesCol.id,
            cascadeDelete: false,
            maxSelect: 1,
            required: true,
          },
          {
            name: 'produto',
            type: 'select',
            values: ['PROHMIX', 'SUPERMIX'],
            maxSelect: 1,
            required: true,
          },
          { name: 'valor', type: 'number', min: 0 },
          {
            name: 'etapa',
            type: 'select',
            values: ['prospeccao', 'orcamento', 'negociacao', 'fechamento'],
            maxSelect: 1,
            required: true,
          },
          { name: 'probabilidade', type: 'number', min: 0, max: 100 },
          { name: 'data_prevista_fechamento', type: 'date' },
          {
            name: 'vendedor',
            type: 'relation',
            collectionId: '_pb_users_auth_',
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'proxima_acao', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_vendas_etapa ON vendas (etapa)',
          'CREATE INDEX idx_vendas_cliente ON vendas (cliente)',
        ],
      })
      app.save(vendas)
    }

    // 5. Create tickets collection
    try {
      app.findCollectionByNameOrId('tickets')
    } catch (_) {
      const tickets = new Collection({
        name: 'tickets',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'suporte')",
        updateRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'suporte')",
        deleteRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'suporte')",
        fields: [
          {
            name: 'cliente',
            type: 'relation',
            collectionId: clientesCol.id,
            cascadeDelete: false,
            maxSelect: 1,
            required: true,
          },
          { name: 'assunto', type: 'text', required: true },
          { name: 'descricao', type: 'text' },
          {
            name: 'prioridade',
            type: 'select',
            values: ['baixa', 'media', 'alta'],
            maxSelect: 1,
            required: true,
          },
          {
            name: 'status',
            type: 'select',
            values: ['aberto', 'finalizado', 'fechado'],
            maxSelect: 1,
            required: true,
          },
          {
            name: 'atribuido_a',
            type: 'relation',
            collectionId: '_pb_users_auth_',
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'respostas', type: 'json' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_tickets_status ON tickets (status)'],
      })
      app.save(tickets)
    }
  },
  (app) => {
    try {
      const t = app.findCollectionByNameOrId('tickets')
      app.delete(t)
    } catch (_) {}
    try {
      const v = app.findCollectionByNameOrId('vendas')
      app.delete(v)
    } catch (_) {}
    try {
      const r = app.findCollectionByNameOrId('revendas')
      app.delete(r)
    } catch (_) {}
    try {
      const c = app.findCollectionByNameOrId('clientes')
      app.delete(c)
    } catch (_) {}
    try {
      const users = app.findCollectionByNameOrId('_pb_users_auth_')
      users.fields.removeByName('role')
      users.removeIndex('idx_users_role')
      app.save(users)
    } catch (_) {}
  },
)
