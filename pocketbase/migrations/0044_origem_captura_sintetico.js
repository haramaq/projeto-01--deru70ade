/// <reference path="../pb_data/types.d.ts" />
// T2.2-T4-B15 — Adicionar 'sintetico' ao select de origem_captura em vendas.
// ESCOPO: adiciona exclusivamente o valor 'sintetico' ao select existente.
// Nenhum campo, índice, regra ou hook existente é alterado.
//
// O valor 'sintetico' identifica leads de teste (não comerciais).
// O hook qualificar_resposta_create usa origem_captura para bloquear
// respostas simuladas em leads comerciais.
//
// Down: remove o valor 'sintetico' do select (reversão documentada).

migrate(
  (app) => {
    const c = app.findCollectionByNameOrId('vendas')
    for (let i = 0; i < c.fields.length; i++) {
      if (c.fields[i].name === 'origem_captura') {
        c.fields[i].values = ['manual', 'captacao_automatica', 'sintetico']
        break
      }
    }
    app.save(c)
  },
  (app) => {
    const c = app.findCollectionByNameOrId('vendas')
    for (let i = 0; i < c.fields.length; i++) {
      if (c.fields[i].name === 'origem_captura') {
        c.fields[i].values = ['manual', 'captacao_automatica']
        break
      }
    }
    app.save(c)
  },
)
