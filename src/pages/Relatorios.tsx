import React, { useEffect, useMemo, useState } from 'react'
import {
  ArrowUpRight,
  BarChart2,
  Download,
  Filter,
  Layers,
  PieChart as PieIcon,
  RotateCcw,
  TrendingUp,
  Users,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { clienteService, userService, vendaService } from '@/services/crmService'
import type { CategoriaProduto, Cliente, LeadEtapa, User, Venda } from '@/types/crm'
import { formatCurrencyBRL, formatDateBR } from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'

const STAGE_OPTIONS: { key: LeadEtapa; label: string; color: string }[] = [
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
  { key: 'fornecedores', label: 'Fornecedores', color: '#0F766E' },
]

const CATEGORY_OPTIONS: CategoriaProduto[] = [
  'Linha Prohmix',
  'Linha Supermix',
  'Linha Tipper',
  'Vagões Rodoviários',
  'Colhedora de forragens',
  'Homogeneizador de esterco',
  'Revolvedor de cama',
]

const EQUIPMENT_LINE_COLORS: Record<string, string> = {
  'Linha Prohmix': '#1B4332',
  'Linha Supermix': '#DC2626',
  'Linha Tipper': '#2563EB',
  'Vagões Rodoviários': '#7C3AED',
  'Colhedora de forragens': '#0F766E',
  'Homogeneizador de esterco': '#EA580C',
  'Revolvedor de cama': '#CA8A04',
  'Não informada': '#94A3B8',
}

const STATUS_LABELS: Record<string, string> = {
  em_andamento: 'Em andamento',
  arquivado: 'Arquivado',
  perdido: 'Perdido',
  convertido_pedido: 'Convertido para pedido',
}

function stageLabel(stage?: string) {
  return STAGE_OPTIONS.find((item) => item.key === stage)?.label || stage || 'Não informada'
}

function leadDate(lead: Venda) {
  return (lead.data_solicitacao || lead.created || '').slice(0, 10)
}

function displayOrigin(lead: Venda) {
  return lead.origem_lead || lead.origem || 'Não informada'
}

function displayProduct(lead: Venda) {
  return lead.produto || 'Não informada'
}

function displayEquipmentLine(lead: Venda) {
  return lead.categoria_produto || 'Não informada'
}

function displayStatus(lead: Venda) {
  return STATUS_LABELS[lead.status_lead || ''] || 'Em andamento'
}

function csvValue(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

function ChartEmpty() {
  return (
    <div className="flex h-full items-center justify-center text-xs text-[#94A3B8]">
      Sem leads para os filtros selecionados.
    </div>
  )
}

export default function Relatorios() {
  const [leads, setLeads] = useState<Venda[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [filtroEtapa, setFiltroEtapa] = useState('todas')
  const [filtroUsuario, setFiltroUsuario] = useState('todos')
  const [filtroOrigem, setFiltroOrigem] = useState('todas')
  const [filtroRegiao, setFiltroRegiao] = useState('todas')
  const [filtroProduto, setFiltroProduto] = useState('todos')
  const [filtroCategoria, setFiltroCategoria] = useState('todas')
  const [filtroStatus, setFiltroStatus] = useState('todos')

  const loadData = async () => {
    try {
      const [leadResult, clientResult, userResult] = await Promise.allSettled([
        vendaService.getAll(),
        clienteService.getAll(),
        userService.getAll(),
      ])
      if (leadResult.status === 'rejected') throw leadResult.reason
      setLeads(leadResult.value)
      if (clientResult.status === 'fulfilled') setClientes(clientResult.value)
      if (userResult.status === 'fulfilled') setUsers(userResult.value)
    } catch (error) {
      console.error(error)
      toast.error('Erro ao carregar dados dos relatórios de leads.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const clientById = useMemo(
    () => new Map(clientes.map((client) => [client.id, client])),
    [clientes],
  )
  const userById = useMemo(() => new Map(users.map((item) => [item.id, item])), [users])
  const leadUser = (lead: Venda) =>
    (lead.vendedor ? userById.get(lead.vendedor) : undefined) || lead.expand?.vendedor
  const leadClient = (lead: Venda) => clientById.get(lead.cliente) || lead.expand?.cliente
  const leadRegion = (lead: Venda) => {
    const client = leadClient(lead)
    const user = leadUser(lead)
    return lead.carteira || user?.carteira || client?.carteira || client?.estado || 'Não definida'
  }
  const leadUserName = (lead: Venda) =>
    leadUser(lead)?.name || leadUser(lead)?.email || 'Não atribuído'

  const optionValues = useMemo(() => {
    const origins = Array.from(new Set(leads.map(displayOrigin))).sort((a, b) => a.localeCompare(b))
    const regions = Array.from(new Set(leads.map(leadRegion))).sort((a, b) => a.localeCompare(b))
    const products = Array.from(new Set(leads.map(displayProduct))).sort((a, b) =>
      a.localeCompare(b),
    )
    const equipmentLines = Array.from(
      new Set([
        ...CATEGORY_OPTIONS,
        ...leads
          .map((lead) => lead.categoria_produto)
          .filter((value): value is string => Boolean(value)),
      ]),
    ).sort((a, b) => a.localeCompare(b))
    return { origins, regions, products, equipmentLines }
  }, [leads, clientById, userById])

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const date = leadDate(lead)
      if (dataInicio && date && date < dataInicio) return false
      if (dataFim && date && date > dataFim) return false
      if (filtroEtapa !== 'todas' && lead.etapa !== filtroEtapa) return false
      if (filtroUsuario !== 'todos' && lead.vendedor !== filtroUsuario) return false
      if (filtroOrigem !== 'todas' && displayOrigin(lead) !== filtroOrigem) return false
      if (filtroRegiao !== 'todas' && leadRegion(lead) !== filtroRegiao) return false
      if (filtroProduto !== 'todos' && displayProduct(lead) !== filtroProduto) return false
      if (
        filtroCategoria !== 'todas' &&
        (lead.categoria_produto || 'Não informada') !== filtroCategoria
      )
        return false
      if (filtroStatus !== 'todos' && (lead.status_lead || 'em_andamento') !== filtroStatus)
        return false
      return true
    })
  }, [
    leads,
    dataInicio,
    dataFim,
    filtroEtapa,
    filtroUsuario,
    filtroOrigem,
    filtroRegiao,
    filtroProduto,
    filtroCategoria,
    filtroStatus,
    clientById,
    userById,
  ])

  const resetFilters = () => {
    setDataInicio('')
    setDataFim('')
    setFiltroEtapa('todas')
    setFiltroUsuario('todos')
    setFiltroOrigem('todas')
    setFiltroRegiao('todas')
    setFiltroProduto('todos')
    setFiltroCategoria('todas')
    setFiltroStatus('todos')
  }

  const stageData = useMemo(
    () =>
      STAGE_OPTIONS.map((stage) => ({
        etapa: stage.label,
        leads: filteredLeads.filter((lead) => lead.etapa === stage.key).length,
        color: stage.color,
      })),
    [filteredLeads],
  )

  const originData = useMemo(() => {
    const map = new Map<string, number>()
    filteredLeads.forEach((lead) =>
      map.set(displayOrigin(lead), (map.get(displayOrigin(lead)) || 0) + 1),
    )
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([origem, leads]) => ({ origem, leads }))
  }, [filteredLeads])

  const responsibleData = useMemo(() => {
    const map = new Map<string, { total: number; convertidos: number }>()
    filteredLeads.forEach((lead) => {
      const name = leadUserName(lead)
      const current = map.get(name) || { total: 0, convertidos: 0 }
      current.total += 1
      if (lead.status_lead === 'convertido_pedido' || lead.etapa === 'convertido_pedido')
        current.convertidos += 1
      map.set(name, current)
    })
    return Array.from(map.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .map(([responsavel, values]) => ({ responsavel, ...values }))
  }, [filteredLeads, userById])

  const regionData = useMemo(() => {
    const map = new Map<string, number>()
    filteredLeads.forEach((lead) => map.set(leadRegion(lead), (map.get(leadRegion(lead)) || 0) + 1))
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([regiao, leads]) => ({ regiao, leads }))
  }, [filteredLeads, clientById, userById])

  const equipmentLineData = useMemo(() => {
    const map = new Map<string, number>()
    filteredLeads.forEach((lead) =>
      map.set(displayEquipmentLine(lead), (map.get(displayEquipmentLine(lead)) || 0) + 1),
    )
    return Array.from(map.entries()).map(([name, value]) => ({
      name,
      value,
      color: EQUIPMENT_LINE_COLORS[name] || '#64748B',
    }))
  }, [filteredLeads])

  const potentialByStageData = useMemo(
    () =>
      STAGE_OPTIONS.map((stage) => {
        const stageLeads = filteredLeads.filter((lead) => lead.etapa === stage.key)
        const valor = stageLeads.reduce((total, lead) => total + (lead.valor || 0), 0)
        const ponderado = stageLeads.reduce(
          (total, lead) => total + (lead.valor || 0) * ((lead.probabilidade || 0) / 100),
          0,
        )
        return { etapa: stage.label, valor, ponderado, color: stage.color }
      }),
    [filteredLeads],
  )

  const totalPotential = filteredLeads.reduce((total, lead) => total + (lead.valor || 0), 0)
  const weightedPotential = filteredLeads.reduce(
    (total, lead) => total + (lead.valor || 0) * ((lead.probabilidade || 0) / 100),
    0,
  )
  const convertedLeads = filteredLeads.filter(
    (lead) => lead.status_lead === 'convertido_pedido' || lead.etapa === 'convertido_pedido',
  ).length
  const conversionRate = filteredLeads.length
    ? Math.round((convertedLeads / filteredLeads.length) * 100)
    : 0
  const averageProbability = filteredLeads.length
    ? Math.round(
        filteredLeads.reduce((total, lead) => total + (lead.probabilidade || 0), 0) /
          filteredLeads.length,
      )
    : 0

  const handleExportCSV = () => {
    if (!filteredLeads.length) {
      toast.info('Nenhum lead para exportar com os filtros atuais.')
      return
    }
    const headers = [
      'ID do lead',
      'Número do lead',
      'Cliente',
      'Modelo do equipamento',
      'Linha de equipamento',
      'Etapa',
      'Status',
      'Origem',
      'Região / carteira',
      'Responsável',
      'Valor potencial (R$)',
      'Probabilidade (%)',
      'Data do lead',
      'Próxima ação',
    ]
    const rows = filteredLeads.map((lead) => [
      lead.id,
      lead.numero_lead || '',
      leadClient(lead)?.razao_social || leadClient(lead)?.empresa || leadClient(lead)?.nome || '',
      displayProduct(lead),
      displayEquipmentLine(lead),
      stageLabel(lead.etapa),
      displayStatus(lead),
      displayOrigin(lead),
      leadRegion(lead),
      leadUserName(lead),
      lead.valor || 0,
      lead.probabilidade || 0,
      leadDate(lead),
      lead.proxima_acao || '',
    ])
    const csv = '\uFEFF' + [headers, ...rows].map((row) => row.map(csvValue).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `haramaq_relatorio_leads_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast.success('Relatório de leads exportado com sucesso.')
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1B4332] border-t-transparent" />
          <p className="text-xs text-gray-500">Processando métricas de leads...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 px-4 py-5 sm:px-6 md:py-6 lg:px-8">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-[#1E293B] sm:text-2xl">
              Relatórios de Leads
            </h1>
            <Badge variant="outline" className="text-[10px]">
              Dados do funil
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-[#64748B] sm:text-sm">
            Desempenho, origem, carteira, responsáveis e potencial dos leads em tempo real.
          </p>
        </div>
        <Button
          onClick={handleExportCSV}
          className="h-9 gap-1.5 rounded-lg bg-[#D92323] text-xs font-semibold text-white shadow-xs hover:bg-[#B91C1C]"
        >
          <Download className="h-3.5 w-3.5" /> Exportar leads CSV
        </Button>
      </div>

      <Card className="rounded-xl border border-[#E2E8F0] bg-white shadow-xs">
        <CardHeader className="border-b border-[#F1F5F9] pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-bold text-[#1E293B]">
            <Filter className="h-4 w-4 text-[#D92323]" /> Filtros dos leads
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-[11px]">Data inicial</Label>
              <Input
                type="date"
                value={dataInicio}
                onChange={(event) => setDataInicio(event.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Data final</Label>
              <Input
                type="date"
                value={dataFim}
                onChange={(event) => setDataFim(event.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Etapa do Kanban</Label>
              <Select value={filtroEtapa} onValueChange={setFiltroEtapa}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as etapas</SelectItem>
                  {STAGE_OPTIONS.map((stage) => (
                    <SelectItem key={stage.key} value={stage.key}>
                      {stage.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Responsável / usuário</Label>
              <Select value={filtroUsuario} onValueChange={setFiltroUsuario}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os usuários</SelectItem>
                  {users.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name || item.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Origem do lead</Label>
              <Select value={filtroOrigem} onValueChange={setFiltroOrigem}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as origens</SelectItem>
                  {optionValues.origins.map((origin) => (
                    <SelectItem key={origin} value={origin}>
                      {origin}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Região / carteira</Label>
              <Select value={filtroRegiao} onValueChange={setFiltroRegiao}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as regiões</SelectItem>
                  {optionValues.regions.map((region) => (
                    <SelectItem key={region} value={region}>
                      {region}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Modelo do equipamento</Label>
              <Select value={filtroProduto} onValueChange={setFiltroProduto}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os modelos</SelectItem>
                  {optionValues.products.map((product) => (
                    <SelectItem key={product} value={product}>
                      {product}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Linha de equipamento</Label>
              <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as linhas</SelectItem>
                  {optionValues.equipmentLines.map((line) => (
                    <SelectItem key={line} value={line}>
                      {line}
                    </SelectItem>
                  ))}
                  <SelectItem value="Não informada">Não informada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Status do lead</Label>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os status</SelectItem>
                  <SelectItem value="em_andamento">Em andamento</SelectItem>
                  <SelectItem value="arquivado">Arquivado</SelectItem>
                  <SelectItem value="perdido">Perdido</SelectItem>
                  <SelectItem value="convertido_pedido">Convertido para pedido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#F1F5F9] pt-3">
            <span className="text-xs text-[#64748B]">
              {filteredLeads.length} lead(s) correspondem aos filtros.
            </span>
            <Button
              type="button"
              variant="outline"
              onClick={resetFilters}
              className="h-8 gap-1.5 text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Limpar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-xl border border-[#E2E8F0] bg-white shadow-xs">
          <CardContent className="p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
              Leads filtrados
            </span>
            <p className="mt-1 text-2xl font-black text-[#1E293B]">{filteredLeads.length}</p>
            <p className="mt-1 text-[11px] text-[#64748B]">Registros do funil</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border border-[#E2E8F0] bg-white shadow-xs">
          <CardContent className="p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
              Valor potencial
            </span>
            <p className="mt-1 text-xl font-black text-[#1E293B]">
              {formatCurrencyBRL(totalPotential)}
            </p>
            <p className="mt-1 text-[11px] text-[#64748B]">Soma dos valores dos leads</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border border-[#E2E8F0] bg-white shadow-xs">
          <CardContent className="p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
              Valor ponderado
            </span>
            <p className="mt-1 text-xl font-black text-[#1B4332]">
              {formatCurrencyBRL(weightedPotential)}
            </p>
            <p className="mt-1 text-[11px] text-[#64748B]">Valor × probabilidade</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border border-[#E2E8F0] bg-white shadow-xs">
          <CardContent className="p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
              Conversão / probabilidade
            </span>
            <p className="mt-1 text-2xl font-black text-[#D92323]">{conversionRate}%</p>
            <p className="mt-1 text-[11px] text-[#64748B]">
              {convertedLeads} convertidos · média {averageProbability}%
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="rounded-xl border border-[#E2E8F0] bg-white shadow-xs">
          <CardHeader className="border-b border-[#F1F5F9] pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-bold text-[#1E293B]">
              <Layers className="h-4 w-4 text-[#D92323]" /> Leads por etapa do Kanban
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="h-80 w-full">
              {filteredLeads.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stageData} margin={{ bottom: 70, left: 10, right: 10 }}>
                    <XAxis
                      dataKey="etapa"
                      angle={-35}
                      textAnchor="end"
                      interval={0}
                      height={85}
                      fontSize={10}
                      stroke="#94A3B8"
                    />
                    <YAxis allowDecimals={false} fontSize={11} stroke="#94A3B8" />
                    <Tooltip formatter={(value) => [value, 'Leads']} />
                    <Bar dataKey="leads" radius={[4, 4, 0, 0]}>
                      {stageData.map((entry) => (
                        <Cell key={entry.etapa} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <ChartEmpty />
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border border-[#E2E8F0] bg-white shadow-xs">
          <CardHeader className="border-b border-[#F1F5F9] pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-bold text-[#1E293B]">
              <TrendingUp className="h-4 w-4 text-[#F59E0B]" /> Origem dos leads
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="h-80 w-full">
              {originData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={originData} margin={{ bottom: 65, left: 10, right: 10 }}>
                    <XAxis
                      dataKey="origem"
                      angle={-35}
                      textAnchor="end"
                      interval={0}
                      height={80}
                      fontSize={10}
                      stroke="#94A3B8"
                    />
                    <YAxis allowDecimals={false} fontSize={11} stroke="#94A3B8" />
                    <Tooltip formatter={(value) => [value, 'Leads']} />
                    <Bar dataKey="leads" fill="#2563EB" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <ChartEmpty />
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border border-[#E2E8F0] bg-white shadow-xs">
          <CardHeader className="border-b border-[#F1F5F9] pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-bold text-[#1B4332]">
              <Users className="h-4 w-4 text-[#1B4332]" /> Desempenho por responsável
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="h-80 w-full">
              {responsibleData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={responsibleData}
                    layout="vertical"
                    margin={{ left: 45, right: 20 }}
                  >
                    <XAxis type="number" allowDecimals={false} fontSize={11} stroke="#94A3B8" />
                    <YAxis
                      dataKey="responsavel"
                      type="category"
                      width={110}
                      fontSize={10}
                      stroke="#94A3B8"
                    />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey="total"
                      name="Total de leads"
                      fill="#2563EB"
                      radius={[0, 4, 4, 0]}
                    />
                    <Bar
                      dataKey="convertidos"
                      name="Convertidos"
                      fill="#16A34A"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <ChartEmpty />
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border border-[#E2E8F0] bg-white shadow-xs">
          <CardHeader className="border-b border-[#F1F5F9] pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-bold text-[#7C3AED]">
              <BarChart2 className="h-4 w-4 text-[#7C3AED]" /> Leads por região / carteira
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="h-80 w-full">
              {regionData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={regionData} margin={{ bottom: 55, left: 10, right: 10 }}>
                    <XAxis
                      dataKey="regiao"
                      angle={-30}
                      textAnchor="end"
                      interval={0}
                      height={70}
                      fontSize={10}
                      stroke="#94A3B8"
                    />
                    <YAxis allowDecimals={false} fontSize={11} stroke="#94A3B8" />
                    <Tooltip formatter={(value) => [value, 'Leads']} />
                    <Bar dataKey="leads" fill="#7C3AED" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <ChartEmpty />
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border border-[#E2E8F0] bg-white shadow-xs">
          <CardHeader className="border-b border-[#F1F5F9] pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-bold text-[#1E293B]">
              <PieIcon className="h-4 w-4 text-[#D92323]" /> Distribuição por linha de equipamento
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="h-80 w-full">
              {equipmentLineData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={equipmentLineData}
                      cx="50%"
                      cy="45%"
                      innerRadius={65}
                      outerRadius={105}
                      paddingAngle={3}
                      dataKey="value"
                      nameKey="name"
                    >
                      {equipmentLineData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <ChartEmpty />
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border border-[#E2E8F0] bg-white shadow-xs">
          <CardHeader className="border-b border-[#F1F5F9] pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-bold text-[#0F766E]">
              <ArrowUpRight className="h-4 w-4 text-[#0F766E]" /> Potencial por etapa
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="h-80 w-full">
              {filteredLeads.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={potentialByStageData}
                    margin={{ bottom: 70, left: 10, right: 10 }}
                  >
                    <XAxis
                      dataKey="etapa"
                      angle={-35}
                      textAnchor="end"
                      interval={0}
                      height={85}
                      fontSize={10}
                      stroke="#94A3B8"
                    />
                    <YAxis
                      fontSize={10}
                      stroke="#94A3B8"
                      tickFormatter={(value) => `R$ ${(Number(value) / 1000).toFixed(0)}k`}
                    />
                    <Tooltip formatter={(value) => [formatCurrencyBRL(Number(value)), 'Valor']} />
                    <Legend />
                    <Bar
                      dataKey="valor"
                      name="Valor potencial"
                      fill="#0F766E"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="ponderado"
                      name="Valor ponderado"
                      fill="#F59E0B"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <ChartEmpty />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-xs">
        <CardHeader className="border-b border-[#F1F5F9] pb-3">
          <CardTitle className="text-sm font-bold text-[#1E293B]">
            Leads incluídos na análise ({filteredLeads.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-xs">
              <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[10px] uppercase tracking-wider text-[#64748B]">
                <tr>
                  <th className="px-4 py-3">Lead / cliente</th>
                  <th className="px-4 py-3">Etapa</th>
                  <th className="px-4 py-3">Responsável</th>
                  <th className="px-4 py-3">Origem</th>
                  <th className="px-4 py-3">Região</th>
                  <th className="px-4 py-3">Modelo</th>
                  <th className="px-4 py-3">Linha de equipamento</th>
                  <th className="px-4 py-3">Valor potencial</th>
                  <th className="px-4 py-3">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-[#F8FAFC]">
                    <td className="px-4 py-3">
                      <p className="font-bold text-[#1E293B]">{lead.numero_lead || lead.id}</p>
                      <p className="text-[11px] text-[#64748B]">
                        {leadClient(lead)?.razao_social ||
                          leadClient(lead)?.empresa ||
                          leadClient(lead)?.nome ||
                          'Cliente não informado'}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-[10px]">
                        {stageLabel(lead.etapa)}
                      </Badge>
                      <p className="mt-1 text-[10px] text-[#64748B]">{displayStatus(lead)}</p>
                    </td>
                    <td className="px-4 py-3 text-[#475569]">{leadUserName(lead)}</td>
                    <td className="px-4 py-3 text-[#475569]">{displayOrigin(lead)}</td>
                    <td className="px-4 py-3 text-[#475569]">{leadRegion(lead)}</td>
                    <td className="px-4 py-3 text-[#475569]">{displayProduct(lead)}</td>
                    <td className="px-4 py-3 text-[#475569]">{displayEquipmentLine(lead)}</td>
                    <td className="px-4 py-3 font-semibold text-[#1E293B]">
                      {formatCurrencyBRL(lead.valor || 0)}
                      <p className="text-[10px] font-normal text-[#64748B]">
                        Probabilidade {lead.probabilidade || 0}%
                      </p>
                    </td>
                    <td className="px-4 py-3 text-[#64748B]">{formatDateBR(leadDate(lead))}</td>
                  </tr>
                ))}
                {!filteredLeads.length && (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-sm text-[#94A3B8]">
                      Nenhum lead encontrado com os filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
