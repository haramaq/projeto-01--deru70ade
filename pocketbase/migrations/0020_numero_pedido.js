migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('feira_resultados')
    if (!col.fields.getByName('numero_pedido')) {
      col.fields.add(new TextField({ name: 'numero_pedido', max: 64 }))
    }
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('feira_resultados')
    if (col.fields.getByName('numero_pedido')) col.fields.removeByName('numero_pedido')
    app.save(col)
  },
)
