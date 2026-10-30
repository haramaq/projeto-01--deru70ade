// 0034 — Configuração do motor de distribuição (modo controlado pelo servidor).
// modo: 'so_decide' (default seguro: calcula recomendação, não atribui) | 'automatico'.
// A troca de modo é feita pelo admin via painel/API (updateRule admin-only) — o motor lê a
// config a cada execução; sem registro → default 'so_decide'.
migrate(
  (app) => {
    try {
      app.findCollectionByNameOrId('config_motor')
    } catch (_) {
      const cm = new Collection({
        name: 'config_motor',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.role = 'admin'",
        updateRule: "@request.auth.role = 'admin'",
        deleteRule: null,
      })
      cm.fields.add(
        new Field({
          name: 'modo',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['so_decide', 'automatico'],
        }),
      )
      cm.fields.add(
        new Field({
          name: 'atualizado_por',
          type: 'relation',
          required: false,
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
          cascadeDelete: false,
        }),
      )
      cm.fields.add(new Field({ name: 'atualizado_em', type: 'date', required: false }))
      cm.fields.add(new Field({ name: 'observacao', type: 'text', required: false, max: 500 }))
      app.save(cm)
    }
  },
  (app) => {
    try {
      const c = app.findCollectionByNameOrId('config_motor')
      app.delete(c)
    } catch (_) {}
  },
)
