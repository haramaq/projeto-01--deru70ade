import type { PermissionKey, User, UserRole } from '@/types/crm'

const ROLE_PERMISSIONS: Record<UserRole, readonly PermissionKey[]> = {
  admin: ['dashboard', 'leads', 'clientes', 'revendas', 'suporte', 'relatorios', 'configuracoes'],
  gestor: ['leads'],
  triagem: ['leads'],
  vendedor: ['dashboard', 'leads', 'clientes', 'revendas'],
  revendedor: ['leads'],
  suporte: ['dashboard', 'leads', 'clientes', 'suporte'],
}
const PERMISSION_FIELDS: Record<PermissionKey, keyof User> = {
  dashboard: 'perm_dashboard', leads: 'perm_leads', clientes: 'perm_clientes', revendas: 'perm_revendas', suporte: 'perm_suporte', relatorios: 'perm_relatorios', configuracoes: 'perm_configuracoes',
}
export function hasPermission(user: User | null, permission: PermissionKey) {
  if (!user || user.ativo === false) return false
  return ROLE_PERMISSIONS[user.role].includes(permission) || user[PERMISSION_FIELDS[permission]] === true
}
export function permissionsForRole(role: UserRole): Record<PermissionKey, boolean> {
  return Object.fromEntries((Object.keys(PERMISSION_FIELDS) as PermissionKey[]).map((key) => [key, ROLE_PERMISSIONS[role].includes(key)])) as Record<PermissionKey, boolean>
}
export const permissionFieldNames = PERMISSION_FIELDS
