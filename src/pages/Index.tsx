import React, { useEffect, useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  DollarSign,
  Users,
  Building2,
  AlertTriangle,
  ArrowUpRight,
  TrendingUp,
  PlusCircle,
  ChevronRight,
  Clock,
  ShieldCheck,
} from 'lucide-react'
import { clienteService, revendaService, vendaService, ticketService } from '@/services/crmService'
import type { Cliente, Revenda, Venda, Ticket } from '@/types/crm'
import { formatCurrencyBRL, formatDateBR } from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import useRealtime from '@/hooks/use-realtime'
import { useAuth } from '@/contexts/AuthContext'

export default function Dashboard() {
  const { role } = useAuth()
  const navigate = useNavigate()

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [revendas, setRevendas] = useState<Revenda[]>([])
  const [vendas, setVendas] = useState<Venda[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    try {
      const [c, r, v, t] = await Promise.all([
        clienteService.getAll(),
        revendaService.getAll(),
        vendaService.getAll(),
        ticketService.getAll(),
      ])
      setClientes(c)
      setRevendas(r)
      setVendas(v)
      setTickets(t)
    } catch (err) {
      console.error('Erro ao carregar dados do dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Subscriptions
  useRealtime('vendas', () => {
    vendaService
      .getAll()
      .then(setVendas)
      .catch(() => {})
  })
  useRealtime('tickets', () => {
    ticketService
      .getAll()
      .then(setTickets)
      .catch(() => {})
  })
  useRealtime('clientes', () => {
    clienteService
      .getAll()
      .then(setClientes)
      .catch(() => {})
  })

  // Calculations
  // 1. Vendas no Mês (ganho ou fechamento)
  const stats = useMemo(() => {
    const fechamentoVendas = vendas.filter((v) => v.etapa === 'fechamento')
    const totalVendasMes = fechamentoVendas.reduce((acc, curr) => acc + (curr.valor || 0), 0)

    const clientesAtivos = clientes.filter((c) => c.status === 'ativo').length
    const revendasAutorizadas = revendas.filter((r) => r.status === 'autorizada').length
    const ticketsAbertos = tickets.filter((t) => t.status === 'aberto').length

    return {
      totalVendasMes,
      clientesAtivos,
      revendasAutorizadas,
      ticketsAbertos,
    }
  }, [vendas, clientes, revendas, tickets])

  // Funnel calculations
  const funnelStages = useMemo(() => {
    const stages = [
      { key: 'prospeccao', label: 'Prospecção', color: '#40916C', bg: 'bg-[#40916C]' },
      { key: 'orcamento', label: 'Orçamento', color: '#2D6A4F', bg: 'bg-[#2D6A4F]' },
      { key: 'negociacao', label: 'Negociação', color: '#F59E0B', bg: 'bg-[#F59E0B]' },
      { key: 'fechamento', label: 'Fechamento', color: '#DC2626', bg: 'bg-[#DC2626]' },
    ]

    return stages.map((st, idx) => {
      const deals = vendas.filter((v) => v.etapa === st.key)
      const count = deals.length
      const total = deals.reduce((acc, v) => acc + (v.valor || 0), 0)
      return {
        ...st,
        count,
        total,
        order: idx,
      }
    })
  }, [vendas])

  const recentClientes = clientes.slice(0, 5)
  const recentTickets = tickets.slice(0, 4)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-4 border-[#1B4332] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-gray-500">Carregando indicadores...</p>
        </div>
      </div>
    )
  }

  const canCreate = role === 'admin' || role === 'vendedor'

  return (
    <div className="space-y-6">
      {/* Welcome banner & summary */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1B4332] tracking-tight">
            Painel Executivo Haramaq
          </h1>
          <p className="text-sm text-gray-500">
            Visão consolidada do pipeline de vendas, rede de revendas e suporte técnico.
          </p>
        </div>

        {canCreate && (
          <div className="flex items-center gap-3">
            <Button
              onClick={() => navigate('/vendas?nova=true')}
              className="bg-[#DC2626] hover:bg-[#b91c1c] text-white font-semibold rounded-xl gap-2 shadow-sm transition-transform hover:scale-[1.02]"
            >
              <PlusCircle className="w-4 h-4" />
              Nova Venda
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/clientes?novo=true')}
              className="border-[#1B4332] text-[#1B4332] hover:bg-[#1B4332]/10 font-semibold rounded-xl gap-2"
            >
              <Users className="w-4 h-4" />
              Novo Cliente
            </Button>
          </div>
        )}
      </div>

      {/* 4 Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        {/* Card 1: Vendas no Mês */}
        <Card className="rounded-[16px] border border-[#E5E7EB] shadow-xs hover:translate-y-[-2px] transition-all duration-200">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs uppercase font-medium tracking-wider text-gray-500">
                Vendas no Mês
              </span>
              <p className="text-2xl font-bold text-gray-900 tabular-nums">
                {formatCurrencyBRL(stats.totalVendasMes)}
              </p>
              <div className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>+14,2% vs. mês anterior</span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-100/60 flex items-center justify-center text-[#1B4332]">
              <DollarSign className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Clientes Ativos */}
        <Card className="rounded-[16px] border border-[#E5E7EB] shadow-xs hover:translate-y-[-2px] transition-all duration-200">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs uppercase font-medium tracking-wider text-gray-500">
                Clientes Ativos
              </span>
              <p className="text-2xl font-bold text-gray-900 tabular-nums">
                {stats.clientesAtivos}
              </p>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <span>{clientes.length} cadastrados no total</span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-[#40916C]/15 flex items-center justify-center text-[#2D6A4F]">
              <Users className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Revendas Autorizadas */}
        <Card className="rounded-[16px] border border-[#E5E7EB] shadow-xs hover:translate-y-[-2px] transition-all duration-200">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs uppercase font-medium tracking-wider text-gray-500">
                Revendas Autorizadas
              </span>
              <p className="text-2xl font-bold text-gray-900 tabular-nums">
                {stats.revendasAutorizadas}
              </p>
              <div className="flex items-center gap-1 text-xs text-emerald-700">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Rede credenciada ativa</span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-[#2D6A4F]/15 flex items-center justify-center text-[#1B4332]">
              <Building2 className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Tickets em Aberto */}
        <Card className="rounded-[16px] border border-[#E5E7EB] shadow-xs hover:translate-y-[-2px] transition-all duration-200">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs uppercase font-medium tracking-wider text-gray-500">
                Tickets em Aberto
              </span>
              <p className="text-2xl font-bold text-[#DC2626] tabular-nums">
                {stats.ticketsAbertos}
              </p>
              <div className="flex items-center gap-1 text-xs text-red-600 font-medium">
                <Clock className="w-3.5 h-3.5" />
                <span>Aguardando atendimento</span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center text-[#DC2626]">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales Funnel Chart Section */}
      <Card className="rounded-[16px] border border-[#E5E7EB] shadow-xs overflow-hidden">
        <CardHeader className="border-b border-gray-100 pb-4 bg-white flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-[#1B4332] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#40916C]" />
              Funil de Vendas de Misturadores (PROHMIX / SUPERMIX)
            </CardTitle>
            <p className="text-xs text-gray-500 mt-0.5">
              Volume financeiro e conversão por etapa do ciclo de vendas
            </p>
          </div>
          <Link
            to="/vendas"
            className="text-xs font-semibold text-[#1B4332] hover:text-[#2D6A4F] flex items-center gap-1"
          >
            Ver Kanban completo <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </CardHeader>
        <CardContent className="p-6 bg-white space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {funnelStages.map((stage, idx) => {
              const prevStage = idx > 0 ? funnelStages[idx - 1] : null
              const convRate =
                prevStage && prevStage.count > 0
                  ? Math.round((stage.count / prevStage.count) * 100)
                  : null

              return (
                <div
                  key={stage.key}
                  className="p-4 rounded-xl border border-gray-100 bg-[#F8FAF9] flex flex-col justify-between relative overflow-hidden"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-600">
                      {stage.label}
                    </span>
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: stage.color }}
                    />
                  </div>

                  <div className="my-2">
                    <div className="text-xl font-black text-gray-900 tabular-nums">
                      {stage.count}{' '}
                      <span className="text-xs font-medium text-gray-500">negócios</span>
                    </div>
                    <div className="text-xs font-semibold text-gray-700 mt-0.5">
                      {formatCurrencyBRL(stage.total)}
                    </div>
                  </div>

                  {convRate !== null ? (
                    <div className="text-[11px] text-gray-500 pt-2 border-t border-gray-200/60 flex items-center justify-between">
                      <span>Conversão anterior:</span>
                      <span className="font-bold text-gray-700">{convRate}%</span>
                    </div>
                  ) : (
                    <div className="text-[11px] text-gray-400 pt-2 border-t border-gray-200/60">
                      Início do pipeline
                    </div>
                  )}

                  {/* Visual colored bottom stripe */}
                  <div
                    className="absolute bottom-0 left-0 right-0 h-1"
                    style={{ backgroundColor: stage.color }}
                  />
                </div>
              )
            })}
          </div>

          {/* Combined Visual Funnel Progress Bar */}
          <div className="space-y-1.5 pt-2">
            <div className="flex justify-between text-xs text-gray-500 font-medium">
              <span>Distribuição do Pipeline</span>
              <span>
                Total no Pipeline:{' '}
                <strong className="text-gray-900">
                  {formatCurrencyBRL(vendas.reduce((acc, v) => acc + (v.valor || 0), 0))}
                </strong>
              </span>
            </div>
            <div className="h-4 w-full bg-gray-100 rounded-full flex overflow-hidden p-0.5 gap-0.5">
              {funnelStages.map((stage) => {
                const totalDeals = vendas.length || 1
                const pct = (stage.count / totalDeals) * 100
                if (pct === 0) return null
                return (
                  <div
                    key={stage.key}
                    style={{
                      width: `${pct}%`,
                      backgroundColor: stage.color,
                    }}
                    title={`${stage.label}: ${stage.count} negócios (${formatCurrencyBRL(stage.total)})`}
                    className="h-full rounded-full transition-all"
                  />
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grid: Recent Customers & Recent Support Tickets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Customers */}
        <Card className="rounded-[16px] border border-[#E5E7EB] shadow-xs">
          <CardHeader className="border-b border-gray-100 pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-bold text-[#1B4332]">Clientes Recentes</CardTitle>
            <Link
              to="/clientes"
              className="text-xs font-semibold text-[#1B4332] hover:text-[#2D6A4F] flex items-center gap-1"
            >
              Ver todos <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50/80 border-b border-gray-100 text-gray-500 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-2.5 px-4">Nome / Empresa</th>
                    <th className="py-2.5 px-4">Cidade</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentClientes.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-3 px-4">
                        <p className="font-semibold text-gray-900">{c.empresa || c.nome}</p>
                        <p className="text-[11px] text-gray-500">{c.nome}</p>
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {c.cidade ? `${c.cidade} - ${c.estado || ''}` : '-'}
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="secondary"
                          className={
                            c.status === 'ativo'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              : 'bg-gray-100 text-gray-700 border-gray-200'
                          }
                        >
                          {c.status === 'ativo' ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          to={`/clientes/${c.id}`}
                          className="font-semibold text-[#1B4332] hover:text-[#DC2626] transition-colors"
                        >
                          Ver detalhes
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {recentClientes.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-gray-400">
                        Nenhum cliente cadastrado ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Recent Tickets */}
        <Card className="rounded-[16px] border border-[#E5E7EB] shadow-xs">
          <CardHeader className="border-b border-gray-100 pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-bold text-[#1B4332]">
              Chamados de Suporte
            </CardTitle>
            <Link
              to="/suporte"
              className="text-xs font-semibold text-[#1B4332] hover:text-[#2D6A4F] flex items-center gap-1"
            >
              Ver suporte <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {recentTickets.map((t) => {
              const priorityColors: Record<string, string> = {
                alta: 'bg-red-100 text-red-800 border-red-200',
                media: 'bg-amber-100 text-amber-800 border-amber-200',
                baixa: 'bg-emerald-100 text-emerald-800 border-emerald-200',
              }
              return (
                <div
                  key={t.id}
                  onClick={() => navigate('/suporte')}
                  className="p-3 rounded-xl border border-gray-100 hover:border-gray-200 bg-[#F8FAF9] hover:bg-white cursor-pointer transition-all flex items-start justify-between gap-3 shadow-2xs"
                >
                  <div className="space-y-1 min-w-0">
                    <p className="font-semibold text-xs text-gray-900 truncate">{t.assunto}</p>
                    <p className="text-[11px] text-gray-500">
                      Cliente:{' '}
                      <span className="font-medium text-gray-700">
                        {t.expand?.cliente?.empresa || t.expand?.cliente?.nome || 'Cliente'}
                      </span>
                    </p>
                    <p className="text-[10px] text-gray-400">Criado em {formatDateBR(t.created)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <Badge
                      variant="outline"
                      className={`text-[10px] capitalize font-medium ${priorityColors[t.prioridade] || ''}`}
                    >
                      {t.prioridade}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className={
                        t.status === 'aberto'
                          ? 'bg-red-50 text-red-600 border border-red-100'
                          : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                      }
                    >
                      {t.status === 'aberto' ? 'Aberto' : 'Finalizado'}
                    </Badge>
                  </div>
                </div>
              )
            })}
            {recentTickets.length === 0 && (
              <p className="py-6 text-center text-xs text-gray-400">Nenhum ticket registrado.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
