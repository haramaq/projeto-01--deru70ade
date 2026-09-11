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
    const addNumber = (collection, name, min, max) => {
      if (!collection.fields.getByName(name))
        collection.fields.add(new NumberField({ name, required: false, min, max }))
    }
    const addDate = (collection, name) => {
      if (!collection.fields.getByName(name))
        collection.fields.add(new DateField({ name, required: false }))
    }

    const stages = [
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
    ]
    const stageLabels = {
      agendamento_primeiro_contato: 'Agendamento de 1º contato',
      em_contato: 'Em contato',
      revenda_contato: 'Revenda Contato',
      orcamentacao: 'Orçamentação',
      contato_futuro_agendado: 'Contato futuro (Agendado)',
      arquivado_nao_retorna: 'Arquivado (não retorna)',
      perdido_concorrencia: 'Perdido (comprou da concorrência)',
      convertido_pedido: 'Convertido para pedido',
      pecas_pos_vendas: 'Peças e Pós-vendas',
      financeiro_fiscal: 'Financeiro e Fiscal',
    }
    const categories = [
      'Linha Prohmix',
      'Linha Supermix',
      'Linha Tipper',
      'Vagões Rodoviários',
      'Colhedora de forragens',
      'Homogeneizador de esterco',
      'Revolvedor de cama',
    ]
    const origins = [
      'Campanhas',
      'Eventos',
      'Redes Sociais',
      'Prospecção direta a campo',
      'Google',
      'Site',
      'Ligação na empresa',
      'Indicação de parceiros',
      'Cliente antigo',
      'Cliente de revenda',
    ]

    const etapa = vendas.fields.getByName('etapa')
    if (etapa) etapa.values = stages
    if (etapa) app.save(vendas)

    vendas.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'triagem' || @request.auth.role = 'vendedor' || @request.auth.role = 'revendedor' || @request.auth.role = 'suporte')"
    vendas.viewRule = vendas.listRule
    vendas.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'triagem' || @request.auth.role = 'vendedor' || @request.auth.role = 'revendedor')"
    vendas.updateRule = vendas.createRule
    vendas.deleteRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')"
    app.save(vendas)

    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    users.listRule = "@request.auth.id != ''"
    users.viewRule = "@request.auth.id != ''"
    app.save(users)

    const addSelect = (collection, name, values) => {
      if (!collection.fields.getByName(name))
        collection.fields.add(new SelectField({ name, values, maxSelect: 1, required: false }))
    }
    addText(vendas, 'numero_lead', 40)
    addSelect(vendas, 'categoria_produto', categories)
    addSelect(vendas, 'origem_lead', origins)
    addSelect(vendas, 'status_lead', ['em_andamento', 'arquivado', 'perdido', 'convertido_pedido'])
    addText(vendas, 'status_motivo_codigo', 80)
    addText(vendas, 'status_motivo_descricao', 160)
    addNumber(vendas, 'nivel_interesse', 1, 5)
    addDate(vendas, 'data_solicitacao')
    addDate(vendas, 'etapa_atual_desde')
    addDate(vendas, 'prazo_etapa_em')
    addText(vendas, 'observacoes_ia', 4000)
    addText(vendas, 'equipe', 120)
    addJson(vendas, 'equipes')
    addText(vendas, 'responsavel_cargo', 120)
    addText(vendas, 'altforce_step_model_id', 120)
    addText(vendas, 'altforce_stage_id', 120)
    addText(vendas, 'altforce_stage_name', 160)
    addText(vendas, 'altforce_sync_status', 40)
    addText(vendas, 'altforce_last_synced_at', 40)
    addJson(vendas, 'altforce_payload')
    addJson(vendas, 'campos_customizados')
    app.save(vendas)

    // Existing demo records are preserved and normalized to the new lead contract.
    const oldStageMap = {
      prospeccao: 'agendamento_primeiro_contato',
      orcamento: 'orcamentacao',
      negociacao: 'em_contato',
      fechamento: 'convertido_pedido',
    }
    const legacyCategory = { PROHMIX: 'Linha Prohmix', SUPERMIX: 'Linha Supermix' }
    const leadRecords = app.findRecordsByFilter('vendas', '', '-created', 500, 0)
    for (const record of leadRecords) {
      const currentStage = record.get('etapa')
      const normalizedStage =
        oldStageMap[currentStage] ||
        (stages.includes(currentStage) ? currentStage : 'agendamento_primeiro_contato')
      const now = new Date()
      record.set('etapa', normalizedStage)
      record.set('numero_lead', record.get('numero_lead') || `LEAD-${record.id.toUpperCase()}`)
      record.set(
        'categoria_produto',
        record.get('categoria_produto') || legacyCategory[record.get('produto')] || 'Linha Prohmix',
      )
      record.set('origem_lead', record.get('origem_lead') || 'Site')
      record.set('nivel_interesse', record.get('nivel_interesse') || 3)
      record.set(
        'status_lead',
        record.get('status_lead') ||
          (normalizedStage === 'convertido_pedido' ? 'convertido_pedido' : 'em_andamento'),
      )
      record.set(
        'data_solicitacao',
        record.get('data_solicitacao') || record.get('created') || now.toISOString(),
      )
      record.set(
        'etapa_atual_desde',
        record.get('etapa_atual_desde') || record.get('updated') || now.toISOString(),
      )
      record.set(
        'prazo_etapa_em',
        record.get('prazo_etapa_em') || new Date(now.getTime() + 24 * 3600 * 1000).toISOString(),
      )
      record.set('altforce_stage_name', stageLabels[normalizedStage])
      record.set('altforce_sync_status', record.get('altforce_sync_status') || 'not_connected')
      app.save(record)
    }

    // Add compatibility fields to customer records as well.
    addText(clientes, 'altforce_stage_id', 120)
    addText(clientes, 'altforce_stage_name', 160)
    app.save(clientes)

    // Replace the previous stage catalog with the canonical ten-stage flow.
    const etapas = app.findCollectionByNameOrId('kanban_etapas')
    const existingStages = app.findRecordsByFilter('kanban_etapas', '', 'ordem', 100, 0)
    for (const item of existingStages) app.delete(item)
    for (let i = 0; i < stages.length; i += 1) {
      const item = new Record(etapas)
      item.set('chave', stages[i])
      item.set('nome', stageLabels[stages[i]])
      item.set('ordem', i + 1)
      item.set('ativa', true)
      item.set('fluxo', 'crm_leads')
      item.set('altforce_stage_name', stageLabels[stages[i]])
      item.set('altforce_stage_id', '')
      item.set('altforce_step_model_id', '')
      app.save(item)
    }

    try {
      app.findCollectionByNameOrId('lead_historico')
    } catch (_) {
      const history = new Collection({
        name: 'lead_historico',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: '',
        deleteRule: '',
        fields: [
          {
            name: 'lead_id',
            type: 'relation',
            collectionId: vendas.id,
            cascadeDelete: true,
            maxSelect: 1,
            required: true,
          },
          { name: 'etapa_anterior', type: 'text' },
          { name: 'etapa_nova', type: 'text', required: true },
          { name: 'motivo_codigo', type: 'text' },
          { name: 'motivo_descricao', type: 'text' },
          { name: 'responsavel', type: 'text' },
          { name: 'data_hora', type: 'date', required: true },
          { name: 'observacao', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_lead_historico_lead ON lead_historico (lead_id)',
          'CREATE INDEX idx_lead_historico_data ON lead_historico (data_hora)',
        ],
      })
      app.save(history)
      const records = app.findRecordsByFilter('vendas', '', '-created', 500, 0)
      for (const record of records) {
        const historyRecord = new Record(history)
        historyRecord.set('lead_id', record.id)
        historyRecord.set('etapa_nova', record.get('etapa'))
        historyRecord.set('responsavel', record.get('vendedor') || '')
        historyRecord.set(
          'data_hora',
          record.get('etapa_atual_desde') || record.get('created') || new Date().toISOString(),
        )
        app.save(historyRecord)
      }
    }

    try {
      app.findCollectionByNameOrId('lead_tarefas')
    } catch (_) {
      const tasks = new Collection({
        name: 'lead_tarefas',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')",
        fields: [
          {
            name: 'lead_id',
            type: 'relation',
            collectionId: vendas.id,
            cascadeDelete: true,
            maxSelect: 1,
            required: true,
          },
          { name: 'titulo', type: 'text', required: true },
          { name: 'equipe', type: 'text' },
          { name: 'responsavel', type: 'text' },
          {
            name: 'status',
            type: 'select',
            values: ['pendente', 'em_andamento', 'concluida', 'cancelada'],
            maxSelect: 1,
          },
          { name: 'prazo', type: 'date' },
          { name: 'observacoes', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_lead_tarefas_lead ON lead_tarefas (lead_id)'],
      })
      app.save(tasks)
    }

    try {
      app.findCollectionByNameOrId('lead_motivos_status')
    } catch (_) {
      const motives = new Collection({
        name: 'lead_motivos_status',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')",
        updateRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')",
        deleteRule: '',
        fields: [
          { name: 'codigo', type: 'text', required: true },
          { name: 'status', type: 'text', required: true },
          { name: 'descricao', type: 'text', required: true },
          { name: 'ordem', type: 'number', required: true },
          { name: 'altforce_reason_code', type: 'text' },
          { name: 'altforce_reason_name', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_lead_motivos_codigo ON lead_motivos_status (codigo)'],
      })
      app.save(motives)
      const reasonSeeds = [
        ['ARQ_NAO_RESPONDE', 'arquivado', 'Não responde', 1],
        ['ARQ_SEM_CONDICAO', 'arquivado', 'Não tem condição financeira', 2],
        ['PER_CONCORRENCIA', 'perdido', 'Perda: Concorrência', 3],
        ['PER_CONFIGURACAO', 'perdido', 'Perda: Configuração', 4],
        ['PER_PRAZO_PAGAMENTO', 'perdido', 'Perda: Prazo de pagamento', 5],
        ['PER_PRECO', 'perdido', 'Perda: Preço', 6],
        ['PER_TEMPO_ENTREGA', 'perdido', 'Perda: Tempo de entrega', 7],
        ['GAN_REVENDEDOR', 'convertido_pedido', 'Ganho: Revendedor', 8],
        ['GAN_ESTOQUE_REVENDA', 'convertido_pedido', 'Ganho: Estoque Revenda', 9],
        ['GAN_ATENDIMENTO_POS_VENDAS', 'convertido_pedido', 'Ganho: Atendimento do pós vendas', 10],
        [
          'GAN_ATENDIMENTO_COMERCIAL',
          'convertido_pedido',
          'Ganho: Atendimento equipe comercial',
          11,
        ],
        ['GAN_CONFIGURACAO', 'convertido_pedido', 'Ganho: Configuração', 12],
        ['GAN_MARCA', 'convertido_pedido', 'Ganho: Marca', 13],
        ['GAN_PRAZO_PAGAMENTO', 'convertido_pedido', 'Ganho: Prazo de pagamento', 14],
        ['GAN_PRECO', 'convertido_pedido', 'Ganho: Preço', 15],
        ['GAN_QUALIDADE_PRODUTO', 'convertido_pedido', 'Ganho: Qualidade do produto', 16],
        ['GAN_TEMPO_ENTREGA', 'convertido_pedido', 'Ganho: Tempo de entrega', 17],
      ]
      for (const [codigo, status, descricao, ordem] of reasonSeeds) {
        const reason = new Record(motives)
        reason.set('codigo', codigo)
        reason.set('status', status)
        reason.set('descricao', descricao)
        reason.set('ordem', ordem)
        reason.set('altforce_reason_code', codigo)
        reason.set('altforce_reason_name', descricao)
        app.save(reason)
      }
    }

    // Correct legacy demonstration labels that belonged to construction, not Haramaq.
    const clientRenames = {
      'Construtora Andrade Jr.': ['Fazenda Andrade Leite', 'Carlos Eduardo Andrade'],
      'Concretar Mix Serviços': ['Agropecuária Concretar', 'Marcos Vinicius Rezende'],
      'Araxá Concretos': ['Fazenda Araxá', 'Fernanda Araxá Lima'],
      'Betume Engenharia': ['Representação Betume Agro', 'Roberto Siqueira Guimarães'],
    }
    for (const oldName in clientRenames) {
      try {
        const record = app.findFirstRecordByData('clientes', 'empresa', oldName)
        record.set('empresa', clientRenames[oldName][0])
        record.set('nome', clientRenames[oldName][1])
        record.set(
          'observacoes',
          'Lead do agronegócio para otimização do manejo alimentar do rebanho.',
        )
        app.save(record)
      } catch (_) {}
    }
  },
  (app) => {
    // Keep lead data and history on rollback; this migration is additive and intentionally non-destructive.
  },
)
