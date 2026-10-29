// 0028 — Campos comerciais na collection users (Anel 1 — Especificação Mestre HARAMAQ).
// Adiciona: external_id_altforce (text, nullable), senha_provisoria (bool, nullable),
// altforce_sync_status (select, nullable). Sem backfill — usuários existentes ficam NULL.
// UNIQUE parcial em external_id_altforce: implementado como índice único parcial
// (WHERE external_id_altforce != '' AND external_id_altforce IS NOT NULL) — múltiplos NULL ok.
// Rollback: remove os 3 campos e o índice.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    const ext = new Field({ name: 'external_id_altforce', type: 'text', required: false })
    ext.max = 64
    users.fields.add(ext)

    const sp = new Field({ name: 'senha_provisoria', type: 'bool', required: false })
    users.fields.add(sp)

    const ass = new Field({
      name: 'altforce_sync_status',
      type: 'select',
      required: false,
      maxSelect: 1,
      values: ['nao_vinculado', 'pendente_validacao', 'validado'],
    })
    users.fields.add(ass)

    // UNIQUE parcial: índice único sobre external_id_altforce apenas quando preenchido.
    users.addIndex(
      'idx_users_external_id_altforce',
      true,
      'external_id_altforce',
      "external_id_altforce IS NOT NULL AND external_id_altforce != ''",
    )

    app.save(users)
  },
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    users.deleteIndex('idx_users_external_id_altforce')
    users.fields.removeByName('external_id_altforce')
    users.fields.removeByName('senha_provisoria')
    users.fields.removeByName('altforce_sync_status')
    app.save(users)
  },
)
