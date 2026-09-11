import React, { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  CheckCircle2,
  Clock3,
  GripVertical,
  History,
  MapPin,
  Plus,
  Search,
  UserRound,
  X,
} from 'lucide-react'
import { vendaService, clienteService, userService } from '@/services/crmService'
import type {
  CategoriaProduto,
  Cliente,
  LeadEtapa,
  LeadHistorico,
  LeadTarefa,
  NivelInteresse,
  StatusMotivo,
  User,
  Venda,
} from '@/types/crm'
import { formatDateBR } from '@/lib/formatters'
import useRealtime from '@/hooks/use-realtime'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { PageContainer, PageHeader, HaramaqButton, StatusBadge } from '@/components/haramaq'

const ETAPAS: { key: LeadEtapa; label: string; color: string }[] = [
  { key: 'agendamento_primeiro_contato', label: 'Agendamento de 1º contato', color: '#2563EB' },
  { key: 'em_contato', label: 'Em contato', color: '#0284C7' },
  { key: 'revenda_contato', label: 'Revenda Contato', color: '#7C3AED' },
  { key: 'orcamentacao', label: 'Orçamentação', color: '#F59E0B' },
  { key: 'contato_futuro_agendado', label: 'Contato futuro (Agendado)', color: '#64748B' },
  { key: 'arquivado_nao_retorna', label: 'Arquivado (não retorna)', color: '#94A3B8' },
  { key: 'perdido_concorrencia', label: 'Perdido (comprou da concorrência)', color: '#E11D48' },
  { key: 'convertido_pedido', label: 'Convertido para pedido', color: '#16A34A' },
  { key: 'pecas_pos_vendas', label: 'Peças e Pós-vendas', color: '#9333EA' },
  { key: 'financeiro_fiscal', label: 'Financeiro e Fiscal', color: '#0369A1' },
]

const CATEGORIAS: CategoriaProduto[] = [
  'Linha Prohmix',
  'Linha Supermix',
  'Linha Tipper',
  'Vagões Rodoviários',
  'Colhedora de forragens',
  'Homogeneizador de esterco',
  'Revolvedor de cama',
]

const ORIGENS = [
  'Campanhas',
  'Eventos',
  'Redes Sociais',
  'Prospecção direta a campo',
  'Google',
  'Site',
  'Ligação na empresa',
  'Indicação de parceiros',
  'Cliente antigo',
  'Cliente de revenda',
]

const TERMINAIS: LeadEtapa[] = [
  'arquivado_nao_retorna',
  'perdido_concorrencia',
  'convertido_pedido',
]

const ETAPAS_COM_PRAZO = new Set<LeadEtapa>([
  'agendamento_primeiro_contato',
  'em_contato',
  'revenda_contato',
  'orcamentacao',
  'contato_futuro_agendado',
])

const stageLabels: Record<string, string> = Object.fromEntries(
  ETAPAS.map((stage) => [stage.key, stage.label]),
)

function elapsedSince(value?: string) {
  if (!value) return '—'
  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) return '—'
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000))
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h`
  const days = Math.floor(hours / 24)
  return `${days} ${days === 1 ? 'dia' : 'dias'}`
}

function dateTime(value?: string) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function isOverdue(lead: Venda) {
  return Boolean(
    ETAPAS_COM_PRAZO.has(lead.etapa) &&
    lead.prazo_etapa_em &&
    new Date(lead.prazo_etapa_em).getTime() < Date.now(),
  )
}

function statusVariant(lead: Venda): 'success' | 'danger' | 'neutral' | 'info' {
  if (lead.status_lead === 'convertido_pedido') return 'success'
  if (lead.status_lead === 'perdido') return 'danger'
  if (lead.status_lead === 'arquivado') return 'neutral'
  return 'info'
}

export default function Vendas() {
  const { user, role } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [leads, setLeads] = useState<Venda[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [responsaveis, setResponsaveis] = useState<User[]>([])
  const [motivos, setMotivos] = useState<StatusMotivo[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [originFilter, setOriginFilter] = useState('todos')
  const [categoryFilter, setCategoryFilter] = useState('todos')
  const [interestFilter, setInterestFilter] = useState('todos')
  const [createOpen, setCreateOpen] = useState(false)
  const [detailLead, setDetailLead] = useState<Venda | null>(null)
  const [history, setHistory] = useState<LeadHistorico[]>([])
  const [tasks, setTasks] = useState<LeadTarefa[]>([])
  const [moveLead, setMoveLead] = useState<{ lead: Venda; etapa: LeadEtapa } | null>(null)
  const [selectedMotivo, setSelectedMotivo] = useState('')
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [newCliente, setNewCliente] = useState('')
  const [newCategoria, setNewCategoria] = useState<CategoriaProduto>('Linha Prohmix')
  const [newOrigem, setNewOrigem] = useState('Site')
  const [newInterest, setNewInterest] = useState<NivelInteresse>(3)
  const [newObservacoes, setNewObservacoes] = useState('')
  const [newResponsavel, setNewResponsavel] = useState('')

  const canCreate = ['admin', 'gestor', 'triagem', 'vendedor', 'revendedor'].includes(role)

  const loadData = async () => {
    try {
      const [leadList, clientList, userList, motiveList] = await Promise.all([
        vendaService.getAll(),
        clienteService.getAll(),
        userService.getAll(),
        vendaService.getMotivos(),
      ])
      setLeads(leadList)
      setClientes(clientList)
      setResponsaveis(userList)
      setMotivos(motiveList)
    } catch (error) {
      console.error(error)
      toast.error('Erro ao carregar os leads do Kanban.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (searchParams.get('nova') === 'true') {
      setCreateOpen(true)
      searchParams.delete('nova')
      searchParams.delete('clienteId')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

  useRealtime('vendas', () => {
    vendaService
      .getAll()
      .then(setLeads)
      .catch(() => {})
  })

  const filteredLeads = useMemo(() => {
    const query = search.trim().toLowerCase()
    return leads.filter((lead) => {
      const client = lead.expand?.cliente
      const searchable = [
        lead.numero_lead,
        client?.nome,
        client?.empresa,
        lead.categoria_produto,
        lead.origem_lead,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return (
        (!query || searchable.includes(query)) &&
        (originFilter === 'todos' || lead.origem_lead === originFilter) &&
        (categoryFilter === 'todos' || lead.categoria_produto === categoryFilter) &&
        (interestFilter === 'todos' || String(lead.nivel_interesse) === interestFilter)
      )
    })
  }, [leads, search, originFilter, categoryFilter, interestFilter])

  const byStage = useMemo(() => {
    const result = {} as Record<LeadEtapa, Venda[]>
    ETAPAS.forEach((stage) => {
      result[stage.key] = filteredLeads.filter((lead) => lead.etapa === stage.key)
    })
    return result
  }, [filteredLeads])

  const openDetail = async (lead: Venda) => {
    setDetailLead(lead)
    try {
      const [historyList, taskList] = await Promise.all([
        vendaService.getHistorico(lead.id),
        vendaService.getTarefas(lead.id),
      ])
      setHistory(historyList)
      setTasks(taskList)
    } catch {
      setHistory([])
      setTasks([])
    }
  }

  const requestMove = (lead: Venda, etapa: LeadEtapa) => {
    if (lead.etapa === etapa) return
    if (TERMINAIS.includes(etapa)) {
      setMoveLead({ lead, etapa })
      setSelectedMotivo('')
      return
    }
    void applyMove(lead, etapa)
  }

  const applyMove = async (lead: Venda, etapa: LeadEtapa, motivoCode?: string) => {
    setSaving(true)
    try {
      const reason = motivos.find((item) => item.codigo === motivoCode)
      const updated = await vendaService.updateEtapa(lead.id, etapa, reason)
      setLeads((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      if (detailLead?.id === updated.id) {
        setDetailLead(updated)
        setHistory(await vendaService.getHistorico(updated.id))
      }
      setMoveLead(null)
      toast.success(`Lead movido para ${stageLabels[etapa]}.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível mover o lead.')
    } finally {
      setSaving(false)
    }
  }

  const handleDrop = (event: React.DragEvent, etapa: LeadEtapa) => {
    event.preventDefault()
    const id = event.dataTransfer.getData('text/plain') || draggedId
    const lead = leads.find((item) => item.id === id)
    setDraggedId(null)
    if (lead) requestMove(lead, etapa)
  }

  const createLead = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!newCliente || !newCategoria || !newOrigem) {
      toast.error('Cliente, categoria e origem são obrigatórios.')
      return
    }
    setSaving(true)
    try {
      const created = await vendaService.create({
        cliente: newCliente,
        categoria_produto: newCategoria,
        origem_lead: newOrigem,
        nivel_interesse: newInterest,
        observacoes_ia: newObservacoes.trim(),
        vendedor: newResponsavel || user?.id,
        etapa: 'agendamento_primeiro_contato',
        produto: 'PROHMIX',
        altforce_stage_name: 'Agendamento de 1º contato',
      })
      setLeads((current) => [created, ...current])
      setCreateOpen(false)
      setNewCliente('')
      setNewObservacoes('')
      setNewResponsavel('')
      toast.success('Lead criado no Kanban.')
    } catch (error) {
      console.error(error)
      toast.error('Não foi possível criar o lead.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#D92323] border-t-transparent" />
          <p className="text-xs text-[#64748B]">Carregando leads do Kanban...</p>
        </div>
      </div>
    )
  }

  return (
    <PageContainer maxWidth="full">
      <PageHeader
        title="Gestão de Leads"
        subtitle="Fluxo comercial Haramaq para pecuária de corte e leite"
        badge={
          <span className="rounded-md border border-[#FCA5A5]/60 bg-[#FEE2E2] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#D92323]">
            {filteredLeads.length} leads
          </span>
        }
        actions={
          canCreate ? (
            <HaramaqButton icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
              Novo lead
            </HaramaqButton>
          ) : undefined
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-2 rounded-xl border border-[#E2E8F0] bg-white p-3 shadow-xs md:grid-cols-[1fr_190px_210px_140px_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por ID, cliente, categoria ou origem..."
            className="h-9 pl-9 text-xs"
          />
        </div>
        <Select value={originFilter} onValueChange={setOriginFilter}>
          <SelectTrigger className="h-9 text-xs">
            <SelectValue placeholder="Origem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as origens</SelectItem>
            {ORIGENS.map((origin) => (
              <SelectItem key={origin} value={origin}>
                {origin}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="h-9 text-xs">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as categorias</SelectItem>
            {CATEGORIAS.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={interestFilter} onValueChange={setInterestFilter}>
          <SelectTrigger className="h-9 text-xs">
            <SelectValue placeholder="Interesse" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Interesse</SelectItem>
            {[1, 2, 3, 4, 5].map((value) => (
              <SelectItem key={value} value={String(value)}>
                {value}/5
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(search ||
          originFilter !== 'todos' ||
          categoryFilter !== 'todos' ||
          interestFilter !== 'todos') && (
          <Button
            variant="ghost"
            className="h-9 text-xs"
            onClick={() => {
              setSearch('')
              setOriginFilter('todos')
              setCategoryFilter('todos')
              setInterestFilter('todos')
            }}
          >
            <X className="mr-1 h-3.5 w-3.5" /> Limpar
          </Button>
        )}
      </div>

      <div className="grid min-w-[1280px] grid-cols-10 gap-2 overflow-x-auto pb-4">
        {ETAPAS.map((stage) => {
          const stageLeads = byStage[stage.key] || []
          return (
            <section
              key={stage.key}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => handleDrop(event, stage.key)}
              className="flex min-h-[620px] flex-col rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]"
            >
              <header className="border-t-4 bg-white p-2.5" style={{ borderTopColor: stage.color }}>
                <div className="flex items-start justify-between gap-1">
                  <h2 className="text-[10px] font-bold uppercase leading-tight tracking-wide text-[#334155]">
                    {stage.label}
                  </h2>
                  <span className="rounded-full bg-[#F1F5F9] px-1.5 py-0.5 text-[10px] font-bold text-[#475569]">
                    {stageLeads.length}
                  </span>
                </div>
              </header>
              <div className="flex-1 space-y-2 p-2">
                {stageLeads.map((lead) => {
                  const overdue = isOverdue(lead)
                  const client = lead.expand?.cliente
                  const responsible =
                    lead.expand?.vendedor?.name || lead.expand?.vendedor?.email || 'Não atribuído'
                  return (
                    <article
                      key={lead.id}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData('text/plain', lead.id)
                        setDraggedId(lead.id)
                      }}
                      onClick={() => openDetail(lead)}
                      className={cn(
                        'cursor-pointer rounded-lg border bg-white p-2.5 shadow-2xs transition hover:-translate-y-0.5 hover:shadow-sm',
                        overdue ? 'border-amber-400 ring-1 ring-amber-200' : 'border-[#E2E8F0]',
                      )}
                    >
                      <div className="mb-2 flex items-start justify-between gap-1">
                        <span className="font-mono text-[10px] font-bold text-[#D92323]">
                          {lead.numero_lead || `#${lead.id}`}
                        </span>
                        <GripVertical className="h-3.5 w-3.5 text-[#CBD5E1]" />
                      </div>
                      <h3 className="line-clamp-2 text-xs font-bold text-[#1E293B]">
                        {client?.empresa || client?.nome || 'Cliente não informado'}
                      </h3>
                      <p className="mt-0.5 line-clamp-1 text-[10px] text-[#64748B]">
                        {client?.nome || 'Sem contato'}
                      </p>
                      <div className="mt-2 space-y-1.5 text-[10px] text-[#475569]">
                        <div className="flex items-center gap-1">
                          <UserRound className="h-3 w-3 text-[#94A3B8]" />
                          <span className="line-clamp-1">{responsible}</span>
                        </div>
                        <div className="font-semibold text-[#1E293B]">
                          {lead.categoria_produto || 'Categoria pendente'}
                        </div>
                        <div className="flex items-center justify-between gap-1">
                          <span className="line-clamp-1">
                            {lead.origem_lead || 'Origem pendente'}
                          </span>
                          <span className="font-bold text-[#B45309]">
                            {lead.nivel_interesse || 0}/5
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between border-t border-[#F1F5F9] pt-1.5 text-[10px]">
                        <span
                          className={cn('font-bold', overdue ? 'text-[#B45309]' : 'text-[#64748B]')}
                        >
                          <Clock3 className="mr-0.5 inline h-3 w-3" />
                          {elapsedSince(lead.etapa_atual_desde)}
                        </span>
                        <span className="text-[#94A3B8]">
                          {formatDateBR(lead.data_solicitacao || lead.created)}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between gap-1">
                        <StatusBadge variant={statusVariant(lead)} size="sm" dot>
                          {lead.status_motivo_codigo
                            ? `${lead.status_motivo_codigo} · ${lead.status_motivo_descricao}`
                            : lead.status_lead === 'em_andamento'
                              ? 'Em andamento'
                              : lead.status_lead || 'Em andamento'}
                        </StatusBadge>
                        {overdue && (
                          <span className="text-[9px] font-bold uppercase text-[#B45309]">
                            Vencido
                          </span>
                        )}
                      </div>
                    </article>
                  )
                })}
                {stageLeads.length === 0 && (
                  <div className="rounded-lg border border-dashed border-[#CBD5E1] p-4 text-center text-[10px] text-[#94A3B8]">
                    Arraste leads para cá
                  </div>
                )}
              </div>
            </section>
          )
        })}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo lead Haramaq</DialogTitle>
          </DialogHeader>
          <form onSubmit={createLead} className="grid grid-cols-1 gap-4 py-2 md:grid-cols-2">
            <div className="space-y-1 md:col-span-2">
              <Label>Cliente *</Label>
              <Select value={newCliente} onValueChange={setNewCliente}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.empresa || client.nome} — {client.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Categoria do produto *</Label>
              <Select
                value={newCategoria}
                onValueChange={(value) => setNewCategoria(value as CategoriaProduto)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Origem do lead *</Label>
              <Select value={newOrigem} onValueChange={setNewOrigem}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORIGENS.map((origin) => (
                    <SelectItem key={origin} value={origin}>
                      {origin}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Nível de interesse (1 a 5)</Label>
              <Select
                value={String(newInterest)}
                onValueChange={(value) => setNewInterest(Number(value) as NivelInteresse)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <SelectItem key={value} value={String(value)}>
                      {value}/5
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Responsável</Label>
              <Select
                value={newResponsavel || 'automatico'}
                onValueChange={(value) => setNewResponsavel(value === 'automatico' ? '' : value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="automatico">Usuário atual</SelectItem>
                  {responsaveis.map((person) => (
                    <SelectItem key={person.id} value={person.id}>
                      {person.name || person.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Observações / resumo da conversa com a IA</Label>
              <Textarea
                value={newObservacoes}
                onChange={(event) => setNewObservacoes(event.target.value)}
                placeholder="Resumo para leitura do representante; o agente não deve prolongar a conversa após obter os dados necessários."
                rows={4}
              />
            </div>
            <DialogFooter className="md:col-span-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                Criar lead
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(detailLead)} onOpenChange={(open) => !open && setDetailLead(null)}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhe do lead {detailLead?.numero_lead || detailLead?.id}</DialogTitle>
          </DialogHeader>
          {detailLead && (
            <div className="space-y-5 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge variant={statusVariant(detailLead)} dot>
                  {detailLead.status_lead === 'em_andamento'
                    ? 'Em andamento'
                    : detailLead.status_lead}
                </StatusBadge>
                <Badge variant="outline">{stageLabels[detailLead.etapa]}</Badge>
                {detailLead.status_motivo_codigo && (
                  <Badge variant="outline">
                    {detailLead.status_motivo_codigo} · {detailLead.status_motivo_descricao}
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-1 gap-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 md:grid-cols-3">
                <div>
                  <span className="label-detail">Data da solicitação</span>
                  <p className="font-semibold">
                    {dateTime(detailLead.data_solicitacao || detailLead.created)}
                  </p>
                </div>
                <div>
                  <span className="label-detail">Responsável</span>
                  <p className="font-semibold">
                    {detailLead.expand?.vendedor?.name ||
                      detailLead.expand?.vendedor?.email ||
                      'Não atribuído'}
                  </p>
                  <p className="text-[#64748B]">
                    {detailLead.responsavel_cargo || 'Representante comercial'}
                  </p>
                </div>
                <div>
                  <span className="label-detail">Tempo na etapa</span>
                  <p className={cn('font-semibold', isOverdue(detailLead) && 'text-[#B45309]')}>
                    {elapsedSince(detailLead.etapa_atual_desde)}
                    {isOverdue(detailLead) ? ' · prazo vencido' : ''}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-[#E2E8F0] p-4">
                  <h3 className="mb-3 font-bold text-[#1E293B]">Cliente</h3>
                  <p className="font-semibold">{detailLead.expand?.cliente?.nome || '—'}</p>
                  <p>{detailLead.expand?.cliente?.telefone || 'Telefone não informado'}</p>
                  <p className="flex items-center gap-1 text-[#64748B]">
                    <MapPin className="h-3.5 w-3.5" />
                    {detailLead.expand?.cliente?.cidade || 'Localização não informada'}
                    {detailLead.expand?.cliente?.estado
                      ? ` - ${detailLead.expand.cliente.estado}`
                      : ''}
                  </p>
                </div>
                <div className="rounded-xl border border-[#E2E8F0] p-4">
                  <h3 className="mb-3 font-bold text-[#1E293B]">Classificação</h3>
                  <p>
                    <strong>Categoria:</strong> {detailLead.categoria_produto || '—'}
                  </p>
                  <p>
                    <strong>Origem:</strong> {detailLead.origem_lead || '—'}
                  </p>
                  <p>
                    <strong>Interesse:</strong> {detailLead.nivel_interesse || 0}/5
                  </p>
                </div>
              </div>
              <div className="rounded-xl border border-[#E2E8F0] p-4">
                <h3 className="mb-2 font-bold text-[#1E293B]">
                  Observações / resumo da conversa com a IA
                </h3>
                <p className="whitespace-pre-wrap text-[#475569]">
                  {detailLead.observacoes_ia || 'Nenhum resumo registrado.'}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-[#E2E8F0] p-4">
                  <h3 className="mb-3 flex items-center gap-2 font-bold">
                    <CheckCircle2 className="h-4 w-4 text-[#D92323]" /> Equipes e tarefas
                  </h3>
                  <p className="mb-2">
                    <strong>Equipe:</strong> {detailLead.equipe || 'Comercial Haramaq'}
                  </p>
                  {tasks.length ? (
                    tasks.map((task) => (
                      <div key={task.id} className="border-t py-2">
                        <p className="font-semibold">{task.titulo}</p>
                        <p className="text-[#64748B]">
                          {task.status} {task.prazo ? `· prazo ${formatDateBR(task.prazo)}` : ''}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-[#94A3B8]">Nenhuma tarefa vinculada.</p>
                  )}
                </div>
                <div className="rounded-xl border border-[#E2E8F0] p-4">
                  <h3 className="mb-3 flex items-center gap-2 font-bold">
                    <History className="h-4 w-4 text-[#D92323]" /> Histórico de etapas
                  </h3>
                  {history.length ? (
                    history.map((item) => (
                      <div key={item.id} className="border-t py-2">
                        <p className="font-semibold">
                          {item.etapa_anterior
                            ? `${stageLabels[item.etapa_anterior] || item.etapa_anterior} → `
                            : ''}
                          {stageLabels[item.etapa_nova] || item.etapa_nova}
                        </p>
                        <p className="text-[#64748B]">
                          {dateTime(item.data_hora)} ·{' '}
                          {item.motivo_descricao || item.responsavel || 'Sistema'}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-[#94A3B8]">Histórico ainda não registrado.</p>
                  )}
                </div>
              </div>
              <div className="rounded-xl border border-[#E2E8F0] p-4">
                <h3 className="mb-3 font-bold">Mover lead</h3>
                <div className="flex flex-wrap gap-2">
                  {ETAPAS.filter((stage) => stage.key !== detailLead.etapa).map((stage) => (
                    <Button
                      key={stage.key}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => requestMove(detailLead, stage.key)}
                    >
                      {stage.label}
                    </Button>
                  ))}
                </div>
                {moveLead?.lead.id === detailLead.id && (
                  <div className="mt-4 space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <div>
                      <p className="font-bold text-amber-900">
                        Motivo obrigatório para encerramento
                      </p>
                      <p className="mt-1 text-[11px] text-amber-800">
                        Selecione o motivo antes de mover o lead para {stageLabels[moveLead.etapa]}.
                      </p>
                    </div>
                    <Select value={selectedMotivo} onValueChange={setSelectedMotivo}>
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Selecione um motivo" />
                      </SelectTrigger>
                      <SelectContent>
                        {motivos
                          .filter((m) => {
                            const status =
                              moveLead.etapa === 'arquivado_nao_retorna'
                                ? 'arquivado'
                                : moveLead.etapa === 'perdido_concorrencia'
                                  ? 'perdido'
                                  : 'convertido_pedido'
                            return m.status === status
                          })
                          .map((m) => (
                            <SelectItem key={m.codigo} value={m.codigo}>
                              {m.codigo} · {m.descricao}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setMoveLead(null)}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={!selectedMotivo || saving}
                        onClick={() => applyMove(moveLead.lead, moveLead.etapa, selectedMotivo)}
                      >
                        Confirmar movimento
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}
