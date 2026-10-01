import React, { useEffect, useMemo, useState } from 'react'
import {
  Users,
  Shield,
  UserPlus,
  Edit2,
  UserX,
  Trash2,
  History,
  CheckCircle,
  Lock,
  Eye,
} from 'lucide-react'
import { userService } from '@/services/crmService'
import type { AuditEntry, PermissionKey, User, UserRole } from '@/types/crm'
import { permissionFieldNames } from '@/lib/permissions'
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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

const PERMISSION_LABELS: Record<PermissionKey, string> = {
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

function safePermissions(value?: User) {
  const legacy = value?.permissoes || {}
  return {
    ...DEFAULT_PERMISSIONS,
    dashboard: value?.perm_dashboard ?? legacy.dashboard ?? false,
    leads: value?.perm_leads ?? legacy.leads ?? false,
    clientes: value?.perm_clientes ?? legacy.clientes ?? false,
    revendas: value?.perm_revendas ?? legacy.revendas ?? false,
    suporte: value?.perm_suporte ?? legacy.suporte ?? false,
    relatorios: value?.perm_relatorios ?? legacy.relatorios ?? false,
    configuracoes: value?.perm_configuracoes ?? legacy.configuracoes ?? false,
  }
}

const AUDIT_FIELD_LABELS: Record<string, string> = {
  name: 'Nome',
  nome: 'Nome',
  email: 'E-mail',
  role: 'Perfil',
  carteira: 'Carteira',
  ativo: 'Status',
  permissoes: 'Permissões',
  etapa: 'Etapa',
  etapa_anterior: 'Etapa anterior',
  etapa_nova: 'Nova etapa',
  produto: 'Linha de produto',
  categoria_produto: 'Categoria',
  origem: 'Origem',
  origem_lead: 'Origem do lead',
  probabilidade: 'Probabilidade',
  valor: 'Valor potencial',
  razao_social: 'Razão social',
  nome_fantasia: 'Nome fantasia',
  documento: 'Documento',
  documento_tipo: 'Tipo de documento',
  cidade: 'Cidade',
  estado: 'Estado',
  telefone: 'Telefone',
  responsavel: 'Responsável',
  responsavel_usuario: 'Responsável',
  vendedor: 'Responsável',
  usuario_origem: 'Usuário de origem',
  usuario_destino: 'Usuário de destino',
  status: 'Status',
  status_lead: 'Status do lead',
  status_motivo_codigo: 'Motivo',
  proxima_acao: 'Próxima ação',
}

function isAuditRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function auditText(value: unknown) {
  if (value === undefined || value === null || value === '') return 'vazio'
  if (typeof value === 'boolean') return value ? 'Ativo' : 'Inativo'
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function auditFieldLabel(key: string) {
  return (
    AUDIT_FIELD_LABELS[key] || key.replace(/_/g, ' ').replace(/^./, (char) => char.toUpperCase())
  )
}

function auditUserLabel(value: unknown, usersById: Map<string, User>) {
  if (value === undefined || value === null || value === '') return 'vazio'
  if (typeof value !== 'string') return auditText(value)
  if (value === 'sessão atual') return 'Sessão atual'
  const user = usersById.get(value)
  if (user) return user.name || user.email
  if (/^[a-z0-9]{15}$/.test(value)) return 'Usuário não localizado'
  return value
}

function auditValueLabel(value: unknown, key: string, usersById: Map<string, User>) {
  return [
    'autor',
    'vendedor',
    'responsavel',
    'responsavel_usuario',
    'usuario_origem',
    'usuario_destino',
  ].includes(key)
    ? auditUserLabel(value, usersById)
    : auditText(value)
}

function auditTargetLabel(value: string, usersById: Map<string, User>) {
  const user = usersById.get(value)
  if (user) return user.name || user.email
  if (!value) return 'Não informado'
  if (/^[a-z0-9]{15}$/.test(value)) return `Registro afetado (${value.slice(0, 6)}…)`
  return value
}

function auditRecordSummary(value: Record<string, unknown>, usersById: Map<string, User>) {
  const preferredKeys = [
    'name',
    'nome',
    'razao_social',
    'nome_fantasia',
    'email',
    'role',
    'carteira',
    'etapa',
    'produto',
    'status',
  ]
  return preferredKeys
    .filter((key) => value[key] !== undefined && value[key] !== null && value[key] !== '')
    .slice(0, 3)
    .map((key) => `${auditFieldLabel(key)}: ${auditValueLabel(value[key], key, usersById)}`)
    .join(' · ')
}

function auditChangeSummary(entry: AuditEntry, usersById: Map<string, User>) {
  const before = isAuditRecord(entry.antes) ? entry.antes : null
  const after = isAuditRecord(entry.depois) ? entry.depois : null
  if (before && after) {
    const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).filter(
      (key) => !['id', 'created', 'updated', 'expand'].includes(key),
    )
    const changes = keys
      .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
      .map(
        (key) =>
          `${auditFieldLabel(key)} alterado de “${auditValueLabel(before[key], key, usersById)}” para “${auditValueLabel(after[key], key, usersById)}”`,
      )
    return changes.length
      ? changes.slice(0, 4).join('; ')
      : 'Nenhuma alteração de campo registrada.'
  }
  if (before && entry.depois === null)
    return auditRecordSummary(before, usersById)
      ? `Registro removido — ${auditRecordSummary(before, usersById)}`
      : 'Registro removido.'
  if (after && (entry.antes === null || entry.antes === undefined))
    return auditRecordSummary(after, usersById)
      ? `Registro criado — ${auditRecordSummary(after, usersById)}`
      : 'Registro criado.'
  if (entry.antes !== undefined || entry.depois !== undefined)
    return `Alterado de “${auditText(entry.antes)}” para “${auditText(entry.depois)}”`
  return 'Evento registrado.'
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
  const [formPasswordConfirm, setFormPasswordConfirm] = useState('')
  const [formRole, setFormRole] = useState<UserRole>('vendedor')
  const [formCarteira, setFormCarteira] = useState('')
  const [formAtivo, setFormAtivo] = useState(true)
  const [formPermissions, setFormPermissions] =
    useState<Record<string, boolean>>(DEFAULT_PERMISSIONS)
  const [submitting, setSubmitting] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<User | null>(null)
  const [removing, setRemoving] = useState(false)
  const [auditSearch, setAuditSearch] = useState('')
  const [selectedAudit, setSelectedAudit] = useState<AuditEntry | null>(null)

  const loadAdminData = async () => {
    let listLoaded = false
    try {
      const list = await userService.getAll()
      setUsers(list)
      listLoaded = true
    } catch {
      toast.error('Erro ao carregar os usuários do painel administrativo.')
    }
    try {
      setAuditEntries(await userService.getAudit())
    } catch {
      if (!listLoaded) toast.error('Erro ao carregar o painel administrativo.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAdminData()
  }, [])

  const auditBestEffort = async (data: Parameters<typeof userService.audit>[0]) => {
    try {
      await userService.audit(data)
      return true
    } catch (error) {
      console.warn('Usuário salvo, mas não foi possível registrar a auditoria.', error)
      return false
    }
  }

  const usersById = useMemo(() => new Map(users.map((item) => [item.id, item])), [users])
  const filteredAudit = useMemo(() => {
    const query = auditSearch.trim().toLowerCase()
    if (!query) return auditEntries
    return auditEntries.filter((entry) =>
      [
        auditUserLabel(entry.autor, usersById),
        auditTargetLabel(entry.alvo, usersById),
        entry.acao,
        auditChangeSummary(entry, usersById),
        auditText(entry.antes),
        auditText(entry.depois),
      ]
        .join(' ')
        .toLowerCase()
        .includes(query),
    )
  }, [auditEntries, auditSearch, usersById])

  const handleOpenCreate = () => {
    setEditingUser(null)
    setFormName('')
    setFormEmail('')
    setFormPassword('')
    setFormPasswordConfirm('')
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
    setFormPasswordConfirm('')
    setFormRole(item.role || 'vendedor')
    setFormCarteira(item.carteira || '')
    setFormAtivo(item.ativo !== false)
    setFormPermissions(safePermissions(item))
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
    if (!editingUser && formPassword !== formPasswordConfirm) {
      toast.error('A confirmação da senha não confere.')
      return
    }
    if (
      !editingUser &&
      users.some((item) => item.email.toLowerCase() === formEmail.trim().toLowerCase())
    ) {
      toast.error('Já existe um usuário com este e-mail.')
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
        const permissionPayload = Object.fromEntries(
          (Object.keys(permissionFieldNames) as PermissionKey[]).map((key) => [
            permissionFieldNames[key],
            formPermissions[key],
          ]),
        )
        await userService.update(editingUser.id, {
          name: formName.trim(),
          role: formRole,
          carteira: formCarteira.trim(),
          ativo: formAtivo,
          ...permissionPayload,
        })
        const audited = await auditBestEffort({
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
        toast.success(audited ? 'Usuário atualizado e auditado.' : 'Usuário atualizado.')
      } else {
        const permissionPayload = Object.fromEntries(
          (Object.keys(permissionFieldNames) as PermissionKey[]).map((key) => [
            permissionFieldNames[key],
            formPermissions[key] === true,
          ]),
        )
        const created = await userService.create({
          name: formName.trim(),
          email: formEmail.trim().toLowerCase(),
          password: formPassword,
          passwordConfirm: formPasswordConfirm,
          role: formRole,
          carteira: formCarteira.trim(),
          ativo: true,
          ...permissionPayload,
        })
        const audited = await auditBestEffort({
          autor: user?.id || 'sessão atual',
          alvo: created.id,
          acao: 'criar_usuario',
          antes: null,
          depois: { name: created.name, email: created.email, role: formRole },
        })
        setUsers((current) =>
          [...current.filter((item) => item.id !== created.id), created].sort((a, b) =>
            (a.name || '').localeCompare(b.name || ''),
          ),
        )
        toast.success(audited ? 'Usuário criado e auditado.' : 'Usuário criado.')
      }
      setModalOpen(false)
      await loadAdminData()
    } catch (error: any) {
      console.error(error)
      const fieldErrors = error?.response?.data || error?.data || {}
      const details = Object.entries(fieldErrors)
        .map(([field, value]: [string, any]) => `${field}: ${value?.message || value}`)
        .join(' · ')
      toast.error(
        details || error?.message || 'Erro ao salvar usuário. Verifique os dados e as permissões.',
      )
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
      await userService.update(item.id, { ativo: nextActive })
      const audited = await auditBestEffort({
        autor: user?.id || 'sessão atual',
        alvo: item.id,
        acao: nextActive ? 'reativar_usuario' : 'desativar_usuario',
        antes: { ativo: item.ativo !== false },
        depois: { ativo: nextActive },
      })
      await loadAdminData()
      toast.success(
        audited
          ? nextActive
            ? 'Usuário reativado e auditado.'
            : 'Usuário desativado e auditado.'
          : nextActive
            ? 'Usuário reativado.'
            : 'Usuário desativado.',
      )
    } catch {
      toast.error('Não foi possível alterar o status do usuário.')
    }
  }

  const removeUser = async () => {
    if (!removeTarget) return
    if (removeTarget.email === 'elisandrodesousaharamaq@gmail.com') {
      toast.error('O administrador principal não pode ser removido.')
      setRemoveTarget(null)
      return
    }
    const target = removeTarget
    setRemoving(true)
    try {
      await userService.delete(target.id)
      const audited = await auditBestEffort({
        autor: user?.id || 'sessão atual',
        alvo: target.id,
        acao: 'remover_usuario',
        antes: {
          name: target.name,
          email: target.email,
          role: target.role,
          carteira: target.carteira || '',
          ativo: target.ativo,
        },
        depois: null,
      })
      setRemoveTarget(null)
      await loadAdminData()
      toast.success(audited ? 'Usuário removido e auditado.' : 'Usuário removido.')
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : 'Não foi possível remover o usuário.')
    } finally {
      setRemoving(false)
    }
  }

  if (loading)
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#D92323] border-t-transparent" />
          <p className="text-xs text-gray-500">Carregando painel administrativo...</p>
        </div>
      </div>
    )

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
          type="button"
          data-testid="new-user-button"
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
                      <tr
                        key={item.id}
                        className={cn('hover:bg-gray-50/70', item.ativo === false && 'opacity-60')}
                      >
                        <td className="px-4 py-3.5">
                          <p className="font-bold text-gray-900">{item.name || 'Sem nome'}</p>
                          <p className="font-mono text-[11px] text-gray-500">{item.email}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <Badge variant="outline" className="text-[10px] font-semibold uppercase">
                            {ROLE_LABELS[item.role] || item.role}
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5 text-gray-600">
                          {item.carteira || 'Todas / não definida'}
                        </td>
                        <td className="px-4 py-3.5">
                          <Badge
                            variant="outline"
                            className={
                              item.ativo === false
                                ? 'border-gray-200 bg-gray-50 text-gray-500'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            }
                          >
                            {item.ativo === false ? 'Inativo' : 'Ativo'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5 text-gray-500">{formatDateBR(item.created)}</td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEdit(item)}
                              className="h-8 w-8 p-0 text-gray-500 hover:bg-blue-50 hover:text-blue-600"
                              title="Editar usuário"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            {item.email !== 'elisandrodesousaharamaq@gmail.com' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => void toggleUser(item)}
                                  className="h-8 w-8 p-0 text-gray-500 hover:bg-red-50 hover:text-red-600"
                                  title={
                                    item.ativo === false ? 'Reativar usuário' : 'Desativar usuário'
                                  }
                                >
                                  {item.ativo === false ? (
                                    <CheckCircle className="h-3.5 w-3.5" />
                                  ) : (
                                    <UserX className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setRemoveTarget(item)}
                                  className="h-8 w-8 p-0 text-gray-500 hover:bg-red-50 hover:text-red-700"
                                  title="Remover usuário"
                                  aria-label="Remover usuário"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </>
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
                <div
                  key={item.role}
                  className="space-y-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3.5"
                >
                  <Badge
                    variant="outline"
                    className={cn('text-[10px] font-bold uppercase', item.color)}
                  >
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
            <Input
              value={auditSearch}
              onChange={(event) => setAuditSearch(event.target.value)}
              placeholder="Filtrar por usuário, ação ou alvo..."
              className="h-9 max-w-md text-xs"
            />
            <Badge variant="outline" className="text-xs">
              {filteredAudit.length} eventos
            </Badge>
          </div>
          <Card className="overflow-hidden rounded-xl border-[#E2E8F0] bg-white shadow-xs">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-xs">
                  <thead className="border-b border-[#E5E7EB] bg-[#F8FAF9] text-gray-500">
                    <tr>
                      <th className="px-4 py-3">Data</th>
                      <th className="px-4 py-3">Autor</th>
                      <th className="px-4 py-3">Ação</th>
                      <th className="px-4 py-3">Alvo</th>
                      <th className="px-4 py-3">Alteração</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB]">
                    {filteredAudit.map((entry) => (
                      <tr key={entry.id}>
                        <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                          {formatDateBR(entry.created)}
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-800">
                          {auditUserLabel(entry.autor, usersById)}
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-800">{entry.acao}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {auditTargetLabel(entry.alvo, usersById)}
                        </td>
                        <td className="max-w-[520px] px-4 py-3 text-gray-600">
                          <div className="flex items-start gap-2">
                            <span className="line-clamp-3 flex-1">
                              {auditChangeSummary(entry, usersById)}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 shrink-0 gap-1 px-2 text-[10px] text-[#D92323]"
                              onClick={() => setSelectedAudit(entry)}
                              title="Ver registro completo"
                            >
                              <Eye className="h-3 w-3" /> Detalhes
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!filteredAudit.length && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                          Nenhum evento de auditoria encontrado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <Dialog
        open={Boolean(selectedAudit)}
        onOpenChange={(open) => !open && setSelectedAudit(null)}
      >
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes completos da auditoria</DialogTitle>
          </DialogHeader>
          {selectedAudit && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 gap-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 sm:grid-cols-2">
                <div>
                  <span className="font-semibold text-gray-500">Autor</span>
                  <p className="font-bold text-gray-900">
                    {auditUserLabel(selectedAudit.autor, usersById)}
                  </p>
                </div>
                <div>
                  <span className="font-semibold text-gray-500">Data</span>
                  <p className="font-bold text-gray-900">{formatDateBR(selectedAudit.created)}</p>
                </div>
                <div>
                  <span className="font-semibold text-gray-500">Ação</span>
                  <p className="font-bold text-gray-900">{selectedAudit.acao}</p>
                </div>
                <div>
                  <span className="font-semibold text-gray-500">Registro afetado</span>
                  <p className="font-bold text-gray-900">
                    {auditTargetLabel(selectedAudit.alvo, usersById)}
                  </p>
                </div>
              </div>
              <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3">
                <p className="font-semibold text-blue-900">Resumo legível</p>
                <p className="mt-1 leading-relaxed text-blue-800">
                  {auditChangeSummary(selectedAudit, usersById)}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div>
                  <p className="mb-1 font-semibold text-gray-700">Antes — registro completo</p>
                  <pre className="max-h-64 overflow-auto rounded-lg bg-slate-950 p-3 text-[10px] leading-relaxed text-slate-100">
                    {JSON.stringify(selectedAudit.antes, null, 2) || 'null'}
                  </pre>
                </div>
                <div>
                  <p className="mb-1 font-semibold text-gray-700">Depois — registro completo</p>
                  <pre className="max-h-64 overflow-auto rounded-lg bg-slate-950 p-3 text-[10px] leading-relaxed text-slate-100">
                    {JSON.stringify(selectedAudit.depois, null, 2) || 'null'}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1B4332]">
              {editingUser ? 'Editar usuário, carteira e permissões' : 'Novo usuário do sistema'}
            </DialogTitle>
          </DialogHeader>
          <form
            data-testid="user-form"
            onSubmit={handleSaveUser}
            className="space-y-4 pt-2 text-xs"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="uName">Nome completo</Label>
                <Input
                  id="uName"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="uEmail">E-mail corporativo</Label>
                <Input
                  id="uEmail"
                  type="email"
                  disabled={!!editingUser}
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            {!editingUser && (
              <>
                <div className="space-y-1">
                  <Label htmlFor="uPass">Senha provisória (mínimo 8 caracteres)</Label>
                  <Input
                    id="uPass"
                    type="password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="uPassConfirm">Confirmar senha provisória</Label>
                  <Input
                    id="uPassConfirm"
                    type="password"
                    value={formPasswordConfirm}
                    onChange={(e) => setFormPasswordConfirm(e.target.value)}
                    required
                  />
                </div>
              </>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Perfil base</Label>
                <Select value={formRole} onValueChange={(value) => setFormRole(value as UserRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ROLE_LABELS) as UserRole[]).map((role) => (
                      <SelectItem key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="uWallet">Carteira / território</Label>
                <Input
                  id="uWallet"
                  value={formCarteira}
                  onChange={(e) => setFormCarteira(e.target.value)}
                  placeholder="Ex.: Sul de MG"
                />
              </div>
            </div>
            {editingUser && (
              <div className="flex items-center justify-between rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                <div>
                  <p className="font-semibold text-gray-800">Usuário ativo</p>
                  <p className="text-[11px] text-gray-500">
                    Usuários inativos perdem acesso após a revalidação da sessão.
                  </p>
                </div>
                <Switch checked={formAtivo} onCheckedChange={setFormAtivo} />
              </div>
            )}
            <div className="rounded-lg border border-[#E2E8F0] p-3">
              <p className="mb-2 font-semibold text-gray-800">Permissões adicionais registradas</p>
              <p className="mb-3 text-[11px] text-gray-500">
                O perfil base continua preservado; estas marcações ficam registradas para controle
                administrativo.
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-gray-700">
                    <Switch
                      checked={!!formPermissions[key]}
                      onCheckedChange={(checked) =>
                        setFormPermissions((current) => ({ ...current, [key]: checked }))
                      }
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>
            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                data-testid="save-user-button"
                disabled={submitting}
                className="bg-[#DC2626] text-white hover:bg-[#B91C1C]"
              >
                {submitting ? 'Salvando...' : 'Salvar usuário'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={Boolean(removeTarget)}
        onOpenChange={(open) => {
          if (!open && !removing) setRemoveTarget(null)
        }}
      >
        <AlertDialogContent data-testid="remove-user-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Remover usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação excluirá permanentemente o acesso de{' '}
              <strong>{removeTarget?.name || removeTarget?.email}</strong> ({removeTarget?.email}).
              A regra de remoção continua restrita a administradores.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={removing}
              onClick={(event) => {
                event.preventDefault()
                void removeUser()
              }}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {removing ? 'Removendo...' : 'Remover usuário'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
