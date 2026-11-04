/// <reference path="../pb_data/types.d.ts" />
// T2.2-T3-B1 — Classificação comercial dos leads (migration aditiva 0042).
// ESCOPO: adiciona exclusivamente 2 campos à collection vendas. Nenhuma collection,
// campo, índice, regra ou hook existente é alterado.
//
// DECISÕES DO OWNER (T2.2-T3-A):
// - 5 estados da SPEC-2-001 (qualificado, interesse_futuro, fora_perfil, duplicado, pendente)
// - Preservar vendas.nivel_interesse (1-5) — sem substituir
// - Respostas incompletas permitem pendente
// - nao_sei não gera fora_perfil automaticamente
// - duplicado depende da dedup DEC-08
// - Critérios comerciais aguardam homologação HARAMAQ
//
// Down: remove os 2 campos (reversão documentada).

migrate(
  (app) => {
    const c = app.findCollectionByNameOrId('vendas')
    c.fields.add(
      new Field({
        name: 'classificacao',
        type: 'select',
        required: false,
        maxSelect: 1,
        values: ['qualificado', 'interesse_futuro', 'fora_perfil', 'duplicado', 'pendente'],
      }),
    )
    c.fields.add(
      new Field({
        name: 'roteiro_versao',
        type: 'text',
        required: false,
        max: 64,
      }),
    )
    app.save(c)
  },
  (app) => {
    const c = app.findCollectionByNameOrId('vendas')
    c.fields.removeByName('classificacao')
    c.fields.removeByName('roteiro_versao')
    app.save(c)
  },
)
