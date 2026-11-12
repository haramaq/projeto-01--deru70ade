import React, { useEffect, useMemo, useRef, useState } from 'react'
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
  Copy,
  Check,
} from 'lucide-react'
import { userService, dddService, type VendedorDdd } from '@/services/crmService'
import type { AuditEntry, PermissionKey, User, UserRole } from '@/types/crm'
import { permissionFieldNames } from '@/lib/permissions'
import { formatDateBR } from '@/lib/formatters'
import { DddMultiSelect } from '@/components/haramaq/DddMultiSelect'
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

import { RoteiroEditor } from '@/components/haramaq/RoteiroEditor'
import { RoteiroHistorico } from '@/components/haramaq/RoteiroHistorico'
import {
  publicarRoteiro,
  obterVersaoVigente,
  type RoteiroConteudo,
} from '@/services/roteiroService'
import { BookOpen } from 'lucide-react'

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
  const [formExternalId, setFormExternalId] = useState('')
  const [formSyncStatus, setFormSyncStatus] = useState<
    'nao_vinculado' | 'pendente_validacao' | 'validado'
  >('nao_vinculado')
  const [formDdis, setFormDdis] = useState<string>('') // vírgula, ex.: +55,+1
  const [formDdds, setFormDdds] = useState<string>('') // vírgula, ex.: 51,54
  const [dddsSalvos, setDddsSalvos] = useState<VendedorDdd[]>([])
  const [dddsError, setDddsError] = useState(false)
  const currentVendedorIdRef = useRef<string | null>(null)
  const [dddsLoading, setDddsLoading] = useState(false)
  const [confirmaValidado, setConfirmaValidado] = useState(false)
  const [formAtivo, setFormAtivo] = useState(true)
  const [formPermissions, setFormPermissions] =
    useState<Record<string, boolean>>(DEFAULT_PERMISSIONS)
  const [roteiroVigente, setRoteiroVigente] = useState<RoteiroConteudo | null>(null)
  const [roteiroRefresh, setRoteiroRefresh] = useState(0)
  const [selectedAudit, setSelectedAudit] = useState<AuditEntry | null>(null)
  const [removing, setRemoving] = useState(false)
  const [userToRemove, setUserToRemove] = useState<User | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<User | null>(null)
  const [auditSearch, setAuditSearch] = useState('')
  const [copiedEmailId, setCopiedEmailId] = useState<string | null>(null)

  useEffect(() => {
    obterVersaoVigente()
      .then(setRoteiroVigente)
      .catch(() => setRoteiroVigente(null))
  }, [roteiroRefresh])

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

  const handleCopyEmail = async (item: User) => {
    if (!item.email) return
    try {
      await navigator.clipboard.writeText(item.email)
      setCopiedEmailId(item.id)
      toast.success(`E-mail copiado: ${item.email}`)
      setTimeout(() => setCopiedEmailId(null), 2000)
    } catch {
      toast.error('Não foi possível copiar o e-mail.')
    }
  }

  const sincronizarDdds = async (usuarioId: string) => {
    if (!usuarioId || usuarioId === 'undefined') {
      toast.error('ID do vendedor inválido para sincronização de DDI/DDD.')
      return false
    }
    if (dddsError || dddsLoading) {
      toast.error(
        dddsError
          ? 'Não é possível sincronizar DDI/DDD: falha ao carregar os vínculos existentes.'
          : 'Aguarde: os vínculos DDI/DDD ainda estão sendo carregados.',
      )
      return false
    }
    const ddis = formDdis
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
    const ddds = formDdds
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
    const atuais = await dddService.listByUser(usuarioId)
    const desejadas: { ddi: string; ddd: string }[] = []
    for (const ddi of ddis.length ? ddis : ['+55']) {
      for (const ddd of ddds) {
        desejadas.push({ ddi, ddd })
      }
    }
    const paraCriar = desejadas.filter(
      (d) => !atuais.some((a) => a.ddi === d.ddi && a.ddd === d.ddd),
    )
    const paraRemover = atuais.filter(
      (a) => a.ativo !== false && !desejadas.some((d) => d.ddi === a.ddi && d.ddd === a.ddd),
    )
    try {
      for (const d of paraCriar) {
        await dddService.create({
          usuario_id: usuarioId,
          ddi: d.ddi,
          ddd: d.ddd,
          ativo: true,
          confirmado_por: user?.id,
        })
      }
      for (const a of paraRemover) {
        await dddService.remove(a.id)
      }
      return true
    } catch (error) {
      console.error('Erro ao sincronizar DDDs.', error)
      setDddsError(true)
      setDddsSalvos([])
      return false
    }
  }

  const handleOpenCreate = () => {
    resetForm()
    setModalOpen(true)
  }

  const handleOpenEdit = (u: User) => {
    setEditingUser(u)
    setFormName(u.name || '')
    setFormEmail(u.email)
    setFormPassword('')
    setFormPasswordConfirm('')
    setFormRole(u.role)
    setFormCarteira(u.carteira || '')
    setFormExternalId(u.external_id_altforce || '')
    setFormSyncStatus(u.altforce_sync_status || 'nao_vinculado')
    setFormAtivo(u.ativo !== false)
    setFormPermissions(safePermissions(u))
    setModalOpen(true)
    void loadDdds(u.id)
  }

  async function loadDdds(vendedorId: string) {
    if (!vendedorId) {
      console.error('loadDdds: ID do vendedor ausente.')
      setDddsError(true)
      return
    }
    currentVendedorIdRef.current = vendedorId
    setDddsLoading(true)
    dddService
      .listByUser(vendedorId)
      .then((regs) => {
        if (currentVendedorIdRef.current !== vendedorId) return // resposta atrasada de outro vendedor
        setDddsLoading(false)
        setDddsError(false)
        setDddsSalvos(regs)
        const ddis = Array.from(new Set(regs.filter((r) => r.ativo !== false).map((r) => r.ddi)))
        const ddds = Array.from(new Set(regs.filter((r) => r.ativo !== false).map((r) => r.ddd)))
        setFormDdis(ddis.join(','))
        setFormDdds(ddds.join(','))
      })
      .catch((err) => {
        if (currentVendedorIdRef.current !== vendedorId) return // resposta atrasada
        setDddsLoading(false)
        console.error('Erro ao carregar DDDs do vendedor.', err)
        setDddsError(true)
        setDddsSalvos([])
        toast.error(
          'Não foi possível carregar os vínculos DDI/DDD existentes. A sincronização está bloqueada.',
        )
      })
  }

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingUser) {
        if (editingUser.role === 'vendedor' || editingUser.role === 'revendedor') {
          if (dddsError || dddsLoading) {
            toast.error(
              dddsError
                ? 'Não é possível salvar: falha ao carregar os vínculos DDI/DDD.'
                : 'Aguarde: os vínculos DDI/DDD ainda estão sendo carregados.',
            )
            return
          }
        }
        const syncStatusEfetivo =
          formSyncStatus === 'validado' && !confirmaValidado ? 'pendente_validacao' : formSyncStatus
        await userService.update(editingUser.id, {
          name: formName,
          role: formRole,
          carteira: formCarteira,
          ativo: formAtivo,
          permissoes: formPermissions,
          external_id_altforce: formExternalId,
          altforce_sync_status: syncStatusEfetivo,
        })
        if (formPassword) {
          await userService.updatePassword(editingUser.id, formPassword)
        }
        const dddsOk = await sincronizarDdds(editingUser.id)
        await auditBestEffort({
          autor: user?.id || '',
          alvo: editingUser.id,
          acao: 'atualizacao_usuario',
          antes: editingUser,
          depois: { ...editingUser, name: formName, role: formRole, carteira: formCarteira },
        })
        if (dddsOk) {
          toast.success('Usuário atualizado com sucesso.')
        } else {
          toast.warning('Usuário atualizado, mas os vínculos DDI/DDD não foram sincronizados.')
        }
      } else {
        const created = await userService.create({
          name: formName,
          email: formEmail,
          password: formPassword,
          passwordConfirm: formPassword,
          role: formRole,
          carteira: formCarteira,
          ativo: formAtivo,
          external_id_altforce: formExternalId,
          altforce_sync_status: formSyncStatus,
          perm_dashboard: formPermissions.dashboard || false,
          perm_leads: formPermissions.leads || false,
          perm_clientes: formPermissions.clientes || false,
          perm_revendas: formPermissions.revendas || false,
          perm_suporte: formPermissions.suporte || false,
          perm_relatorios: formPermissions.relatorios || false,
          perm_configuracoes: formPermissions.configuracoes || false,
          permissoes: formPermissions,
        })
        const dddsOk = await sincronizarDdds(created.id)
        await auditBestEffort({
          autor: user?.id || '',
          alvo: created.id,
          acao: 'criacao_usuario',
          antes: null,
          depois: created,
        })
        if (dddsOk) {
          toast.success('Usuário criado com sucesso.')
        } else {
          toast.warning('Usuário criado, mas os vínculos DDI/DDD não foram sincronizados.')
        }
      }
      setModalOpen(false)
      resetForm()
      await loadAdminData()
    } catch (err) {
      toast.error(`Erro ao salvar usuário: ${String(err).slice(0, 200)}`)
    }
  }

  const toggleUser = async (u: User) => {
    try {
      await userService.update(u.id, { ativo: !(u.ativo !== false) })
      await auditBestEffort({
        autor: user?.id || '',
        alvo: u.id,
        acao: 'alteracao_status_usuario',
        antes: { ativo: u.ativo !== false },
        depois: { ativo: !(u.ativo !== false) },
      })
      await loadAdminData()
      toast.success(`Usuário ${u.ativo !== false ? 'desativado' : 'reativado'}.`)
    } catch (err) {
      toast.error(`Erro ao alterar status: ${String(err).slice(0, 200)}`)
    }
  }

  const removeUser = async () => {
    if (!userToRemove) return
    setRemoving(true)
    try {
      await userService.delete(userToRemove.id)
      await auditBestEffort({
        autor: user?.id || '',
        alvo: userToRemove.id,
        acao: 'remocao_usuario',
        antes: userToRemove,
        depois: null,
      })
      toast.success(`Usuário ${userToRemove.name || userToRemove.email} removido.`)
      await loadAdminData()
    } catch (err) {
      toast.error(`Erro ao remover usuário: ${String(err).slice(0, 200)}`)
    } finally {
      setRemoving(false)
      setConfirmRemove(false)
      setUserToRemove(null)
    }
  }

  const resetForm = () => {
    setEditingUser(null)
    setFormName('')
    setFormEmail('')
    setFormPassword('')
    setFormPasswordConfirm('')
    setFormRole('vendedor')
    setFormCarteira('')
    setFormExternalId('')
    setFormSyncStatus('nao_vinculado')
    setFormDdis('')
    setFormDdds('')
    setDddsSalvos([])
    setDddsError(false)
    setDddsLoading(false)
    currentVendedorIdRef.current = null
    setConfirmaValidado(false)
    setFormAtivo(true)
    setFormPermissions({ ...DEFAULT_PERMISSIONS })
  }

  const usersById = useMemo(() => new Map(users.map((item) => [item.id, item])), [users])
  const isAdmin = user?.role === 'admin'
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

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-sm text-slate-500">Carregando configurações…</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1E293B]">
            Painel Administrativo
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Gerencie usuários, perfis, auditoria e roteiros de qualificação.
          </p>
        </div>
        <Button onClick={handleOpenCreate} className="gap-2">
          <UserPlus className="h-4 w-4" /> Novo usuário
        </Button>
      </div>
      <Tabs defaultValue="usuarios" className="space-y-5">
        <TabsList className="grid h-auto w-full grid-cols-4 bg-white p-1 shadow-xs sm:w-fit sm:flex">
          <TabsTrigger value="usuarios" className="gap-2 text-xs">
            <Users className="h-3.5 w-3.5" /> Usuários
          </TabsTrigger>
          <TabsTrigger value="perfis" className="gap-2 text-xs">
            <Shield className="h-3.5 w-3.5" /> Perfis
          </TabsTrigger>
          <TabsTrigger value="auditoria" className="gap-2 text-xs">
            <History className="h-3.5 w-3.5" /> Auditoria
          </TabsTrigger>
          <TabsTrigger value="roteiros" className="gap-2 text-xs">
            <BookOpen className="h-3.5 w-3.5" /> Roteiros
          </TabsTrigger>
        </TabsList>
        <TabsContent value="usuarios" className="space-y-5">
          <Card className="overflow-hidden rounded-xl border-[#E2E8F0] bg-white shadow-xs">
            <CardHeader className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-5 py-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#1E293B]">
                <Users className="h-4 w-4 text-[#64748B]" /> Usuários do sistema
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#F8FAFC] text-xs uppercase tracking-wide text-[#64748B]">
                    <tr>
                      <th className="px-5 py-3 font-medium">Usuário</th>
                      <th className="px-5 py-3 font-medium">Perfil</th>
                      <th className="px-5 py-3 font-medium">Carteira</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-[#F8FAFC]">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E2E8F0] text-xs font-semibold text-[#475569]">
                              {(u.name || u.email).slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-[#1E293B]">{u.name || u.email}</p>
                              <p className="text-xs text-slate-500">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-xs',
                              ROLE_DESCRIPTIONS.find((d) => d.role === u.role)?.color,
                            )}
                          >
                            {ROLE_LABELS[u.role] || u.role}
                          </Badge>
                        </td>
                        <td className="px-5 py-3 text-[#475569]">{u.carteira || '—'}</td>
                        <td className="px-5 py-3">
                          <Badge
                            variant={u.ativo !== false ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {u.ativo !== false ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenEdit(u)}
                              title="Editar"
                            >
                              <Edit2 className="h-4 w-4 text-[#64748B]" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => toggleUser(u)}
                              title={u.ativo !== false ? 'Desativar' : 'Reativar'}
                            >
                              <UserX className="h-4 w-4 text-red-400" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setUserToRemove(u)
                                setConfirmRemove(true)
                              }}
                              title="Remover"
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
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
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-[#1E293B]">
                Perfis e permissões
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {ROLE_DESCRIPTIONS.map((d) => (
                <div key={d.role} className={cn('rounded-xl border p-4', d.color)}>
                  <p className="font-semibold">{ROLE_LABELS[d.role]}</p>
                  <p className="mt-1 text-xs opacity-80">{d.desc}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="auditoria" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-[#1E293B]">
                Auditoria de ações
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#F8FAFC] text-xs uppercase tracking-wide text-[#64748B]">
                    <tr>
                      <th className="px-5 py-3 font-medium">Data</th>
                      <th className="px-5 py-3 font-medium">Autor</th>
                      <th className="px-5 py-3 font-medium">Ação</th>
                      <th className="px-5 py-3 font-medium">Resumo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {auditEntries.map((entry, idx) => (
                      <tr
                        key={entry.id || idx}
                        className="cursor-pointer hover:bg-[#F8FAFC]"
                        onClick={() => setSelectedAudit(entry)}
                      >
                        <td className="px-5 py-3 text-xs text-[#64748B]">
                          {formatDateBR(entry.created)}
                        </td>
                        <td className="px-5 py-3 text-[#1E293B]">
                          {auditUserLabel(entry.autor, usersById)}
                        </td>
                        <td className="px-5 py-3 text-[#1E293B]">{entry.acao}</td>
                        <td className="px-5 py-3 text-xs text-[#64748B]">
                          {auditChangeSummary(entry, usersById)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="roteiros" className="space-y-4">
          <RoteiroEditor
            conteudoInicial={roteiroVigente ?? undefined}
            disabled={user?.role !== 'admin' && user?.role !== 'gestor'}
            onPublicar={async (conteudo) => {
              try {
                const result = await publicarRoteiro(
                  conteudo,
                  user?.name || user?.email || 'desconhecido',
                )
                toast.success(`Roteiro v${result.versao} publicado com sucesso`)
                setRoteiroRefresh((k) => k + 1)
              } catch (e) {
                const errStr = String(e)
                if (/409|CONFLITO_VERSAO_CONCORRENTE/i.test(errStr)) {
                  toast.error(
                    'Conflito: outra pessoa publicou uma versão simultaneamente. Atualize o histórico antes de tentar novamente.',
                  )
                } else {
                  toast.error(`Erro ao publicar: ${errStr.slice(0, 200)}`)
                }
              }
            }}
          />
          <RoteiroHistorico refreshKey={roteiroRefresh} />
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
            <div className="space-y-3 text-sm">
              <p>
                <strong>Data:</strong> {formatDateBR(selectedAudit.created)}
              </p>
              <p>
                <strong>Autor:</strong> {auditUserLabel(selectedAudit.autor, usersById)}
              </p>
              <p>
                <strong>Ação:</strong> {selectedAudit.acao}
              </p>
              <p>
                <strong>Alvo:</strong> {auditTargetLabel(selectedAudit.alvo || '', usersById)}
              </p>
              <div>
                <strong>Antes:</strong>
                <pre className="mt-1 max-h-40 overflow-auto rounded bg-slate-50 p-2 text-xs">
                  {typeof selectedAudit.antes === 'string'
                    ? selectedAudit.antes
                    : JSON.stringify(selectedAudit.antes, null, 2)}
                </pre>
              </div>
              <div>
                <strong>Depois:</strong>
                <pre className="mt-1 max-h-40 overflow-auto rounded bg-slate-50 p-2 text-xs">
                  {typeof selectedAudit.depois === 'string'
                    ? selectedAudit.depois
                    : JSON.stringify(selectedAudit.depois, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={modalOpen} onOpenChange={(open) => !open && setModalOpen(false)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Editar usuário' : 'Novo usuário'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveUser} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="form-name">Nome</Label>
              <Input
                id="form-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required={!editingUser}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="form-email">E-mail</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="form-email"
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  disabled={Boolean(editingUser)}
                  required={!editingUser}
                />
                {editingUser && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => void handleCopyEmail(formEmail)}
                    title="Copiar e-mail"
                  >
                    {formEmail && <Copy className="h-4 w-4" />}
                  </Button>
                )}
              </div>
            </div>
            {!editingUser && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="form-password">Senha</Label>
                  <Input
                    id="form-password"
                    type="password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="form-password-confirm">Confirmar senha</Label>
                  <Input
                    id="form-password-confirm"
                    type="password"
                    value={formPasswordConfirm}
                    onChange={(e) => setFormPasswordConfirm(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="form-role">Perfil</Label>
              <Select value={formRole} onValueChange={(v) => setFormRole(v as UserRole)}>
                <SelectTrigger id="form-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="form-carteira">Carteira</Label>
              <Input
                id="form-carteira"
                value={formCarteira}
                onChange={(e) => setFormCarteira(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="form-external-id">External ID (Altforce)</Label>
              <Input
                id="form-external-id"
                value={formExternalId}
                onChange={(e) => setFormExternalId(e.target.value)}
                placeholder="Ex.: 77"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="form-sync-status">Status de sincronização Altforce</Label>
              <Select
                value={formSyncStatus}
                onValueChange={(v) =>
                  setFormSyncStatus(v as 'nao_vinculado' | 'pendente_validacao' | 'validado')
                }
              >
                <SelectTrigger id="form-sync-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nao_vinculado">Não vinculado</SelectItem>
                  <SelectItem value="pendente_validacao">Pendente de validação</SelectItem>
                  <SelectItem value="validado">Validado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={formAtivo} onCheckedChange={setFormAtivo} />
              <Label>Usuário ativo</Label>
            </div>
            <div className="space-y-2">
              <Label>Permissões</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                  <div key={key} className="flex items-center gap-2">
                    <Switch
                      checked={formPermissions[key] || false}
                      onCheckedChange={(v) => setFormPermissions((prev) => ({ ...prev, [key]: v }))}
                    />
                    <span className="text-xs">{label}</span>
                  </div>
                ))}
              </div>
            </div>
            {formRole === 'vendedor' && (
              <div className="space-y-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                <Label>DDI/DDD do vendedor</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="form-ddis" className="text-xs text-[#64748B]">
                      DDI (vírgula, ex.: +55,+1)
                    </Label>
                    <Input
                      id="form-ddis"
                      value={formDdis}
                      onChange={(e) => setFormDdis(e.target.value)}
                      placeholder="+55"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="form-ddds" className="text-xs text-[#64748B]">
                      DDDs (vírgula, ex.: 51,54)
                    </Label>
                    <DddMultiSelect
                      id="form-ddds"
                      testId="ddds-input"
                      valor={formDdds}
                      onChange={setFormDdds}
                    />
                  </div>
                </div>
                {dddsSalvos.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {dddsSalvos.map((d) => (
                      <Badge key={d.id} variant="secondary" className="text-xs">
                        +{d.ddi} {d.ddd}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button type="submit">{editingUser ? 'Salvar' : 'Criar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o usuário {userToRemove?.name || userToRemove?.email}?
              Esta ação é permanente e o histórico de auditoria será preservado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
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
