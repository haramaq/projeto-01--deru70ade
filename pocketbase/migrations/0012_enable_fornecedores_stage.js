// Retry-safe schema sync for the existing Fornecedores stage.
migrate(
  (app) => {
    const vendas = app.findCollectionByNameOrId('vendas')
    const etapa = vendas.fields.getByName('etapa')
    if (etapa && !etapa.values.includes('fornecedores')) {
      etapa.values = [...etapa.values, 'fornecedores']
      app.save(vendas)
    }

    const etapas = app.findCollectionByNameOrId('kanban_etapas')
    try {
      app.findFirstRecordByData('kanban_etapas', 'chave', 'fornecedores')
    } catch (_) {
      const supplierStage = new Record(etapas)
      supplierStage.set('chave', 'fornecedores')
      supplierStage.set('nome', 'Fornecedores')
      supplierStage.set('ordem', 11)
      supplierStage.set('ativa', true)
      supplierStage.set('fluxo', 'crm_leads')
      supplierStage.set('altforce_stage_name', 'Fornecedores')
      supplierStage.set('altforce_stage_id', '')
      supplierStage.set('altforce_step_model_id', '')
      app.save(supplierStage)
    }
  },
  (app) => {},
)
