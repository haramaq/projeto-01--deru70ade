// 0031 — Correção RBAC de vendas (E2b): remove o fallback por carteira textual.
// Vendedor/revendedor passam a acessar SOMENTE leads com vendedor = @request.auth.id.
// Admin/gestor/suporte mantêm visão ampla; triagem mantém leitura ampla (organização de leads)
// mas não altera vendedor de terceiros. Carteira segue como campo de rótulo, NUNCA autorização.
// Pré-requisito operacional: E0/E1b (leads sem vendedor tratados) — com 11 leads fictícios,
// o owner autorizou não preservar atribuições de teste.
// Rollback: restaura as regras anteriores (com fallback da carteira).
migrate(
  (app) => {
    const vendas = app.findCollectionByNameOrId('vendas')

    const ROLES_LEITURA =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'triagem' || @request.auth.role = 'vendedor' || @request.auth.role = 'revendedor' || @request.auth.role = 'suporte' || @request.auth.perm_leads = true)"
    const ETAPAS_RESTRITAS =
      "((@request.auth.role = 'admin' || @request.auth.role = 'triagem' || @request.auth.role = 'suporte') || (etapa != 'pecas_pos_vendas' && etapa != 'financeiro_fiscal' && etapa != 'fornecedores'))"
    const ESCOPO_NOVO =
      "((@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'suporte' || @request.auth.role = 'triagem') || vendedor = @request.auth.id)"

    vendas.listRule = ROLES_LEITURA + ' && ' + ESCOPO_NOVO + ' && ' + ETAPAS_RESTRITAS
    vendas.viewRule = ROLES_LEITURA + ' && ' + ESCOPO_NOVO + ' && ' + ETAPAS_RESTRITAS

    vendas.updateRule =
      ROLES_LEITURA +
      " && ((@request.auth.role = 'admin' || @request.auth.role = 'triagem' || @request.auth.role = 'suporte') || ((etapa != 'pecas_pos_vendas' && etapa != 'financeiro_fiscal' && etapa != 'fornecedores') && (@request.body.etapa != 'pecas_pos_vendas' && @request.body.etapa != 'financeiro_fiscal' && @request.body.etapa != 'fornecedores')))" +
      " && ((@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'suporte') || vendedor = @request.auth.id)"

    vendas.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'triagem' || @request.auth.role = 'vendedor' || @request.auth.role = 'revendedor' || @request.auth.role = 'suporte' || @request.auth.perm_leads = true)" +
      " && ((@request.auth.role = 'admin' || @request.auth.role = 'triagem' || @request.auth.role = 'suporte') || (@request.body.etapa != 'pecas_pos_vendas' && @request.body.etapa != 'financeiro_fiscal' && @request.body.etapa != 'fornecedores'))" +
      " && ((@request.auth.role = 'admin' || @request.auth.role = 'gestor') || @request.body.vendedor = @request.auth.id)"

    // deleteRule inalterado (admin|gestor)
    app.save(vendas)

    // lead_historico: remove o fallback por carteira do createRule (mesma fraqueza de vendas —
    // permitia registrar eventos em leads de terceiros com a mesma carteira).
    const hist = app.findCollectionByNameOrId('lead_historico')
    hist.createRule =
      "@request.auth.id != '' && (((@request.auth.role = 'admin' || @request.auth.role = 'gestor') || (@request.auth.role = 'triagem' || @request.auth.role = 'suporte') || lead_id.vendedor = @request.auth.id) || (@request.body.tipo_evento = 'transferencia' && @request.body.usuario_origem = @request.auth.id))"
    app.save(hist)
  },
  (app) => {
    const vendas = app.findCollectionByNameOrId('vendas')
    // Regras anteriores (com fallback da carteira) — restauração exata do snapshot 33754d5a:
    const ROLES_LEITURA =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'triagem' || @request.auth.role = 'vendedor' || @request.auth.role = 'revendedor' || @request.auth.role = 'suporte' || @request.auth.perm_leads = true)"
    const ESCOPO_ANTIGO =
      "((@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'suporte') || vendedor = @request.auth.id || (@request.auth.carteira != '' && carteira = @request.auth.carteira))"
    const ETAPAS_RESTRITAS =
      "((@request.auth.role = 'admin' || @request.auth.role = 'triagem' || @request.auth.role = 'suporte') || (etapa != 'pecas_pos_vendas' && etapa != 'financeiro_fiscal' && etapa != 'fornecedores'))"
    vendas.listRule = ROLES_LEITURA + ' && ' + ESCOPO_ANTIGO + ' && ' + ETAPAS_RESTRITAS
    vendas.viewRule = ROLES_LEITURA + ' && ' + ESCOPO_ANTIGO + ' && ' + ETAPAS_RESTRITAS
    vendas.updateRule =
      ROLES_LEITURA +
      " && ((@request.auth.role = 'admin' || @request.auth.role = 'triagem' || @request.auth.role = 'suporte') || ((etapa != 'pecas_pos_vendas' && etapa != 'financeiro_fiscal' && etapa != 'fornecedores') && (@request.body.etapa != 'pecas_pos_vendas' && @request.body.etapa != 'financeiro_fiscal' && @request.body.etapa != 'fornecedores')))" +
      " && ((@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'suporte') || vendedor = @request.auth.id || (@request.auth.carteira != '' && carteira = @request.auth.carteira))"
    vendas.createRule =
      "@request.auth.id != '' && ((@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'triagem' || @request.auth.role = 'vendedor' || @request.auth.role = 'revendedor' || @request.auth.role = 'suporte' || @request.auth.perm_leads = true)) && ((@request.auth.role = 'admin' || @request.auth.role = 'triagem' || @request.auth.role = 'suporte') || (@request.body.etapa != 'pecas_pos_vendas' && @request.body.etapa != 'financeiro_fiscal' && @request.body.etapa != 'fornecedores')) && ((@request.auth.role = 'admin' || @request.auth.role = 'gestor') || @request.body.vendedor = @request.auth.id || (@request.auth.carteira != '' && @request.body.carteira = @request.auth.carteira))"
    app.save(vendas)
    const hist = app.findCollectionByNameOrId('lead_historico')
    hist.createRule =
      "@request.auth.id != '' && (((@request.auth.role = 'admin' || @request.auth.role = 'gestor') || (@request.auth.role = 'triagem' || @request.auth.role = 'suporte') || (lead_id.vendedor = @request.auth.id || (@request.auth.carteira != '' && lead_id.carteira = @request.auth.carteira))) || (@request.body.tipo_evento = 'transferencia' && @request.body.usuario_origem = @request.auth.id))"
    app.save(hist)
  },
)
