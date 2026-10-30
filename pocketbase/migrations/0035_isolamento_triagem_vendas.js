// 0035 — Isolamento da triagem em vendas (decisão owner 30/10 14:41):
// a triagem passa a ver/editar SOMENTE leads atribuídos a ela (vendedor = @request.auth.id).
// Admin/gestor mantêm acesso administrativo; suporte mantém acesso geral legítimo.
// Leads SEM responsável ficam fora do alcance da triagem comum — devem entrar na FILA DE
// TRIAGEM com autorização server-side específica (rota/hook dedicado; ver decisão do owner).
// Transferências triagem ↔ vendedor continuam permitidas (hook V3 + updateRule de lead próprio).
// Rollback: restaura as regras da 0031 (triagem com leitura ampla) — documentado abaixo.
migrate(
  (app) => {
    const vendas = app.findCollectionByNameOrId('vendas')

    const ROLES_LEITURA =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'triagem' || @request.auth.role = 'vendedor' || @request.auth.role = 'revendedor' || @request.auth.role = 'suporte' || @request.auth.perm_leads = true)"
    const ETAPAS_RESTRITAS =
      "((@request.auth.role = 'admin' || @request.auth.role = 'triagem' || @request.auth.role = 'suporte') || (etapa != 'pecas_pos_vendas' && etapa != 'financeiro_fiscal' && etapa != 'fornecedores'))"
    // ESCOPO SEM TRIAGEM (única mudança vs. 0031): triagem sai da cláusula geral.
    const ESCOPO_SEM_TRIAGEM =
      "((@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'suporte') || vendedor = @request.auth.id)"

    vendas.listRule = ROLES_LEITURA + ' && ' + ESCOPO_SEM_TRIAGEM + ' && ' + ETAPAS_RESTRITAS
    vendas.viewRule = ROLES_LEITURA + ' && ' + ESCOPO_SEM_TRIAGEM + ' && ' + ETAPAS_RESTRITAS

    vendas.updateRule =
      ROLES_LEITURA +
      " && ((@request.auth.role = 'admin' || @request.auth.role = 'triagem' || @request.auth.role = 'suporte') || ((etapa != 'pecas_pos_vendas' && etapa != 'financeiro_fiscal' && etapa != 'fornecedores') && (@request.body.etapa != 'pecas_pos_vendas' && @request.body.etapa != 'financeiro_fiscal' && @request.body.etapa != 'fornecedores')))" +
      " && ((@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'suporte') || vendedor = @request.auth.id)"

    // createRule INALTERADA (triagem já só cria lead próprio).
    // deleteRule INALTERADO (admin|gestor).
    app.save(vendas)
  },
  (app) => {
    // Down: restaura as regras da 0031 (triagem com leitura ampla).
    const vendas = app.findCollectionByNameOrId('vendas')
    const ROLES_LEITURA =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'triagem' || @request.auth.role = 'vendedor' || @request.auth.role = 'revendedor' || @request.auth.role = 'suporte' || @request.auth.perm_leads = true)"
    const ETAPAS_RESTRITAS =
      "((@request.auth.role = 'admin' || @request.auth.role = 'triagem' || @request.auth.role = 'suporte') || (etapa != 'pecas_pos_vendas' && etapa != 'financeiro_fiscal' && etapa != 'fornecedores'))"
    const ESCOPO_0031 =
      "((@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'suporte' || @request.auth.role = 'triagem') || vendedor = @request.auth.id)"
    vendas.listRule = ROLES_LEITURA + ' && ' + ESCOPO_0031 + ' && ' + ETAPAS_RESTRITAS
    vendas.viewRule = ROLES_LEITURA + ' && ' + ESCOPO_0031 + ' && ' + ETAPAS_RESTRITAS
    vendas.updateRule =
      ROLES_LEITURA +
      " && ((@request.auth.role = 'admin' || @request.auth.role = 'triagem' || @request.auth.role = 'suporte') || ((etapa != 'pecas_pos_vendas' && etapa != 'financeiro_fiscal' && etapa != 'fornecedores') && (@request.body.etapa != 'pecas_pos_vendas' && @request.body.etapa != 'financeiro_fiscal' && @request.body.etapa != 'fornecedores')))" +
      " && ((@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'suporte') || vendedor = @request.auth.id)"
    app.save(vendas)
  },
)
