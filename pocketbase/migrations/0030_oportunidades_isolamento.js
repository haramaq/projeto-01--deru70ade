// 0030 — oportunidades: o negócio comercial (1 contato → N), com isolamento por users.id
// e bloqueio de operações enquanto senha_provisoria estiver ativa.
// Isolamento (Especificação Mestre C.5): vendedor vê/altera SOMENTE os seus (vendedor_id = auth.id);
// gestor consulta (não altera alheios); admin pleno. Campo carteira = rótulo de exibição, NUNCA autorização.
// Rollback: remove a collection.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const ISOLAMENTO_LEITURA =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || vendedor_id = @request.auth.id) && @request.auth.senha_provisoria != true"
    const ISOLAMENTO_ESCRITA =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || vendedor_id = @request.auth.id) && @request.auth.senha_provisoria != true"

    const opp = new Collection({
      name: 'oportunidades',
      type: 'base',
      listRule: ISOLAMENTO_LEITURA,
      viewRule: ISOLAMENTO_LEITURA,
      createRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || vendedor_id = @request.auth.id) && @request.auth.senha_provisoria != true",
      updateRule: ISOLAMENTO_ESCRITA,
      deleteRule: "@request.auth.role = 'admin' && @request.auth.senha_provisoria != true",
    })
    opp.fields.add(new Field({ name: 'contato_nome', type: 'text', required: true, max: 200 }))
    opp.fields.add(new Field({ name: 'telefone_e164', type: 'text', required: true, max: 20 }))
    opp.fields.add(new Field({ name: 'ddi', type: 'text', required: false, max: 6 }))
    opp.fields.add(new Field({ name: 'ddd', type: 'text', required: false, max: 6 }))
    opp.fields.add(
      new Field({
        name: 'vendedor_id',
        type: 'relation',
        required: true,
        collectionId: '_pb_users_auth_',
        maxSelect: 1,
        cascadeDelete: false,
      }),
    )
    opp.fields.add(
      new Field({
        name: 'regra_distribuicao',
        type: 'select',
        required: false,
        maxSelect: 1,
        values: ['ddi-unico', 'mapa-ibge-unico', 'revisao-humana', 'transferencia-manual'],
      }),
    )
    opp.fields.add(new Field({ name: 'municipio_ibge', type: 'text', required: false, max: 7 }))
    opp.fields.add(new Field({ name: 'municipio_nome', type: 'text', required: false, max: 200 }))
    opp.fields.add(new Field({ name: 'uf', type: 'text', required: false, max: 2 }))
    opp.fields.add(new Field({ name: 'altforce_user_id', type: 'text', required: false, max: 64 }))
    opp.fields.add(
      new Field({
        name: 'status',
        type: 'select',
        required: false,
        maxSelect: 1,
        values: ['nova', 'distribuida', 'em_revisao', 'transferida', 'encerrada'],
      }),
    )
    opp.fields.add(
      new Field({ name: 'origem_dados', type: 'json', required: false, maxSize: 2000000 }),
    )
    opp.addIndex('idx_oportunidades_vendedor', false, 'vendedor_id', '')
    opp.addIndex('idx_oportunidades_ddi_ddd', false, 'ddi, ddd', '')
    app.save(opp)
  },
  (app) => {
    const opp = app.findCollectionByNameOrId('oportunidades')
    app.delete(opp)
  },
)
