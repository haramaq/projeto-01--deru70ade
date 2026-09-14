import React, { useEffect, useMemo, useState } from 'react'
import {
  Users,
  Shield,
  UserPlus,
  Edit2,
  UserX,
  History,
  CheckCircle,
  Lock,
} from 'lucide-react'
import { userService } from '@/services/crmService'
import type { AuditEntry, User, UserRole } from '@/types/crm'
import { formatDateBR } from '@/lib/formatters'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  gestor: 'Gestor',
  triagem: 'Triagem',
  vendedor: 'Vendedor',
  revendedor: 'Revendedor',
  suporte: 'Suporte',
}

const PERMISSION_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  leads: 'Leads / Kanban',
  clientes: 'Clientes',
  revendas: 'Revendas',
  suporte: 'Suporte',
  relatorios: 'Relatórios',
  configuracoes: 'Configurações administrativas',
}

const ROLE_DESCRIPTIONS: { role: UserRole; desc: string; color: string }[] = [
  {
    role: 'admin',
    desc: 'Acesso irrestrito, relatórios gerenciais e administração do sistema.',
    color: 'border-red-300 bg-red-50 text-red-800',
  },
  {
    role: 'gestor',
    desc: 'Acompanha carteiras e auditoria operacional, sem administração global.',
    color: 'border-cyan-300 bg-cyan-50 text-cyan-800',
  },
  {
    role: 'triagem',
    desc: 'Recebe e organiza leads conforme as regras de carteira.',
    color: 'border-amber-300 bg-amber-50 text-amber-800',
  },
  {
    role: 'vendedor',
    desc: 'Atua no Kanban, carteira de clientes e revendas autorizadas.',
    color: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  },
  {
    role: 'revendedor',
    desc: 'Acessa a carteira autorizada para atendimento comercial.',
    color: 'border-purple-300 bg-purple-50 text-purple-800',
  },
  {
    role: 'suporte',
    desc: 'Atende clientes e gerencia chamados de suporte e pós-venda.',
    color: 'border-blue-300 bg-blue-50 text-blue-800',
  },
]

const DEFAULT_PERMISSIONS: Record<string, boolean> = {
  dashboard: false,
  leads: false,
  clientes: false,
  revendas: false,
  suporte: false,
  relatorios: false,
  configuracoes: false,
}

function safePermissions(value?: Record<string, boolean>) {
  return { ...DEFAULT_PERMISSIONS, ...(value || {}) }
}

function auditText(value: unknown) {
  if (value === undefined || value === null || value === '') return '—'
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export default function Configuracoes() {
  const { user } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formRole, setFormRole] = useState<UserRole>('vendedor')
  const [formCarteira, setFormCarteira] = useState('')
  const [formAtivo, setFormAtivo] = useState(true)
  const [formPermissions, setFormPermissions] = useState<Record<string, boolean>>(
    DEFAULT_PERMISSIONS,
  )
  const [submitting, setSubmitting] = useState(false)
  const [auditSearch, setAuditSearch] = useState('')

  const loadAdminData = async () => {
    try {
      const [list, audit] = await Promise.all([userService.getAll(), userService.getAudit()])
      setUsers(list)
      setAuditEntries(audit)
    } catch {
      toast.error('Erro ao carregar o painel administrativo.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAdminData()
  }, [])

  const filteredAudit = useMemo(() => {
    const query = auditSearch.trim().toLowerCase()
    if (!query) return auditEntries
    return auditEntries.filter((entry) =>
      [entry.autor, entry.alvo, entry.acao, auditText(entry.depois)]
        .join(' ')
        .toLowerCase()
        .includes(query),
    )
  }, [auditEntries, auditSearch])

  const handleOpenCreate = () => {
    setEditingUser(null)
    setFormName('')
    setFormEmail('')
    setFormPassword('')
    setFormRole('vendedor')
    setFormCarteira('')
    setFormAtivo(true)
    setFormPermissions(DEFAULT_PERMISSIONS)
    setModalOpen(true)
  }

  const handleOpenEdit = (item: User) => {
    setEditingUser(item)
    setFormName(item.name || '')
    setFormEmail(item.email || '')
    setFormPassword('')
    setFormRole(item.role || 'vendedor')
    setFormCarteira(item.carteira || '')
    setFormAtivo(item.ativo !== false)
    setFormPermissions(safePermissions(item.permissoes))
    setModalOpen(true)
  }

  const handleSaveUser = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!formName.trim() || !formEmail.trim()) {
      toast.error('Nome e e-mail são obrigatórios.')
      return
    }
    if (!editingUser && formPassword.length < 8) {
      toast.error('A senha deve ter no mínimo 8 caracteres.')
      return
    }
    setSubmitting(true)
    try {
      if (editingUser) {
        const before = {
          name: editingUser.name,
          role: editingUser.role,
          carteira: editingUser.carteira || '',
          ativo: editingUser.ativo,
          permissoes: editingUser.permissoes || {},
        }
        const updated = await userService.update(editingUser.id, {
          name: formName.trim(),
          role: formRole,
          carteira: formCarteira.trim(),
          ativo: formAtivo,
          permissoes: formPermissions,
        })
        await userService.audit({
          autor: user?.id || 'sessão atual',
          alvo: editingUser.id,
          acao: 'alterar_usuario_e_permissoes',
          antes: before,
          depois: {
            name: formName.trim(),
            role: formRole,
            carteira: formCarteira.trim(),
            ativo: formAtivo,
            permissoes: formPermissions,
          },
        })
        setUsers((current) => current.map((item) => (item.id === updated.id ? updated : item)))
        toast.success('Usuário atualizado e auditado.')
      } else {
        const created = await userService.create({
          name: formName.trim(),
          email: formEmail.trim(),
          password: formPassword,
          passwordConfirm: formPassword,
          role: formRole,
          carteira: formCarteira.trim(),
          ativo: true,
          permissoes: formPermissions,
        })
        await userService.audit({
          autor: user?.id || 'sessão atual',
          alvo: created.id,
          acao: 'criar_usuario',
          antes: null,
          depois: { name: created.name, email: created.email, role: formRole },
        })
        setUsers((current) => [...current, created])
        toast.success('Usuário criado e auditado.')
      }
      setModalOpen(false)
      setAuditEntries(await userService.getAudit())
    } catch (error) {
      console.error(error)
      toast.error('Erro ao salvar usuário. Verifique os dados e as permissões.')
    } finally {
      setSubmitting(false)
    }
  }

  const toggleUser = async (item: User) => {
    if (item.email === 'elisandrodesousaharamaq@gmail.com' && item.ativo !== false) {
      toast.error('O administrador principal não pode ser desativado.')
      return
    }
    const nextActive = item.ativo === false
    try {
      const updated = await userService.update(item.id, { ativo: nextActive })
      await userService.audit({
        autor: user?.id || 'sessão atual',
        alvo: item.id,
        acao: nextActive ? 'reativar_usuario' : 'desativar_usuario',
        antes: { ativo: item.ativo !== false },
        depois: { ativo: nextActive },
      })
      setUsers((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)))
      setAuditEntries(await userService.getAudit())
      toast.success(nextActive ? 'Usuário reativado.' : 'Usuário desativado.')
    } catch {
      toast.error('Não foi possível alterar o status do usuário.')
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#D92323] border-t-transparent" />
          <p className="text-xs text-gray-500">Carregando painel administrativo...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[1360px] space-y-6 px-4 py-5 sm:px-6 md:py-6 lg:px-8">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-[#1E293B] sm:text-2xl">
              Painel Administrativo
            </h1>
            <Badge className="gap-1 bg-red-50 text-[10px] text-red-700 hover:bg-red-50">
              <Lock className="h-3 w-3" /> Admin
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-[#64748B] sm:text-sm">
            Usuários, carteiras, permissões adicionais e histórico de atividades.
          </p>
        </div>
        <Button
          onClick={handleOpenCreate}
          className="h-9 self-start gap-2 rounded-lg bg-[#D92323] text-xs font-semibold text-white hover:bg-[#B91C1C] sm:self-auto"
        >
          <UserPlus className="h-4 w-4" /> Novo usuário
        </Button>
      </div>

      <Tabs defaultValue="usuarios" className="space-y-5">
        <TabsList className="grid h-auto w-full grid-cols-3 bg-white p-1 shadow-xs sm:w-fit sm:flex">
          <TabsTrigger value="usuarios" className="gap-2 text-xs">
            <Users className="h-3.5 w-3.5" /> Usuários
          </TabsTrigger>
          <TabsTrigger value="perfis" className="gap-2 text-xs">
            <Shield className="h-3.5 w-3.5" /> Perfis
          </TabsTrigger>
          <TabsTrigger value="auditoria" className="gap-2 text-xs">
            <History className="h-3.5 w-3.5" /> Auditoria
          </TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios" className="space-y-5">
          <Card className="overflow-hidden rounded-xl border-[#E2E8F0] bg-white shadow-xs">
            <CardHeader className="border-b border-[#F1F5F9] pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-bold text-[#1E293B]">
                <Users className="h-4 w-4 text-[#D92323]" /> Usuários cadastrados ({users.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-left text-xs">
                  <thead className="border-b border-[#E5E7EB] bg-[#F8FAF9] text-gray-500">
                    <tr>
                      <th className="px-4 py-3">Usuário</th>
                      <th className="px-4 py-3">Perfil</th>
                      <th className="px-4 py-3">Carteira</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Cadastro</th>
                      <th className="px-4 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB]">
                    {users.map((item) => (
                      <tr key={item.id} className={cn('hover:bg-gray-50/70', item.ativo === false && 'opacity-60')}>
                        <td className="px-4 py-3.5">
                          <p className="font-bold text-gray-900">{item.name || 'Sem nome'}</p>
                          <p className="font-mono text-[11px] text-gray-500">{item.email}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <Badge variant="outline" className="text-[10px] font-semibold uppercase">
                            {ROLE_LABELS[item.role] || item.role}
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5 text-gray-600">{item.carteira || 'Todas / não definida'}</td>
                        <td className="px-4 py-3.5">
                          <Badge
                            variant="outline"
                            className={item.ativo === false ? 'border-gray-200 bg-gray-50 text-gray-500' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}
                          >
                            {item.ativo === false ? 'Inativo' : 'Ativo'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5 text-gray-500">{formatDateBR(item.created)}</td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex justify-end gap-1.5">
                            <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(item)} className="h-8 w-8 p-0 text-gray-500 hover:bg-blue-50 hover:text-blue-600" title="Editar usuário">
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            {item.email !== 'elisandrodesousaharamaq@gmail.com' && (
                              <Button variant="ghost" size="sm" onClick={() => void toggleUser(item)} className="h-8 w-8 p-0 text-gray-500 hover:bg-red-50 hover:text-red-600" title={item.ativo === false ? 'Reativar usuário' : 'Desativar usuário'}>
                                {item.ativo === false ? <CheckCircle className="h-3.5 w-3.5" /> : <UserX className="h-3.5 w-3.5" />}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="perfis">
          <Card className="rounded-xl border-[#E2E8F0] bg-white shadow-xs">
            <CardHeader className="border-b border-[#F1F5F9] pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-bold text-[#1E293B]">
                <Shield className="h-4 w-4 text-[#D92323]" /> Perfis existentes preservados
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3.5 p-4 md:grid-cols-3">
              {ROLE_DESCRIPTIONS.map((item) => (
                <div key={item.role} className="space-y-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3.5">
                  <Badge variant="outline" className={cn('text-[10px] font-bold uppercase', item.color)}>
                    {ROLE_LABELS[item.role]}
                  </Badge>
                  <p className="text-xs leading-relaxed text-[#64748B]">{item.desc}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="auditoria" className="space-y-4">
          <div className="flex items-center gap-2">
            <Input value={auditSearch} onChange={(event) => setAuditSearch(event.target.value)} placeholder="Filtrar por usuário, ação ou alvo..." className="h-9 max-w-md text-xs" />
            <Badge variant="outline" className="text-xs">{filteredAudit.length} eventos</Badge>
          </div>
          <Card className="overflow-hidden rounded-xl border-[#E2E8F0] bg-white shadow-xs">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-xs">
                  <thead className="border-b border-[#E5E7EB] bg-[#F8FAF9] text-gray-500">
                    <tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Autor</th><th className="px-4 py-3">Ação</th><th className="px-4 py-3">Alvo</th><th className="px-4 py-3">Alteração</th></tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB]">
                    {filteredAudit.map((entry) => (
                      <tr key={entry.id}>
                        <td className="whitespace-nowrap px-4 py-3 text-gray-500">{formatDateBR(entry.created)}</td>
                        <td className="px-4 py-3 font-mono text-gray-600">{entry.autor}</td>
                        <td className="px-4 py-3 font-semibold text-gray-800">{entry.acao}</td>
                        <td className="px-4 py-3 font-mono text-gray-600">{entry.alvo}</td>
                        <td className="max-w-[420px] px-4 py-3 text-gray-500">{auditText(entry.depois)}</td>
                      </tr>
                    ))}
                    {!filteredAudit.length && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Nenhum evento de auditoria encontrado.</td></tr>}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1B4332]">
              {editingUser ? 'Editar usuário, carteira e permissões' : 'Novo usuário do sistema'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveUser} className="space-y-4 pt-2 text-xs">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1"><Label htmlFor="uName">Nome completo</Label><Input id="uName" value={formName} onChange={(e) => setFormName(e.target.value)} required /></div>
              <div className="space-y-1"><Label htmlFor="uEmail">E-mail corporativo</Label><Input id="uEmail" type="email" disabled={!!editingUser} value={formEmail} onChange={(e) => setFormEmail(e.target.value)} required /></div>
            </div>
            {!editingUser && <div className="space-y-1"><Label htmlFor="uPass">Senha provisória (mínimo 8 caracteres)</Label><Input id="uPass" type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} required /></div>}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1"><Label>Perfil base</Label><Select value={formRole} onValueChange={(value) => setFormRole(value as UserRole)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(Object.keys(ROLE_LABELS) as UserRole[]).map((role) => <SelectItem key={role} value={role}>{ROLE_LABELS[role]}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label htmlFor="uWallet">Carteira / território</Label><Input id="uWallet" value={formCarteira} onChange={(e) => setFormCarteira(e.target.value)} placeholder="Ex.: Sul de MG" /></div>
            </div>
            {editingUser && <div className="flex items-center justify-between rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3"><div><p className="font-semibold text-gray-800">Usuário ativo</p><p className="text-[11px] text-gray-500">Usuários inativos perdem acesso após a revalidação da sessão.</p></div><Switch checked={formAtivo} onCheckedChange={setFormAtivo} /></div>}
            <div className="rounded-lg border border-[#E2E8F0] p-3"><p className="mb-2 font-semibold text-gray-800">Permissões adicionais registradas</p><p className="mb-3 text-[11px] text-gray-500">O perfil base continua preservado; estas marcações ficam registradas para controle administrativo.</p><div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{Object.entries(PERMISSION_LABELS).map(([key, label]) => <label key={key} className="flex items-center gap-2 text-gray-700"><Switch checked={!!formPermissions[key]} onCheckedChange={(checked) => setFormPermissions((current) => ({ ...current, [key]: checked }))} /><span>{label}</span></label>)}</div></div>
            <DialogFooter className="pt-3"><Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button><Button type="submit" disabled={submitting} className="bg-[#DC2626] text-white hover:bg-[#B91C1C]">{submitting ? 'Salvando...' : 'Salvar usuário'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
