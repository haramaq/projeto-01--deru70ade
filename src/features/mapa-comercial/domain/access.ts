import type { UserRole } from '@/types/crm'

export const MAP_ALLOWED_ROLES: UserRole[] = ['admin', 'gestor']

export function canAccessCommercialMap(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'gestor'
}
