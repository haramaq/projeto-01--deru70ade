import React, { createContext, useContext, useEffect, useState, useMemo } from 'react'
import pb from '@/lib/pocketbase/client'
import type { User, UserRole } from '@/types/crm'

interface AuthContextType {
  user: User | null
  token: string | null
  role: UserRole
  isLoading: boolean
  login: (email: string, pass: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    if (pb.authStore.isValid && pb.authStore.record) {
      const rec = pb.authStore.record
      return {
        id: rec.id,
        email: rec.email,
        name: rec.name || rec.email.split('@')[0],
        avatar: rec.avatar,
        role: (rec.role as UserRole) || 'vendedor',
        created: rec.created,
        updated: rec.updated,
      }
    }
    return null
  })
  const [isLoading, setIsLoading] = useState<boolean>(true)

  const refreshUser = async () => {
    try {
      if (pb.authStore.isValid && pb.authStore.record?.id) {
        const fresh = await pb.collection('users').getOne(pb.authStore.record.id)
        setUser({
          id: fresh.id,
          email: fresh.email,
          name: fresh.name || fresh.email.split('@')[0],
          avatar: fresh.avatar,
          role: (fresh.role as UserRole) || 'vendedor',
          created: fresh.created,
          updated: fresh.updated,
        })
      } else {
        setUser(null)
      }
    } catch {
      // If token expired
      setUser(null)
    }
  }

  useEffect(() => {
    const unsub = pb.authStore.onChange((token, model) => {
      if (token && model) {
        setUser({
          id: model.id,
          email: model.email,
          name: model.name || model.email.split('@')[0],
          avatar: model.avatar,
          role: (model.role as UserRole) || 'vendedor',
          created: model.created,
          updated: model.updated,
        })
      } else {
        setUser(null)
      }
    })

    refreshUser().finally(() => {
      setIsLoading(false)
    })

    return () => {
      unsub()
    }
  }, [])

  const login = async (email: string, pass: string) => {
    const authData = await pb.collection('users').authWithPassword(email, pass)
    setUser({
      id: authData.record.id,
      email: authData.record.email,
      name: authData.record.name || authData.record.email.split('@')[0],
      avatar: authData.record.avatar,
      role: (authData.record.role as UserRole) || 'vendedor',
      created: authData.record.created,
      updated: authData.record.updated,
    })
  }

  const logout = () => {
    pb.authStore.clear()
    setUser(null)
  }

  const role: UserRole = user?.role || 'vendedor'

  const value = useMemo(
    () => ({
      user,
      token: pb.authStore.token,
      role,
      isLoading,
      login,
      logout,
      refreshUser,
    }),
    [user, role, isLoading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
