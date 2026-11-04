/// <reference path="../pb_data/types.d.ts" />
// T2.1 / Etapa 1 — CRIAÇÃO da coleção idempotency_keys (migration 0037, projeto 57543)
// Autorizada via OP-1 (owner, 04/11). Schema derivado do hook idem_executar.
// Regras null: escrita só por hooks via e.app/txApp (sistema); leitura por superuser.
migrate(
  (app) => {
    const c = new Collection({
      name: 'idempotency_keys',
      type: 'base',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'idempotency_key', type: 'text', required: true, max: 128 },
        { name: 'payload_hash', type: 'text', required: true, max: 64 },
        { name: 'operacao', type: 'text', required: true, max: 40 },
        // estado: processando | ok | falha
        { name: 'estado', type: 'text', required: true, max: 20 },
        { name: 'resultado_id', type: 'text', required: false, max: 64 },
        // lease de concorrência: quem estiver 'processando' com lease vivo bloqueia takeover
        { name: 'lease_expira_em', type: 'date', required: false },
        { name: 'tentativas', type: 'number', required: false, onlyInt: true },
        { name: 'erro', type: 'text', required: false, max: 500 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        // identidade da chave idempotente
        'CREATE UNIQUE INDEX idx_idem_key ON idempotency_keys (idempotency_key)',
        // varredura de leases expirados (takeover)
        'CREATE INDEX idx_idem_lease ON idempotency_keys (estado, lease_expira_em)',
      ],
    })
    app.save(c)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('idempotency_keys'))
    } catch (_) {}
  },
)
