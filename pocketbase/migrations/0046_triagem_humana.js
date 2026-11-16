// 0046_triagem_humana.js — Collection para Atendimento Não Comercial (ET-HMQ-TRIAGEM-005).
// Alternativa B: collection própria, SEM relation para vendas, SEM contaminação comercial.
// Campos: 8 declarados + created/updated (autodates automáticos do PocketBase).
// RBAC: list/view/update para admin|triagem|suporte; create=null (gateway via superuser); delete=admin.
// Idempotência: UNIQUE parcial em wa_message_id.

migrate(
  (app) => {
    const collection = new Collection({
      type: 'base',
      name: 'triagem_humana',
      listRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'triagem' || @request.auth.role = 'suporte')",
      viewRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'triagem' || @request.auth.role = 'suporte')",
      createRule: null,
      updateRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'triagem' || @request.auth.role = 'suporte')",
      deleteRule: "@request.auth.role = 'admin'",
      fields: [
        { name: 'nome_solicitante', type: 'text', required: true, max: 255 },
        { name: 'telefone', type: 'text', required: true, max: 20 },
        {
          name: 'categoria',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: [
            'pecas',
            'assistencia',
            'pos_venda',
            'financeiro',
            'fornecedores',
            'emprego',
            'revendas',
            'outros',
          ],
        },
        { name: 'descricao', type: 'text', required: false, max: 2000 },
        {
          name: 'status',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['pendente', 'em_atendimento', 'resolvido'],
        },
        {
          name: 'responsavel',
          type: 'relation',
          required: false,
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'wa_message_id', type: 'text', required: false, max: 100 },
        { name: 'wa_conversation_id', type: 'text', required: false, max: 100 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE UNIQUE INDEX `idx_triagem_wa_message` ON `triagem_humana` (`wa_message_id`) WHERE `wa_message_id` != ''",
      ],
    })
    app.save(collection)
  },
  (app) => {
    // Rollback NÃO destrutivo: bloqueia o acesso mas PRESERVA a collection e os dados.
    // A collection e os registros permanecem no banco para recuperação futura.
    // Para excluir definitivamente, usar operação manual com export prévio.
    const collection = app.findCollectionByNameOrId('triagem_humana')
    collection.listRule = null
    collection.viewRule = null
    collection.createRule = null
    collection.updateRule = null
    collection.deleteRule = null
    app.save(collection)
  },
)
