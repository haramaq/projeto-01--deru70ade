/// <reference path="../pb_data/types.d.ts" />
// T2.1 / Etapa 2 — eventos de negocio APPEND-ONLY (migration 0036, projeto 57543)
// Autorizada via OP-1 (owner, 04/11). Append-only: regras null (escrita só por hooks
// via e.app/txApp; leitura por superuser). UNIQUEs: event_id e (correlation_id, sequencia).
migrate(
  (app) => {
    const c = new Collection({
      name: 'eventos_negocio',
      type: 'base',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'event_id', type: 'text', required: true, max: 64 },
        { name: 'correlation_id', type: 'text', required: true, max: 64 },
        { name: 'tipo', type: 'text', required: true, max: 80 },
        { name: 'agregado', type: 'text', required: true, max: 80 },
        { name: 'agregado_id', type: 'text', required: false, max: 64 },
        { name: 'origem', type: 'text', required: true, max: 40 },
        { name: 'payload', type: 'json', required: false, maxSize: 65536 },
        { name: 'ocorrido_em', type: 'date', required: true },
        { name: 'sequencia', type: 'number', required: true, onlyInt: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_evento_id ON eventos_negocio (event_id)',
        'CREATE UNIQUE INDEX idx_evento_corr_seq ON eventos_negocio (correlation_id, sequencia)',
        'CREATE INDEX idx_evento_corr ON eventos_negocio (correlation_id)',
        'CREATE INDEX idx_evento_agregado ON eventos_negocio (agregado, agregado_id)',
      ],
    })
    app.save(c)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('eventos_negocio'))
    } catch (_) {}
  },
)
