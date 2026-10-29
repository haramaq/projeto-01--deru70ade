// 0029 — Carteiras comerciais: vendedor_ddd (N:N vendedor×DDI/DDD) + histórico + ddi_paises.
// DDDs compartilhados permitidos (sem UNIQUE global); índice de consulta (ddi, ddd, ativo).
// Histórico append-only (regras bloqueiam update/delete).
// Rollback: remove as 3 collections.
migrate(
  (app) => {
    // ---- vendedor_ddd ----
    const vdd = new Collection({
      name: 'vendedor_ddd',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || usuario_id = @request.auth.id)",
      viewRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || usuario_id = @request.auth.id)",
      createRule: "@request.auth.role = 'admin'",
      updateRule: "@request.auth.role = 'admin'",
      deleteRule: "@request.auth.role = 'admin'",
    })
    vdd.fields.add(
      new Field({
        name: 'usuario_id',
        type: 'relation',
        required: true,
        collectionId: '_pb_users_auth_',
        maxSelect: 1,
        cascadeDelete: false,
      }),
    )
    vdd.fields.add(new Field({ name: 'ddi', type: 'text', required: true, max: 6 }))
    vdd.fields.add(new Field({ name: 'ddd', type: 'text', required: false, max: 6 }))
    vdd.fields.add(new Field({ name: 'ativo', type: 'bool', required: false }))
    vdd.fields.add(
      new Field({
        name: 'confirmado_por',
        type: 'relation',
        required: false,
        collectionId: '_pb_users_auth_',
        maxSelect: 1,
        cascadeDelete: false,
      }),
    )
    vdd.fields.add(new Field({ name: 'observacao', type: 'text', required: false, max: 500 }))
    vdd.addIndex('idx_vendedor_ddd_consulta', false, 'ddi, ddd, ativo', '')
    vdd.addIndex('idx_vendedor_ddd_usuario', false, 'usuario_id', '')
    app.save(vdd)

    // ---- vendedor_ddd_historico (append-only) ----
    const vdh = new Collection({
      name: 'vendedor_ddd_historico',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')",
      viewRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')",
      createRule: "@request.auth.role = 'admin'",
      updateRule: null,
      deleteRule: null,
    })
    vdh.fields.add(
      new Field({
        name: 'vendedor_ddd_id',
        type: 'relation',
        required: true,
        collectionId: vdd.id,
        maxSelect: 1,
        cascadeDelete: false,
      }),
    )
    vdh.fields.add(
      new Field({
        name: 'acao',
        type: 'select',
        required: true,
        maxSelect: 1,
        values: ['criado', 'ativado', 'desativado', 'removido'],
      }),
    )
    vdh.fields.add(
      new Field({
        name: 'autor',
        type: 'relation',
        required: false,
        collectionId: '_pb_users_auth_',
        maxSelect: 1,
        cascadeDelete: false,
      }),
    )
    vdh.fields.add(new Field({ name: 'antes', type: 'json', required: false, maxSize: 2000000 }))
    vdh.fields.add(new Field({ name: 'depois', type: 'json', required: false, maxSize: 2000000 }))
    app.save(vdh)

    // ---- ddi_paises ----
    const ddp = new Collection({
      name: 'ddi_paises',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.role = 'admin'",
      updateRule: "@request.auth.role = 'admin'",
      deleteRule: "@request.auth.role = 'admin'",
    })
    ddp.fields.add(new Field({ name: 'ddi', type: 'text', required: true, max: 6 }))
    ddp.fields.add(new Field({ name: 'pais_iso', type: 'text', required: true, max: 2 }))
    ddp.fields.add(new Field({ name: 'formato_nacional', type: 'text', required: false, max: 50 }))
    ddp.fields.add(new Field({ name: 'observacao', type: 'text', required: false, max: 500 }))
    ddp.addIndex('idx_ddi_paises_ddi', true, 'ddi', '')
    app.save(ddp)
  },
  (app) => {
    app.deleteCachedCollectionByName && app.deleteCachedCollectionByName('ddi_paises')
    const ddp = app.findCollectionByNameOrId('ddi_paises')
    app.delete(ddp)
    const vdh = app.findCollectionByNameOrId('vendedor_ddd_historico')
    app.delete(vdh)
    const vdd = app.findCollectionByNameOrId('vendedor_ddd')
    app.delete(vdd)
  },
)
