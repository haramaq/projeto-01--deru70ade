import React, { useState, useEffect, useMemo } from 'react'
import {
  Download,
  Calendar,
  Filter,
  TrendingUp,
  PieChart as PieIcon,
  BarChart2,
  Layers,
  ArrowUpRight,
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import { vendaService, clienteService, userService } from '@/services/crmService'
import type { Venda, Cliente, User } from '@/types/crm'
import { formatCurrencyBRL } from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

export default function Relatorios() {
  const [vendas, setVendas] = useState<Venda[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  // Date range filter
  const [dataInicio, setDataInicio] = useState('2025-01-01')
  const [dataFim, setDataFim] = useState('2025-12-31')

  const loadData = async () => {
    try {
      const [v, c, u] = await Promise.all([
        vendaService.getAll(),
        clienteService.getAll(),
        userService.getAll(),
      ])
      setVendas(v)
      setClientes(c)
      setUsers(u)
    } catch {
      toast.error('Erro ao carregar dados dos relatórios.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Filtered vendas by date range
  const filteredVendas = useMemo(() => {
    return vendas.filter((v) => {
      const dateStr = v.data_prevista_fechamento || v.created
      if (!dateStr) return true
      const d = dateStr.slice(0, 10)
      if (dataInicio && d < dataInicio) return false
      if (dataFim && d > dataFim) return false
      return true
    })
  }, [vendas, dataInicio, dataFim])

  // Chart 1: Vendas por Período (Monthly distribution)
  const vendasPorPeriodoData = useMemo(() => {
    const months = [
      'Jan',
      'Fev',
      'Mar',
      'Abr',
      'Mai',
      'Jun',
      'Jul',
      'Ago',
      'Set',
      'Out',
      'Nov',
      'Dez',
    ]
    const map: Record<string, number> = {}
    months.forEach((m) => (map[m] = 0))

    filteredVendas.forEach((v) => {
      const dateStr = v.data_prevista_fechamento || v.created
      if (dateStr) {
        const d = new Date(dateStr)
        if (!isNaN(d.getTime())) {
          const mName = months[d.getMonth()]
          map[mName] = (map[mName] || 0) + (v.valor || 0)
        }
      }
    })

    return months.map((m) => ({
      mes: m,
      total: map[m] || 0,
    }))
  }, [filteredVendas])

  // Chart 2: Produtos Vendidos (Donut PROHMIX vs SUPERMIX)
  const produtosVendidosData = useMemo(() => {
    let prohmix = 0
    let supermix = 0

    filteredVendas.forEach((v) => {
      if (v.produto === 'SUPERMIX') supermix += 1
      else prohmix += 1
    })

    return [
      { name: 'PROHMIX', value: prohmix, color: '#1B4332' },
      { name: 'SUPERMIX', value: supermix, color: '#DC2626' },
    ]
  }, [filteredVendas])

  // Chart 3: Conversão por Vendedor
  const conversaoPorVendedorData = useMemo(() => {
    const map: Record<string, { total: number; fechados: number; nome: string }> = {}

    // Init users
    users.forEach((u) => {
      map[u.id] = { total: 0, fechados: 0, nome: u.name || u.email.split('@')[0] }
    })

    filteredVendas.forEach((v) => {
      const vId = v.vendedor || 'outro'
      if (!map[vId]) {
        map[vId] = {
          total: 0,
          fechados: 0,
          nome: v.expand?.vendedor?.name || 'Vendedor',
        }
      }
      map[vId].total += 1
      if (v.status_lead === 'convertido_pedido') {
        map[vId].fechados += 1
      }
    })

    return Object.values(map)
      .filter((item) => item.total > 0)
      .map((item) => {
        const taxa = Math.round((item.fechados / item.total) * 100)
        return {
          vendedor: item.nome,
          taxa,
          fechados: item.fechados,
          total: item.total,
        }
      })
  }, [users, filteredVendas])

  // Chart 4: Pipeline Total (Stacked Funnel Stage Values)
  const pipelineTotalData = useMemo(() => {
    const stages = [
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

    return stages.map((st) => {
      const deals = filteredVendas.filter((v) => v.etapa === st.key)
      const valor = deals.reduce((acc, d) => acc + (d.valor || 0), 0)
      return {
        etapa: st.label,
        valor,
        quantidade: deals.length,
        color: st.color,
      }
    })
  }, [filteredVendas])

  // Export CSV
  const handleExportCSV = () => {
    if (filteredVendas.length === 0) {
      toast.info('Nenhum dado para exportar no período.')
      return
    }

    const headers = [
      'ID',
      'Cliente',
      'Produto',
      'Valor (R$)',
      'Etapa',
      'Probabilidade (%)',
      'Previsao Fechamento',
      'Vendedor',
      'Proxima Acao',
    ]

    const rows = filteredVendas.map((v) => [
      v.id,
      `"${v.expand?.cliente?.empresa || v.expand?.cliente?.nome || ''}"`,
      v.produto,
      v.valor,
      v.etapa,
      v.probabilidade,
      v.data_prevista_fechamento || '',
      `"${v.expand?.vendedor?.name || ''}"`,
      `"${(v.proxima_acao || '').replace(/"/g, '""')}"`,
    ])

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute(
      'download',
      `haramaq_relatorio_vendas_${new Date().toISOString().slice(0, 10)}.csv`,
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Relatório CSV exportado com sucesso!')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-4 border-[#1B4332] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-gray-500">Processando métricas e relatórios...</p>
        </div>
      </div>
    )
  }

  const totalVolume = filteredVendas.reduce((acc, v) => acc + (v.valor || 0), 0)

  return (
    <div className="w-full max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-5 md:py-6 space-y-6">
      {/* Header & Date Range */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1E293B] tracking-tight">
            Relatórios e Inteligência Comercial
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] mt-0.5">
            Análises gerenciais de conversão, demanda por produto e previsão de receitas
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-white px-3 py-1 rounded-lg border border-[#E2E8F0] text-xs h-9">
            <span className="text-[#94A3B8] font-medium">De:</span>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="outline-none text-[#1E293B] bg-transparent text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-white px-3 py-1 rounded-lg border border-[#E2E8F0] text-xs h-9">
            <span className="text-[#94A3B8] font-medium">Até:</span>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="outline-none text-[#1E293B] bg-transparent text-xs"
            />
          </div>

          <Button
            onClick={handleExportCSV}
            className="bg-[#D92323] hover:bg-[#B91C1C] text-white font-semibold rounded-lg text-xs gap-1.5 h-9 shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Summary Mini Bar */}
      <div className="bg-white p-4 rounded-[16px] border border-[#E5E7EB] shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-400">
              Total Negociado no Período
            </span>
            <p className="text-xl font-black text-gray-900 tabular-nums">
              {formatCurrencyBRL(totalVolume)}
            </p>
          </div>
          <div className="h-8 w-px bg-gray-200 hidden sm:block" />
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-400">
              Negócios Filtrados
            </span>
            <p className="text-xl font-black text-gray-900 tabular-nums">
              {filteredVendas.length}{' '}
              <span className="text-xs font-normal text-gray-500">propostas</span>
            </p>
          </div>
        </div>

        <div className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
          <ArrowUpRight className="w-4 h-4" />
          Métricas calculadas em tempo real
        </div>
      </div>

      {/* 4 Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Vendas por Período */}
        <Card className="rounded-xl border border-[#E2E8F0] shadow-xs bg-white">
          <CardHeader className="pb-2 border-b border-[#F1F5F9]">
            <CardTitle className="text-sm font-bold text-[#1E293B] flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-[#D92323]" />
              1. Volume de Vendas por Período (Mensal)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-6">
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={vendasPorPeriodoData}>
                  <XAxis dataKey="mes" stroke="#94A3B8" fontSize={11} />
                  <YAxis
                    stroke="#94A3B8"
                    fontSize={11}
                    tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(val) => [formatCurrencyBRL(Number(val)), 'Total']}
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="total" fill="#D92323" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Chart 2: Produtos Vendidos (Donut) */}
        <Card className="rounded-[16px] border border-[#E5E7EB] shadow-xs">
          <CardHeader className="pb-2 border-b border-gray-100">
            <CardTitle className="text-sm font-bold text-[#1B4332] flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-[#DC2626]" />
              2. Proporção de Linhas (PROHMIX vs SUPERMIX)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-6">
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={produtosVendidosData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={95}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {produtosVendidosData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '12px',
                      border: '1px solid #E5E7EB',
                      fontSize: '12px',
                    }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Chart 3: Conversão por Vendedor */}
        <Card className="rounded-[16px] border border-[#E5E7EB] shadow-xs">
          <CardHeader className="pb-2 border-b border-gray-100">
            <CardTitle className="text-sm font-bold text-[#1B4332] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#F59E0B]" />
              3. Taxa de Conversão por Vendedor (%)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-6">
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={conversaoPorVendedorData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                >
                  <XAxis type="number" domain={[0, 100]} stroke="#9CA3AF" fontSize={11} unit="%" />
                  <YAxis dataKey="vendedor" type="category" stroke="#9CA3AF" fontSize={11} />
                  <Tooltip
                    formatter={(val) => [`${val}%`, 'Conversão']}
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '12px',
                      border: '1px solid #E5E7EB',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="taxa" fill="#1B4332" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Chart 4: Pipeline Total por Etapa */}
        <Card className="rounded-[16px] border border-[#E5E7EB] shadow-xs">
          <CardHeader className="pb-2 border-b border-gray-100">
            <CardTitle className="text-sm font-bold text-[#1B4332] flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#2D6A4F]" />
              4. Distribuição Financeira do Funil (Pipeline)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-6">
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pipelineTotalData}>
                  <XAxis dataKey="etapa" stroke="#9CA3AF" fontSize={11} />
                  <YAxis
                    stroke="#9CA3AF"
                    fontSize={11}
                    tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(val) => [formatCurrencyBRL(Number(val)), 'Valor Total']}
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '12px',
                      border: '1px solid #E5E7EB',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
                    {pipelineTotalData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
