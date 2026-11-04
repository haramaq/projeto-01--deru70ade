/// <reference path="../pb_data/types.d.ts" />
// T2.1 / Etapa 3 — regras VERSIONADAS com vigência temporal (migration 0038, projeto 57543)
// Autorizada via OP-1 (owner, 04/11). Nunca UPDATE destrutivo: cada mudança cria uma nova
// versão e fecha a anterior. D-6 (decisão owner): regra_chave em DUAS FAMÍLIAS —
// 'ddd:<ddi><ddd>' (ex.: ddd:5551) e 'territorio:<cidade_normalizada>|<UF>' (ex.: territorio:erechim|RS).
// DDI/DDD (região telefônica) e cidade+UF (geográfica) NÃO são equivalentes; cada família
// versiona e homologa sua precisão separadamente (DEC-06: precisão POR REGRA).
// Fix D1 FUNDIDO: o índice parcial usa vigente_ate = '' porque o PocketBase grava data
// vazia como string '' e não como NULL (IS NULL nunca casaria).
migrate(
  (app) => {
    const c = new Collection({
      name: 'regras_versao',
      type: 'base',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'regra_chave', type: 'text', required: true, max: 80 },
        { name: 'versao', type: 'number', required: true, onlyInt: true },
        { name: 'conteudo', type: 'json', required: true, maxSize: 65536 },
        // vigência: vigente_de .. vigente_ate ('' = aberta)
        { name: 'vigente_de', type: 'date', required: true },
        { name: 'vigente_ate', type: 'date', required: false },
        // selo de imutabilidade: definido no fechamento, nunca alterado depois
        { name: 'hash_conteudo', type: 'text', required: true, max: 64 },
        { name: 'status', type: 'text', required: true, max: 20 },
        { name: 'criado_por', type: 'text', required: true, max: 64 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_regra_versao ON regras_versao (regra_chave, versao)',
        'CREATE INDEX idx_regra_vigencia ON regras_versao (regra_chave, vigente_de)',
        // no máximo UMA versão aberta por regra (D1: '' e não NULL)
        "CREATE UNIQUE INDEX idx_regra_aberta ON regras_versao (regra_chave) WHERE vigente_ate = ''",
      ],
    })
    app.save(c)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('regras_versao'))
    } catch (_) {}
  },
)
