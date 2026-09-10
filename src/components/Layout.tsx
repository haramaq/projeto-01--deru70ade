import React, { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  TrendingUp,
  Users,
  Building2,
  Headphones,
  BarChart3,
  Settings,
  LogOut,
  Bell,
  Menu,
  X,
  UserPlus,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { ticketService } from '@/services/crmService'
import useRealtime from '@/hooks/use-realtime'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export default function Layout() {
  const { user, role, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openTicketsCount, setOpenTicketsCount] = useState<number>(0)
  const [bellPulse, setBellPulse] = useState(false)

  // Fetch ticket count
  const fetchOpenTickets = async () => {
    try {
      const count = await ticketService.countOpen()
      setOpenTicketsCount(count)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    fetchOpenTickets()
  }, [])

  // Realtime subscription for tickets
  useRealtime('tickets', () => {
    fetchOpenTickets()
    setBellPulse(true)
    setTimeout(() => setBellPulse(false), 800)
  })

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  // Navigation items based on role
  // Suporte: Dashboard, Clientes, Suporte
  // Vendedor: Dashboard, Vendas, Clientes, Revendas
  // Admin: All
  const navItems = [
    {
      title: 'Dashboard',
      path: '/',
      icon: LayoutDashboard,
      roles: ['admin', 'vendedor', 'suporte'],
    },
    {
      title: 'Vendas',
      path: '/vendas',
      icon: TrendingUp,
      roles: ['admin', 'vendedor'],
    },
    {
      title: 'Clientes',
      path: '/clientes',
      icon: Users,
      roles: ['admin', 'vendedor', 'suporte'],
    },
    {
      title: 'Revendas',
      path: '/revendas',
      icon: Building2,
      roles: ['admin', 'vendedor'],
    },
    {
      title: 'Suporte',
      path: '/suporte',
      icon: Headphones,
      roles: ['admin', 'suporte'],
    },
    {
      title: 'Relatórios',
      path: '/relatorios',
      icon: BarChart3,
      roles: ['admin'],
    },
    {
      title: 'Configurações',
      path: '/configuracoes',
      icon: Settings,
      roles: ['admin'],
    },
  ].filter((item) => item.roles.includes(role))

  // Page title mapping
  const getPageTitle = () => {
    const path = location.pathname
    if (path === '/') return 'Dashboard'
    if (path.startsWith('/vendas')) return 'Funil de Vendas'
    if (path.startsWith('/clientes/')) return 'Detalhes do Cliente'
    if (path.startsWith('/clientes')) return 'Clientes'
    if (path.startsWith('/revendas/')) return 'Detalhes da Revenda'
    if (path.startsWith('/revendas')) return 'Revendas Autorizadas'
    if (path.startsWith('/suporte')) return 'Suporte ao Cliente'
    if (path.startsWith('/relatorios')) return 'Relatórios e Análises'
    if (path.startsWith('/configuracoes')) return 'Configurações do Sistema'
    return 'Haramaq CRM'
  }

  const roleLabels: Record<string, string> = {
    admin: 'Administrador',
    gestor: 'Gestor',
    triagem: 'Triagem',
    vendedor: 'Vendedor',
    revendedor: 'Revendedor',
    suporte: 'Suporte',
  }

  const roleColors: Record<string, string> = {
    admin: 'bg-red-500/20 text-red-300 border-red-500/30',
    gestor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    triagem: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    vendedor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    revendedor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    suporte: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  }

  const canCreateClient = ['admin', 'gestor', 'triagem', 'vendedor', 'revendedor'].includes(role)

  return (
    <div className="flex min-h-screen bg-[#F8FAF9]">
      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-xs transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-[280px] bg-[#1B4332] text-white flex flex-col justify-between transition-transform duration-300 ease-in-out md:translate-x-0 shadow-xl',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        {/* Top brand header */}
        <div className="flex flex-col">
          <div className="h-16 flex items-center justify-between px-6 border-b border-emerald-900/40">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black tracking-tight text-white flex items-center">
                HARAMAQ
                <span className="inline-block w-2 h-2 bg-[#DC2626] ml-1 rounded-[2px]" />
              </span>
            </div>
            <button
              onClick={() => setMobileOpen(false)}
              className="md:hidden text-emerald-300 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-emerald-300/60">
            Vagões Misturadores &bull; CRM
          </div>

          {/* Nav Items */}
          <nav className="px-3 py-2 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                      isActive
                        ? 'bg-[#2D6A4F] text-white border-l-4 border-[#DC2626] shadow-inner font-semibold'
                        : 'text-emerald-100/75 hover:text-white hover:bg-[#2D6A4F]/50',
                    )
                  }
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.title}</span>
                  {item.path === '/suporte' && openTicketsCount > 0 && (
                    <span className="ml-auto bg-[#DC2626] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {openTicketsCount}
                    </span>
                  )}
                </NavLink>
              )
            })}
          </nav>
        </div>

        {/* User Card at bottom */}
        <div className="p-4 border-t border-emerald-900/50 bg-[#163628]">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-[#2D6A4F] border-2 border-emerald-400/40 flex items-center justify-center font-bold text-base text-white shrink-0 shadow-sm">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">{user?.name || 'Usuário'}</p>
              <p className="text-[11px] text-emerald-200/70 truncate">{user?.email}</p>
              <Badge
                variant="outline"
                className={cn('text-[10px] font-medium py-0 px-1.5 mt-0.5', roleColors[role])}
              >
                {roleLabels[role] || role}
              </Badge>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              logout()
              navigate('/login')
            }}
            className="w-full justify-start text-xs text-red-300 hover:text-white hover:bg-red-600/20 gap-2 h-8 px-2 rounded-lg"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sair do sistema
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:pl-[280px] min-h-screen">
        {/* Top Bar (64px) */}
        <header className="sticky top-0 z-30 h-16 bg-white border-b border-[#E5E7EB] px-4 md:px-8 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden p-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              aria-label="Abrir menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex flex-col">
              <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                <span>Haramaq</span>
                <span>/</span>
                <span className="text-gray-900 font-semibold">{getPageTitle()}</span>
              </div>
              <h1 className="text-base md:text-lg font-bold text-[#1B4332] hidden sm:block">
                {getPageTitle()}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick Action: Novo Cliente */}
            {canCreateClient && (
              <Button
                size="sm"
                onClick={() => navigate('/clientes?novo=true')}
                className="hidden sm:inline-flex bg-[#1B4332] hover:bg-[#2D6A4F] text-white text-xs font-semibold gap-1.5 h-9 rounded-xl shadow-xs transition-transform hover:scale-[1.02]"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Novo Cliente
              </Button>
            )}

            {/* Notification Bell */}
            <button
              onClick={() => navigate('/suporte')}
              className={cn(
                'relative p-2 rounded-xl text-gray-600 hover:text-[#1B4332] hover:bg-gray-100 transition-transform duration-200',
                bellPulse && 'scale-110',
              )}
              title={`${openTicketsCount} tickets em aberto`}
            >
              <Bell className="w-5 h-5" />
              {openTicketsCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-[#DC2626] text-white text-[9px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
                  {openTicketsCount > 9 ? '9+' : openTicketsCount}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-[1440px] w-full mx-auto animate-fade-in-up">
          <Outlet />
        </main>

        {/* Footer */}
        <footer className="py-4 text-center text-xs text-gray-400 border-t border-[#E5E7EB] bg-white">
          &copy; 2025 Haramaq &mdash; Sistema de Gestão de Vendas e Revendas &bull; Inovação e
          tecnologia para o campo
        </footer>
      </div>
    </div>
  )
}
