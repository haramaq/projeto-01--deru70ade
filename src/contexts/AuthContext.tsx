import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import type { PermissionKey, User, UserRole } from '@/types/crm'
import { hasPermission } from '@/lib/permissions'

interface AuthContextType {
  user: User | null
  token: string | null
  role: UserRole
  isLoading: boolean
  can: (permission: PermissionKey) => boolean
  login: (email: string, pass: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}
const AuthContext = createContext<AuthContextType | undefined>(undefined)
function toUser(record: Record<string, any>): User { return { id: record.id, email: record.email, name: record.name || record.email.split('@')[0], avatar: record.avatar, role: (record.role as UserRole) || 'vendedor', ativo: record.ativo !== false, carteira: record.carteira || '', perm_dashboard: record.perm_dashboard === true, perm_leads: record.perm_leads === true, perm_clientes: record.perm_clientes === true, perm_revendas: record.perm_revendas === true, perm_suporte: record.perm_suporte === true, perm_relatorios: record.perm_relatorios === true, perm_configuracoes: record.perm_configuracoes === true, permissoes: record.permissoes || {}, created: record.created, updated: record.updated } }
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => pb.authStore.isValid && pb.authStore.record ? toUser(pb.authStore.record as Record<string, any>) : null)
  const [isLoading, setIsLoading] = useState(true)
  const refreshUser = async () => { try { if (pb.authStore.isValid && pb.authStore.record?.id) { const fresh = await pb.collection('users').getOne(pb.authStore.record.id); if (fresh.ativo === false) { pb.authStore.clear(); setUser(null); return }; setUser(toUser(fresh as Record<string, any>)) } else setUser(null) } catch { pb.authStore.clear(); setUser(null) } }
  useEffect(() => { const unsub = pb.authStore.onChange((token, model) => token && model ? setUser(toUser(model as Record<string, any>)) : setUser(null)); refreshUser().finally(() => setIsLoading(false)); const interval = window.setInterval(() => { if (pb.authStore.isValid) refreshUser() }, 60000); return () => { unsub(); window.clearInterval(interval) } }, [])
  const login = async (email: string, pass: string) => { const authData = await pb.collection('users').authWithPassword(email, pass); setUser(toUser(authData.record as Record<string, any>)) }
  const logout = () => { pb.authStore.clear(); setUser(null) }
  const role: UserRole = user?.role || 'vendedor'
  const can = (permission: PermissionKey) => hasPermission(user, permission)
  const value = useMemo(() => ({ user, token: pb.authStore.token, role, isLoading, can, login, logout, refreshUser }), [user, role, isLoading])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
export function useAuth() { const context = useContext(AuthContext); if (!context) throw new Error('useAuth must be used within an AuthProvider'); return context }
