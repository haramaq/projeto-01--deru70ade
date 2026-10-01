migrate(
  (app) => {
    const adminOnly = "@request.auth.id != '' && @request.auth.role = 'admin'"

    const addText = (collection, name, max = 255) => {
      if (!collection.fields.getByName(name)) {
        collection.fields.add(new TextField({ name, required: false, max }))
      }
    }
    const addNumber = (collection, name) => {
      if (!collection.fields.getByName(name)) {
        collection.fields.add(new NumberField({ name, required: false, min: 0 }))
      }
    }
    const addDate = (collection, name) => {
      if (!collection.fields.getByName(name)) {
        collection.fields.add(new DateField({ name, required: false }))
      }
    }
    const addSelect = (collection, name, values) => {
      if (!collection.fields.getByName(name)) {
        collection.fields.add(new SelectField({ name, required: false, maxSelect: 1, values }))
      }
    }
    const addRelation = (collection, name, collectionId, required = true) => {
      if (!collection.fields.getByName(name)) {
        collection.fields.add(
          new RelationField({
            name,
            required,
            collectionId,
            cascadeDelete: true,
            minSelect: required ? 1 : 0,
            maxSelect: 1,
          }),
        )
      }
    }
    const addFile = (collection, name) => {
      if (!collection.fields.getByName(name)) {
        collection.fields.add(
          new FileField({
            name,
            required: false,
            maxSelect: 1,
            maxSize: 20 * 1024 * 1024,
            protected: true,
            mimeTypes: [
              'application/pdf',
              'text/plain',
              'text/csv',
              'application/json',
              'application/vnd.ms-excel',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              'image/jpeg',
              'image/png',
            ],
          }),
        )
      }
    }
    const applyAdminRules = (collection) => {
      collection.listRule = adminOnly
      collection.viewRule = adminOnly
      collection.createRule = adminOnly
      collection.updateRule = adminOnly
      collection.deleteRule = adminOnly
      app.save(collection)
    }

    let feiras
    try {
      feiras = app.findCollectionByNameOrId('feiras')
    } catch (_) {
      feiras = new Collection({
        name: 'feiras',
        type: 'base',
        listRule: adminOnly,
        viewRule: adminOnly,
        createRule: adminOnly,
        updateRule: adminOnly,
        deleteRule: adminOnly,
        fields: [
          { name: 'nome', type: 'text', required: true },
          { name: 'edicao', type: 'text' },
          { name: 'cidade', type: 'text' },
          { name: 'estado', type: 'text' },
          { name: 'local', type: 'text' },
          { name: 'organizador', type: 'text' },
          { name: 'data_inicio', type: 'date' },
          { name: 'data_fim', type: 'date' },
          { name: 'ano', type: 'number', min: 2000, max: 2200, required: true },
          {
            name: 'status',
            type: 'select',
            values: ['planejada', 'em_andamento', 'concluida', 'cancelada'],
            maxSelect: 1,
            required: true,
          },
          { name: 'descricao', type: 'text' },
          { name: 'observacoes', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_feiras_ano ON feiras (ano)',
          'CREATE INDEX idx_feiras_status ON feiras (status)',
        ],
      })
      app.save(feiras)
    }
    addText(feiras, 'nome', 255)
    addText(feiras, 'edicao', 120)
    addText(feiras, 'cidade', 120)
    addText(feiras, 'estado', 2)
    addText(feiras, 'local', 255)
    addText(feiras, 'organizador', 255)
    addDate(feiras, 'data_inicio')
    addDate(feiras, 'data_fim')
    addNumber(feiras, 'ano')
    addSelect(feiras, 'status', ['planejada', 'em_andamento', 'concluida', 'cancelada'])
    addText(feiras, 'descricao', 4000)
    addText(feiras, 'observacoes', 4000)
    applyAdminRules(feiras)

    let custos
    try {
      custos = app.findCollectionByNameOrId('feira_custos')
    } catch (_) {
      custos = new Collection({
        name: 'feira_custos',
        type: 'base',
        listRule: adminOnly,
        viewRule: adminOnly,
        createRule: adminOnly,
        updateRule: adminOnly,
        deleteRule: adminOnly,
        fields: [
          {
            name: 'feira',
            type: 'relation',
            collectionId: feiras.id,
            cascadeDelete: true,
            maxSelect: 1,
            required: true,
          },
          {
            name: 'categoria',
            type: 'select',
            values: [
              'locacao_terreno',
              'estrutura_estande',
              'alimentacao',
              'bebida',
              'hospedagem',
              'deslocamento',
              'logistica_maquinas',
              'relatorios_equipe_comercial',
              'outros',
            ],
            maxSelect: 1,
            required: true,
          },
          { name: 'descricao', type: 'text' },
          { name: 'fornecedor', type: 'text' },
          { name: 'data_custo', type: 'date' },
          { name: 'valor_estimado', type: 'number', min: 0 },
          { name: 'valor_realizado', type: 'number', min: 0 },
          { name: 'observacoes', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_feira_custos_feira ON feira_custos (feira)',
          'CREATE INDEX idx_feira_custos_categoria ON feira_custos (categoria)',
        ],
      })
      app.save(custos)
    }
    addRelation(custos, 'feira', feiras.id)
    addSelect(custos, 'categoria', [
      'locacao_terreno',
      'estrutura_estande',
      'alimentacao',
      'bebida',
      'hospedagem',
      'deslocamento',
      'logistica_maquinas',
      'relatorios_equipe_comercial',
      'outros',
    ])
    addText(custos, 'descricao', 255)
    addText(custos, 'fornecedor', 255)
    addDate(custos, 'data_custo')
    addNumber(custos, 'valor_estimado')
    addNumber(custos, 'valor_realizado')
    addText(custos, 'observacoes', 2000)
    applyAdminRules(custos)

    let resultados
    try {
      resultados = app.findCollectionByNameOrId('feira_resultados')
    } catch (_) {
      resultados = new Collection({
        name: 'feira_resultados',
        type: 'base',
        listRule: adminOnly,
        viewRule: adminOnly,
        createRule: adminOnly,
        updateRule: adminOnly,
        deleteRule: adminOnly,
        fields: [
          {
            name: 'feira',
            type: 'relation',
            collectionId: feiras.id,
            cascadeDelete: true,
            maxSelect: 1,
            required: true,
          },
          { name: 'cliente', type: 'text' },
          { name: 'produto', type: 'text' },
          { name: 'quantidade', type: 'number', min: 0 },
          { name: 'valor_venda', type: 'number', min: 0 },
          { name: 'data_resultado', type: 'date' },
          {
            name: 'tipo_resultado',
            type: 'select',
            values: ['venda_realizada', 'proposta', 'lead_gerado'],
            maxSelect: 1,
            required: true,
          },
          { name: 'observacoes', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_feira_resultados_feira ON feira_resultados (feira)',
          'CREATE INDEX idx_feira_resultados_tipo ON feira_resultados (tipo_resultado)',
        ],
      })
      app.save(resultados)
    }
    addRelation(resultados, 'feira', feiras.id)
    addText(resultados, 'cliente', 255)
    addText(resultados, 'produto', 160)
    addNumber(resultados, 'quantidade')
    addNumber(resultados, 'valor_venda')
    addDate(resultados, 'data_resultado')
    addSelect(resultados, 'tipo_resultado', ['venda_realizada', 'proposta', 'lead_gerado'])
    addText(resultados, 'observacoes', 2000)
    applyAdminRules(resultados)

    let arquivos
    try {
      arquivos = app.findCollectionByNameOrId('feira_arquivos')
    } catch (_) {
      arquivos = new Collection({
        name: 'feira_arquivos',
        type: 'base',
        listRule: adminOnly,
        viewRule: adminOnly,
        createRule: adminOnly,
        updateRule: adminOnly,
        deleteRule: adminOnly,
        fields: [
          {
            name: 'feira',
            type: 'relation',
            collectionId: feiras.id,
            cascadeDelete: true,
            maxSelect: 1,
            required: true,
          },
          {
            name: 'arquivo',
            type: 'file',
            maxSelect: 1,
            maxSize: 20 * 1024 * 1024,
            protected: true,
            mimeTypes: [
              'application/pdf',
              'text/plain',
              'text/csv',
              'application/json',
              'application/vnd.ms-excel',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              'image/jpeg',
              'image/png',
            ],
          },
          { name: 'nome_arquivo', type: 'text', required: true },
          {
            name: 'tipo_arquivo',
            type: 'select',
            values: ['relatorio', 'comprovante', 'nota_fiscal', 'outro'],
            maxSelect: 1,
            required: true,
          },
          {
            name: 'leitura_status',
            type: 'select',
            values: ['processado', 'revisao_manual', 'erro'],
            maxSelect: 1,
            required: true,
          },
          { name: 'texto_extraido', type: 'text', max: 100000 },
          { name: 'dados_extraidos', type: 'json' },
          { name: 'total_custo_extraido', type: 'number', min: 0 },
          { name: 'custos_importados', type: 'number', min: 0 },
          { name: 'observacoes', type: 'text', max: 2000 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_feira_arquivos_feira ON feira_arquivos (feira)'],
      })
      app.save(arquivos)
    }
    addRelation(arquivos, 'feira', feiras.id)
    addFile(arquivos, 'arquivo')
    addText(arquivos, 'nome_arquivo', 255)
    addSelect(arquivos, 'tipo_arquivo', ['relatorio', 'comprovante', 'nota_fiscal', 'outro'])
    addSelect(arquivos, 'leitura_status', ['processado', 'revisao_manual', 'erro'])
    addText(arquivos, 'texto_extraido', 100000)
    if (!arquivos.fields.getByName('dados_extraidos'))
      arquivos.fields.add(new JSONField({ name: 'dados_extraidos', required: false }))
    addNumber(arquivos, 'total_custo_extraido')
    addNumber(arquivos, 'custos_importados')
    addText(arquivos, 'observacoes', 2000)
    applyAdminRules(arquivos)
  },
  (app) => {
    for (const name of ['feira_arquivos', 'feira_resultados', 'feira_custos', 'feiras']) {
      try {
        app.delete(app.findCollectionByNameOrId(name))
      } catch (_) {}
    }
  },
)
