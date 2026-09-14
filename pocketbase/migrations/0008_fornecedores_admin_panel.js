migrate(
  (app) => {
    // Additive migration for the supplier stage and admin access controls.
    const vendas = app.findCollectionByNameOrId('vendas')
    const currentStages = [
      'agendamento_primeiro_contato',
      'em_contato',
      'revenda_contato',
      'orcamentacao',
      'contato_futuro_agendado',
      'arquivado_nao_retorna',
      'perdido_concorrencia',
      'convertido_pedido',
      'pecas_pos_vendas',
      'financeiro_fiscal',
      'fornecedores',
    ]
    const etapa = vendas.fields.getByName('etapa')
    if (etapa) {
      etapa.values = currentStages
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

    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    if (!users.fields.getByName('permissoes')) {
      users.fields.add(new JSONField({ name: 'permissoes', required: false }))
    }
    // The existing role taxonomy remains unchanged. Only administrators can use
    // the administrative panel and its user/audit data endpoints.
    users.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')"
    users.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || id = @request.auth.id)"
    users.createRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
    users.updateRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
    users.deleteRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
    app.save(users)

    const audit = app.findCollectionByNameOrId('auditoria_acesso')
    audit.listRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
    audit.viewRule = audit.listRule
    audit.createRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
    audit.updateRule = ''
    audit.deleteRule = ''
    app.save(audit)
  },
  (app) => {
    // Keep the added stage, user metadata and audit history on rollback.
  },
)
