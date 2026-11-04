/// <reference path="../pb_data/types.d.ts" />
// T2.2-T2 / OP-1 — Collection qualificacao_respostas (migration aditiva 0041).
// ESCOPO: cria exclusivamente esta collection. Nenhuma collection/campo/hook existente é alterado.
//
// O lead é representado por VENDAS (lead_historico.lead_id é relation→vendas).
// UNIQUE (lead_id, pergunta_id, sessao_id) — uma resposta por pergunta por sessão.
// Correção sem perda histórica: PATCH na resposta (status_validacao → corrigida).
// RBAC (OP-1C — bloqueio preventivo): list/view = autenticado + isolamento carteira;
//   create/update/delete = NULL (bloqueado — liberação depende dos hooks T2.2-T4
//   e de nova autorização do owner).
//
// Down: remove a collection (reversão documentada).

migrate(
  (app) => {
    const c = new Collection({
      name: 'qualificacao_respostas',
      type: 'base',
      listRule:
        "@request.auth.id != '' && ((@request.auth.role = 'admin' || @request.auth.role = 'gestor') || (@request.auth.role = 'triagem' || @request.auth.role = 'suporte') || (lead_id.vendedor = @request.auth.id || (@request.auth.carteira != '' && lead_id.carteira = @request.auth.carteira)))",
      viewRule:
        "@request.auth.id != '' && ((@request.auth.role = 'admin' || @request.auth.role = 'gestor') || (@request.auth.role = 'triagem' || @request.auth.role = 'suporte') || (lead_id.vendedor = @request.auth.id || (@request.auth.carteira != '' && lead_id.carteira = @request.auth.carteira)))",
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        {
          name: 'lead_id',
          type: 'relation',
          required: true,
          maxSelect: 1,
          collectionId: 'pbc_733303712',
          cascadeDelete: false,
        },
        { name: 'pergunta_id', type: 'text', required: true, max: 40 },
        { name: 'resposta', type: 'text', required: false, max: 2000 },
        { name: 'roteiro_versao_id', type: 'text', required: true, max: 64 },
        { name: 'sessao_id', type: 'text', required: true, max: 64 },
        {
          name: 'origem',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['triagem', 'agente_ia', 'simulador'],
        },
        {
          name: 'status_validacao',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['valida', 'incompleta', 'corrigida'],
        },
        {
          name: 'respondida_por',
          type: 'relation',
          required: false,
          maxSelect: 1,
          collectionId: '_pb_users_auth_',
          cascadeDelete: false,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_qr_lead_pergunta ON qualificacao_respostas (lead_id, pergunta_id, sessao_id)',
        'CREATE INDEX idx_qr_lead ON qualificacao_respostas (lead_id)',
        'CREATE INDEX idx_qr_sessao ON qualificacao_respostas (sessao_id)',
        'CREATE INDEX idx_qr_roteiro ON qualificacao_respostas (roteiro_versao_id)',
      ],
    })
    app.save(c)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('qualificacao_respostas'))
    } catch (_) {}
  },
)
