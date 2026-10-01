import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const assert = (condition, message) => {
  if (!condition) throw new Error(`Contract check failed: ${message}`)
}

const login = read('src/pages/Login.tsx')
const vendas = read('src/pages/Vendas.tsx')
const app = read('src/App.tsx')
const layout = read('src/components/Layout.tsx')
const auth = read('src/contexts/AuthContext.tsx')
const adminPage = read('src/pages/Configuracoes.tsx')
const dialog = read('src/components/ui/dialog.tsx')
const schema = JSON.parse(read('src/lib/pocketbase/schema.json'))
const hardening = read('pocketbase/migrations/0010_security_permissions_and_lead_scope.js')

assert(!login.includes('Skip@Pass'), 'default admin password must not be in the login UI')
assert(vendas.includes("'fornecedores'"), 'Kanban must contain Fornecedores')
assert(
  vendas.includes('canAccessRestrictedLeadStages'),
  'restricted lead stages frontend permission required',
)
assert(vendas.includes('Transferir responsável'), 'lead transfer action required')
assert(
  vendas.includes('visibleStages.filter((stage) => !TERMINAIS.includes(stage.key))'),
  'restricted stages must be absent from create selector',
)
assert(vendas.includes('vendaService.transfer'), 'lead transfer service required')
assert(vendas.includes("clientMode === 'new'"), 'new client flow required')
assert(vendas.includes('carteira: user?.carteira'), 'new lead wallet required')
assert(vendas.includes('const saveLeadEdits'), 'lead edit flow required')
assert(
  !vendas.includes('data_prevista_fechamento: editDataPrevista ||'),
  'empty lead date must not be sent',
)
assert(vendas.includes('Editar informações'), 'lead edit action required')
assert(vendas.includes('const [newEtapa'), 'initial lead stage selector required')
assert(app.includes('requiredPermission="leads"'), 'lead route permission required')
assert(layout.includes('visibleNavItems'), 'menu effective permissions required')
assert(auth.includes('hasPermission'), 'auth effective permissions required')
assert(
  hardening.includes('perm_leads') && hardening.includes('vendas.listRule'),
  'hardening migration required',
)

const users = schema.collections.find((item) => item.name === 'users')
const leads = schema.collections.find((item) => item.name === 'vendas')
assert(users && leads, 'schema collections required')
for (const field of [
  'perm_dashboard',
  'perm_leads',
  'perm_clientes',
  'perm_revendas',
  'perm_suporte',
  'perm_relatorios',
  'perm_configuracoes',
]) {
  assert(
    users.fields.some((item) => item.name === field),
    `missing ${field}`,
  )
}
assert(
  leads.fields.some((item) => item.name === 'carteira'),
  'lead wallet missing',
)
assert(
  leads.fields.find((item) => item.name === 'etapa')?.selectValues?.includes('fornecedores'),
  'Fornecedores schema missing',
)
assert(
  read('pocketbase/migrations/0012_enable_fornecedores_stage.js').includes("'fornecedores'"),
  'Fornecedores migration missing',
)
assert(adminPage.includes('formPasswordConfirm'), 'user password confirmation required')
assert(
  adminPage.includes('passwordConfirm: formPassword'),
  'user auth payload confirmation required',
)
assert(adminPage.includes('userService.create'), 'user creation service required')
assert(
  adminPage.includes('passwordConfirm: formPasswordConfirm'),
  'user creation must send confirmed password',
)
assert(
  adminPage.includes('setUsers((current) =>'),
  'user creation must update the list immediately',
)
assert(adminPage.includes('userService.update'), 'user edit service required')
assert(adminPage.includes('userService.delete'), 'user removal service required')
assert(adminPage.includes('const removeUser'), 'user removal flow required')
assert(adminPage.includes('remover_usuario'), 'user removal audit action required')
assert(adminPage.includes('data-testid="new-user-button"'), 'user addition test hook required')
assert(adminPage.includes('data-testid="user-form"'), 'user form test hook required')
assert(adminPage.includes('data-testid="save-user-button"'), 'user save test hook required')
assert(adminPage.includes('data-testid="remove-user-dialog"'), 'user removal confirmation required')
assert(adminPage.includes('auditChangeSummary'), 'audit readable change summary required')
assert(adminPage.includes('auditUserLabel'), 'audit author names required')
assert(adminPage.includes('selectedAudit'), 'audit full detail dialog required')
assert(dialog.includes('overlayClassName'), 'dialog overlay customization required')
assert(vendas.includes('data-testid="lead-edit-dialog"'), 'lead edit dialog test hook required')
assert(vendas.includes('data-testid="lead-detail-dialog"'), 'lead detail dialog test hook required')
assert(vendas.includes('className="z-[100]'), 'lead edit dialog must be above lead detail')
assert(vendas.includes('overlayClassName="z-[90]'), 'lead edit overlay must be above lead detail')
assert(
  read('pocketbase/migrations/0014_visibility_transfer_cadastros.js').includes('tipo_cadastro'),
  'cadastro type migration required',
)
assert(
  read('pocketbase/migrations/0015_preserve_revenda_access.js').includes('perm_revendas'),
  'legacy reseller access must be preserved',
)
assert(read('src/services/crmService.ts').includes("acao: 'criar_ticket'"), 'ticket audit required')
assert(
  read('src/pages/Relatorios.tsx').includes('Relatórios de Leads'),
  'lead reports page required',
)
assert(read('src/pages/Relatorios.tsx').includes('filtroEtapa'), 'lead stage filter required')
assert(read('src/pages/Relatorios.tsx').includes('filtroOrigem'), 'lead origin filter required')
assert(read('src/pages/Relatorios.tsx').includes('filtroRegiao'), 'lead region filter required')
assert(read('src/pages/Relatorios.tsx').includes('filtroProduto'), 'lead product filter required')
assert(
  read('src/pages/ClientesUnificados.tsx').includes(
    "canEditRevenda = role === 'admin' || role === 'vendedor'",
  ),
  'seller reseller edit UI permission required',
)
assert(
  !read('src/pages/ClientesUnificados.tsx').includes('Modelos comercializados'),
  'reseller models section must be removed',
)
assert(
  !read('src/pages/RevendaDetalhe.tsx').includes('Modelos Homologados'),
  'reseller models detail section must be removed',
)
assert(
  !read('src/pages/Revendas.tsx').includes('Modelos Comercializados'),
  'legacy reseller models section must be removed',
)
assert(
  read('pocketbase/migrations/0016_revenda_edit_own_wallet.js').includes('ownScope'),
  'reseller own-wallet update rule required',
)
assert(
  read('src/services/crmService.ts').includes("acao: 'criar_tarefa_lead'"),
  'task audit required',
)
assert(
  users.apiRules?.delete === undefined || users.apiRules?.delete?.includes("role = 'admin'"),
  'user delete must remain admin-only',
)
console.log('CRM contract checks passed')
