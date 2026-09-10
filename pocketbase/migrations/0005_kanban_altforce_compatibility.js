migrate(
  (app) => {
    const vendas = app.findCollectionByNameOrId('vendas')
    const clientes = app.findCollectionByNameOrId('clientes')

    const addText = (collection, name, max = 255) => {
      if (!collection.fields.getByName(name))
        collection.fields.add(new TextField({ name, required: false, max }))
    }
    const addJson = (collection, name) => {
      if (!collection.fields.getByName(name))
        collection.fields.add(new JSONField({ name, required: false }))
    }

    // Canonical internal keys stay stable; Altforce identifiers are kept separately
    // so a future adapter can map records without changing the CRM contract.
    addText(vendas, 'origem')
    addText(vendas, 'altforce_id')
    addText(vendas, 'altforce_stage_id')
    addText(vendas, 'altforce_stage_name')
    addText(vendas, 'altforce_sync_status')
    addText(vendas, 'altforce_last_synced_at')
    addJson(vendas, 'altforce_payload')
    addJson(vendas, 'campos_customizados')

    addText(clientes, 'origem')
    addText(clientes, 'altforce_id')
    addText(clientes, 'altforce_sync_status')
    addText(clientes, 'altforce_last_synced_at')
    addJson(clientes, 'altforce_payload')
    addJson(clientes, 'campos_customizados')

    const etapaValues = [
      'prospeccao',
      'orcamento',
      'negociacao',
      'fechamento',
      'pecas_pos_vendas',
      'financeiro_fiscal',
    ]
    const etapa = vendas.fields.getByName('etapa')
    if (etapa) {
      etapa.values = etapaValues
      app.save(vendas)
    }

    try {
      app.findCollectionByNameOrId('kanban_etapas')
    } catch (_) {
      const etapas = new Collection({
        name: 'kanban_etapas',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')",
        updateRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')",
        deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        fields: [
          { name: 'chave', type: 'text', required: true },
          { name: 'nome', type: 'text', required: true },
          { name: 'ordem', type: 'number', required: true },
          { name: 'ativa', type: 'bool', required: false },
          { name: 'altforce_stage_id', type: 'text', required: false },
          { name: 'altforce_stage_name', type: 'text', required: false },
          { name: 'altforce_step_model_id', type: 'text', required: false },
          { name: 'fluxo', type: 'text', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_kanban_etapas_chave ON kanban_etapas (chave)'],
      })
      app.save(etapas)

      const seeds = [
        ['prospeccao', 'Prospecção', 1],
        ['orcamento', 'Orçamento', 2],
        ['negociacao', 'Negociação', 3],
        ['fechamento', 'Fechamento', 4],
        ['pecas_pos_vendas', 'Peças e Pós-vendas', 5],
        ['financeiro_fiscal', 'Financeiro e Fiscal', 6],
      ]
      for (const [chave, nome, ordem] of seeds) {
        const r = new Record(etapas)
        r.set('chave', chave)
        r.set('nome', nome)
        r.set('ordem', ordem)
        r.set('ativa', true)
        r.set('fluxo', 'crm_leads')
        r.set('altforce_stage_name', nome)
        app.save(r)
      }
    }
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('kanban_etapas'))
    } catch (_) {}
  },
)
