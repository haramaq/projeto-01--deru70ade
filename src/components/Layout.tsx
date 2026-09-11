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
  User as UserIcon,
  Shield,
  HelpCircle,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { ticketService } from '@/services/crmService'
import useRealtime from '@/hooks/use-realtime'
import { HaramaqLogo } from '@/components/haramaq/HaramaqLogo'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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

  // Realtime subscription for tickets count
  useRealtime('tickets', () => {
    fetchOpenTickets()
    setBellPulse(true)
    setTimeout(() => setBellPulse(false), 800)
  })

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  // Navigation items based on role (PRESERVED RULES):
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
      title: 'Leads / Kanban',
      path: '/vendas',
      icon: TrendingUp,
      roles: ['admin', 'gestor', 'triagem', 'vendedor', 'revendedor', 'suporte'],
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
      badgeCount: openTicketsCount,
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

  const roleLabels: Record<string, string> = {
    admin: 'Administrador',
    gestor: 'Gestor',
    triagem: 'Triagem',
    vendedor: 'Vendedor',
    revendedor: 'Revendedor',
    suporte: 'Suporte Técnico',
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-[#F1F3F5] flex flex-col text-[#1E293B]">
      {/*
        1. RED INSTITUTIONAL HEADER (HARAMAQ)
        Matches reference screenshots:
        - Compact height (~52px)
        - Full-width red (#D92323 / #DC2626)
        - White square logo tile + HARAMAQ wordmark + module tag "CRM"
        - Subtle bottom shadow
        - Action icons on right: Bell with tickets counter, Security/Role, User, Logout
      */}
      <header className="sticky top-0 z-40 h-[54px] bg-[#D92323] text-white shadow-[0_2px_4px_-1px_rgba(0,0,0,0.1),0_4px_6px_-1px_rgba(0,0,0,0.12)]">
        <div className="max-w-[1440px] h-full mx-auto px-4 sm:px-6 flex items-center justify-between">
          {/* Left: Mobile hamburger + Haramaq Brand Logo */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-1.5 text-white/90 hover:text-white hover:bg-white/10 rounded-md transition-colors"
              aria-label="Abrir menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <NavLink to="/" className="flex items-center focus:outline-none">
              <HaramaqLogo module="CRM" size="md" inverted={true} />
            </NavLink>
          </div>

          {/* Right Header Action Icons */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Notification Bell (Suporte Chamados) */}
            <button
              type="button"
              onClick={() => navigate('/suporte')}
              className={cn(
                'relative p-2 rounded-full text-white/90 hover:text-white hover:bg-white/10 transition-all duration-150',
                bellPulse && 'scale-110',
              )}
              title={
                openTicketsCount > 0
                  ? `${openTicketsCount} tickets em aberto no suporte`
                  : 'Central de Suporte'
              }
              aria-label="Notificações de chamados"
            >
              <Bell className="w-5 h-5" />
              {openTicketsCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-white text-[#D92323] text-[10px] font-black rounded-full flex items-center justify-center px-1 shadow-xs ring-1 ring-[#D92323]">
                  {openTicketsCount > 9 ? '9+' : openTicketsCount}
                </span>
              )}
            </button>

            {/* User Profile Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white focus:outline-none"
                  aria-label="Perfil do usuário"
                >
                  <div className="w-7 h-7 rounded-full bg-white/20 border border-white/40 flex items-center justify-center text-xs font-bold text-white uppercase shadow-xs">
                    {user?.name ? (
                      user.name.charAt(0).toUpperCase()
                    ) : (
                      <UserIcon className="w-4 h-4" />
                    )}
                  </div>
                  <div className="hidden lg:flex flex-col text-left leading-none">
                    <span className="text-xs font-bold text-white max-w-[120px] truncate">
                      {user?.name?.split(' ')[0] || 'Usuário'}
                    </span>
                    <span className="text-[10px] text-white/80 font-normal">
                      {roleLabels[role] || role}
                    </span>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-56 p-2 rounded-xl shadow-lg border border-gray-100"
              >
                <DropdownMenuLabel className="font-normal px-2 py-1.5">
                  <p className="text-xs font-bold text-gray-900 truncate">
                    {user?.name || 'Usuário Haramaq'}
                  </p>
                  <p className="text-[11px] text-gray-500 truncate">{user?.email}</p>
                  <div className="mt-1.5">
                    <Badge
                      variant="outline"
                      className="text-[10px] uppercase font-semibold text-[#D92323] border-[#FCA5A5] bg-[#FEE2E2]"
                    >
                      {roleLabels[role] || role}
                    </Badge>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {role === 'admin' && (
                  <DropdownMenuItem
                    onClick={() => navigate('/configuracoes')}
                    className="text-xs text-gray-700 cursor-pointer gap-2 py-2"
                  >
                    <Settings className="w-4 h-4 text-gray-500" />
                    <span>Configurações do Sistema</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => navigate('/suporte')}
                  className="text-xs text-gray-700 cursor-pointer gap-2 py-2"
                >
                  <HelpCircle className="w-4 h-4 text-gray-500" />
                  <span>Central de Suporte</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-xs text-[#DC2626] font-semibold cursor-pointer gap-2 py-2 focus:bg-red-50 focus:text-[#DC2626]"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sair do sistema</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Direct Logout Icon (matching reference top-right arrow) */}
            <button
              type="button"
              onClick={handleLogout}
              className="p-1.5 text-white/90 hover:text-white hover:bg-white/10 rounded-md transition-colors"
              title="Sair do sistema"
              aria-label="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/*
        2. HORIZONTAL MODULE TABS BAR (DESKTOP)
        Matches the reference screenshots ("Inspeções | Dashboard Gargalos | Pós-Venda"):
        - Positioned right below the red header
        - Sub-navigation strip with active item in a white pill with subtle shadow
        - Clean light gray background (#FFFFFF or #F8FAFC)
        - Preserves all RBAC visibility
      */}
      <nav className="hidden md:block bg-white border-b border-[#E2E8F0] shadow-2xs">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-1 py-1.5 overflow-x-auto no-scrollbar">
            {navItems.map((item) => {
              const Icon = item.icon
              const isExact = item.path === '/'
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={isExact}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-150',
                      isActive
                        ? 'bg-[#FEE2E2] text-[#D92323] shadow-2xs font-bold border border-[#FCA5A5]/60'
                        : 'text-[#475569] hover:text-[#1E293B] hover:bg-[#F1F5F9]',
                    )
                  }
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{item.title}</span>
                  {item.badgeCount !== undefined && item.badgeCount > 0 && (
                    <span className="ml-1 bg-[#D92323] text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                      {item.badgeCount}
                    </span>
                  )}
                </NavLink>
              )
            })}
          </div>
        </div>
      </nav>

      {/* Mobile Drawer Navigation */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-2xs transition-opacity"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-[280px] bg-white text-[#1E293B] flex flex-col shadow-2xl z-50">
            {/* Drawer Header with Red Banner */}
            <div className="h-14 bg-[#D92323] px-4 flex items-center justify-between text-white">
              <HaramaqLogo module="CRM" size="sm" inverted={true} />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="p-1 text-white/80 hover:text-white rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* User Info Strip */}
            <div className="p-4 bg-[#F8FAFC] border-b border-[#E2E8F0]">
              <p className="text-xs font-bold text-gray-900 truncate">{user?.name || 'Usuário'}</p>
              <p className="text-[11px] text-gray-500 truncate">{user?.email}</p>
              <Badge
                variant="outline"
                className="text-[10px] uppercase font-semibold text-[#D92323] border-[#FCA5A5] bg-[#FEE2E2] mt-1.5"
              >
                {roleLabels[role] || role}
              </Badge>
            </div>

            {/* Nav list */}
            <div className="flex-1 p-3 space-y-1 overflow-y-auto">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] px-3 py-1">
                Módulos do Sistema
              </div>
              {navItems.map((item) => {
                const Icon = item.icon
                const isExact = item.path === '/'
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={isExact}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors',
                        isActive
                          ? 'bg-[#FEE2E2] text-[#D92323] font-bold border border-[#FCA5A5]/60'
                          : 'text-[#475569] hover:bg-[#F1F5F9] hover:text-[#1E293B]',
                      )
                    }
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.title}</span>
                    {item.badgeCount !== undefined && item.badgeCount > 0 && (
                      <span className="ml-auto bg-[#D92323] text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                        {item.badgeCount}
                      </span>
                    )}
                  </NavLink>
                )
              })}
            </div>

            {/* Drawer Logout */}
            <div className="p-3 border-t border-[#E2E8F0] bg-[#F8FAFC]">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold text-[#DC2626] hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Sair do sistema</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/*
        3. MAIN CONTROLLED CONTENT AREA
        - Light gray background (#F1F3F5)
        - Controlled max-width with side margins (not 100% fluid)
        - High information density, clean typography
      */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/*
        4. HARAMAQ CLEAN FOOTER
      */}
      <footer className="mt-auto py-3 border-t border-[#E2E8F0] bg-white text-center text-xs text-[#64748B]">
        <div className="max-w-[1440px] mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            &copy; {new Date().getFullYear()} HARAMAQ &mdash; Tecnologia para o manejo alimentar do
            rebanho
          </span>
          <span className="text-[11px] text-[#94A3B8]">
            Prohmix &bull; Supermix &bull; Tipper &bull; Vagões Rodoviários
          </span>
        </div>
      </footer>
    </div>
  )
}
