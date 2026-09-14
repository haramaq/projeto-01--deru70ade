import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import type { PermissionKey, UserRole } from '@/types/crm'
import AccessDenied from '@/pages/AccessDenied'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: UserRole[]
  requiredPermission?: PermissionKey
}

export default function ProtectedRoute({ children, allowedRoles, requiredPermission }: ProtectedRouteProps) {
  const { user, isLoading, role, can, refreshUser } = useAuth()
  React.useEffect(() => { if (user) refreshUser() }, [])
  if (isLoading) return <div className="flex min-h-screen items-center justify-center bg-[#F8FAF9]"><div className="flex flex-col items-center gap-3"><div className="h-10 w-10 animate-spin rounded-full border-4 border-[#1B4332] border-t-transparent" /><p className="text-sm font-medium text-gray-500">Carregando Haramaq CRM...</p></div></div>
  if (!user) return <Navigate to="/login" replace />
  if (allowedRoles && !allowedRoles.includes(role)) return <AccessDenied />
  if (requiredPermission && !can(requiredPermission)) return <AccessDenied />
  return <>{children}</>
}
