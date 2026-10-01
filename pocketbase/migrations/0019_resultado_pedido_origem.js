migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('feira_resultados')
    if (!col.fields.getByName('pedido_arquivo')) {
      col.fields.add(
        new FileField({
          name: 'pedido_arquivo',
          maxSelect: 1,
          maxSize: 20971520,
          mimeTypes: [
            'application/pdf',
            'text/plain',
            'text/csv',
            'application/json',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'image/jpeg',
            'image/png',
            'image/webp',
          ],
        }),
      )
    }
    if (!col.fields.getByName('pedido_nome_arquivo')) {
      col.fields.add(new TextField({ name: 'pedido_nome_arquivo', max: 255 }))
    }
    if (!col.fields.getByName('pedido_texto_extraido')) {
      col.fields.add(new TextField({ name: 'pedido_texto_extraido', max: 100000 }))
    }
    if (!col.fields.getByName('pedido_leitura_status')) {
      col.fields.add(
        new SelectField({
          name: 'pedido_leitura_status',
          values: ['manual', 'processado', 'revisao_manual', 'erro'],
          maxSelect: 1,
        }),
      )
    }
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('feira_resultados')
    if (col.fields.getByName('pedido_arquivo')) col.fields.removeByName('pedido_arquivo')
    if (col.fields.getByName('pedido_nome_arquivo')) col.fields.removeByName('pedido_nome_arquivo')
    if (col.fields.getByName('pedido_texto_extraido'))
      col.fields.removeByName('pedido_texto_extraido')
    if (col.fields.getByName('pedido_leitura_status'))
      col.fields.removeByName('pedido_leitura_status')
    app.save(col)
  },
)
