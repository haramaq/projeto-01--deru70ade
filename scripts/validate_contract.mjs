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
const schema = JSON.parse(read('src/lib/pocketbase/schema.json'))
const hardening = read('pocketbase/migrations/0010_security_permissions_and_lead_scope.js')

assert(!login.includes('Skip@Pass'), 'default admin password must not be in the login UI')
assert(vendas.includes("'fornecedores'"), 'Kanban must contain Fornecedores')
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
const admin = read('src/pages/Configuracoes.tsx')
assert(admin.includes('formPasswordConfirm'), 'user password confirmation required')
assert(admin.includes('passwordConfirm: formPassword'), 'user auth payload confirmation required')
console.log('CRM contract checks passed')
