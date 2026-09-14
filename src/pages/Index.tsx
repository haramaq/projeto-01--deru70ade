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
  CheckCircle,
  HelpCircle,
  SlidersHorizontal,
} from 'lucide-react'
import { clienteService, revendaService, vendaService, ticketService } from '@/services/crmService'
import type { Cliente, Revenda, Venda, Ticket } from '@/types/crm'
import { formatCurrencyBRL, formatDateBR } from '@/lib/formatters'
import useRealtime from '@/hooks/use-realtime'
import { useAuth } from '@/contexts/AuthContext'
import {
  PageContainer,
  PageHeader,
  MetricCard,
  StatusBadge,
  HaramaqCard,
  HaramaqButton,
  HaramaqDataTable,
} from '@/components/haramaq'

export default function Dashboard() {
  const { role } = useAuth()
  const navigate = useNavigate()

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [revendas, setRevendas] = useState<Revenda[]>([])
  const [vendas, setVendas] = useState<Venda[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [periodoFiltro, setPeriodoFiltro] = useState<'30dias' | '7dias' | 'esteMes' | 'todos'>(
    '30dias',
  )

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
  const stats = useMemo(() => {
    const fechamentoVendas = vendas.filter((v) => v.status_lead === 'convertido_pedido')
    const totalVendasMes = fechamentoVendas.reduce((acc, curr) => acc + (curr.valor || 0), 0)

    const clientesAtivos = clientes.filter((c) => c.status === 'ativo').length
    const revendasAutorizadas = revendas.filter((r) => r.status === 'autorizada').length
    const ticketsAbertos = tickets.filter((t) => t.status === 'aberto').length
    const ticketsFinalizados = tickets.filter((t) => t.status === 'finalizado').length

    return {
      totalVendasMes,
      clientesAtivos,
      revendasAutorizadas,
      ticketsAbertos,
      ticketsFinalizados,
    }
  }, [vendas, clientes, revendas, tickets])

  // Funnel calculations
  const funnelStages = useMemo(() => {
    const stages = [
      {
        key: 'agendamento_primeiro_contato',
        label: 'Agendamento de 1º contato',
        color: '#2563EB',
        variant: 'em_andamento',
      },
      { key: 'em_contato', label: 'Em contato', color: '#0284C7', variant: 'info' },
      { key: 'revenda_contato', label: 'Revenda Contato', color: '#7C3AED', variant: 'info' },
      { key: 'orcamentacao', label: 'Orçamentação', color: '#F59E0B', variant: 'em_espera' },
      {
        key: 'contato_futuro_agendado',
        label: 'Contato futuro (Agendado)',
        color: '#64748B',
        variant: 'em_espera',
      },
      {
        key: 'arquivado_nao_retorna',
        label: 'Arquivado (não retorna)',
        color: '#94A3B8',
        variant: 'em_espera',
      },
      {
        key: 'perdido_concorrencia',
        label: 'Perdido (comprou da concorrência)',
        color: '#E11D48',
        variant: 'gargalo',
      },
      {
        key: 'convertido_pedido',
        label: 'Convertido para pedido',
        color: '#16A34A',
        variant: 'concluidas',
      },
      { key: 'pecas_pos_vendas', label: 'Peças e Pós-vendas', color: '#9333EA', variant: 'info' },
      { key: 'financeiro_fiscal', label: 'Financeiro e Fiscal', color: '#0369A1', variant: 'info' },
      { key: 'fornecedores', label: 'Fornecedores', color: '#0F766E', variant: 'info' },
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
          <div className="w-8 h-8 border-3 border-[#D92323] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-[#64748B]">Carregando painel operacional Haramaq...</p>
        </div>
      </div>
    )
  }

  const canCreate = ['admin', 'gestor', 'triagem', 'vendedor', 'revendedor'].includes(role)

  return (
    <PageContainer>
      {/*
        Hero Banner in the reference style:
        Dark textured banner (or contextual header) with module title, description and quick filter buttons
      */}
      <div className="bg-[#1E293B] text-white rounded-2xl p-5 sm:p-6 mb-6 shadow-sm border border-slate-700/60 relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#D92323]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="p-2 bg-[#D92323] rounded-lg text-white shadow-xs">
                <TrendingUp className="w-5 h-5" />
              </span>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white uppercase">
                Painel Geral de Leads e Operações
              </h1>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-white/10 text-white border border-white/20">
                HARAMAQ PRO
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Monitoramento em tempo real dos leads de produtores rurais, revendas e representantes,
              com foco em eficiência no manejo alimentar do rebanho.
            </p>
          </div>

          {canCreate && (
            <div className="flex items-center gap-2.5 flex-wrap shrink-0">
              <HaramaqButton
                variant="danger"
                size="md"
                icon={<PlusCircle className="w-4 h-4" />}
                onClick={() => navigate('/vendas?nova=true')}
              >
                Novo Lead
              </HaramaqButton>
              <button
                type="button"
                onClick={() => navigate('/clientes?novo=true')}
                className="inline-flex items-center gap-2 px-3.5 h-9 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-colors"
              >
                <Users className="w-4 h-4" />
                <span>Novo Cliente</span>
              </button>
            </div>
          )}
        </div>

        {/* Period Filter bar matching reference */}
        <div className="mt-5 pt-4 border-t border-slate-700/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-300 font-semibold uppercase tracking-wider text-[11px]">
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#D92323]" />
            <span>Filtrar Período:</span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { id: '7dias', label: 'Últimos 7 dias' },
              { id: '30dias', label: 'Últimos 30 dias' },
              { id: 'esteMes', label: 'Este mês' },
              { id: 'todos', label: 'Todo o Histórico' },
            ].map((p) => {
              const isActive = periodoFiltro === p.id
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPeriodoFiltro(p.id as typeof periodoFiltro)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-[#D92323] text-white shadow-xs font-bold'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/*
        KPI ROW (Matches Haramaq reference inspection cards):
        EM ANDAMENTO | CONCLUÍDAS | EM GARGALO | EM ESPERA | PENDÊNCIAS
      */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 mb-6">
        <MetricCard
          label="Vendas no Mês"
          value={formatCurrencyBRL(stats.totalVendasMes)}
          description="Faturamento consolidado em fechamento"
          variant="concluidas"
          icon={<DollarSign className="w-5 h-5 text-emerald-600" />}
          badge={
            <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
              <ArrowUpRight className="w-3 h-3" /> +14.2%
            </span>
          }
        />

        <MetricCard
          label="Clientes Ativos"
          value={stats.clientesAtivos}
          unit="cadastrados"
          description={`${clientes.length} contatos registrados no sistema`}
          variant="em_andamento"
          icon={<Users className="w-5 h-5 text-blue-600" />}
        />

        <MetricCard
          label="Revendas Autorizadas"
          value={stats.revendasAutorizadas}
          unit="ativas"
          description="Rede credenciada em operação"
          variant="em_espera"
          icon={<Building2 className="w-5 h-5 text-amber-600" />}
        />

        <MetricCard
          label="Tickets em Aberto"
          value={stats.ticketsAbertos}
          unit="chamados"
          description="Aguardando atendimento técnico"
          variant="gargalo"
          icon={<AlertTriangle className="w-5 h-5 text-red-600" />}
        />
      </div>

      {/*
        Funnel Pipeline Operational Section
      */}
      <div className="mb-6">
        <HaramaqCard
          title={
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#D92323]" />
              <span>Fluxo de Leads &mdash; Equipamentos para alimentação de bovinos</span>
            </div>
          }
          subtitle="Volume financeiro e oportunidades ativas por etapa do pipeline"
          headerActions={
            <Link
              to="/vendas"
              className="text-xs font-semibold text-[#D92323] hover:text-[#B91C1C] flex items-center gap-1"
            >
              Ver Kanban completo <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 mb-5">
            {funnelStages.map((stage, idx) => {
              const prevStage = idx > 0 ? funnelStages[idx - 1] : null
              const convRate =
                prevStage && prevStage.count > 0
                  ? Math.round((stage.count / prevStage.count) * 100)
                  : null

              return (
                <div
                  key={stage.key}
                  className="p-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] flex flex-col justify-between relative overflow-hidden"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#475569]">
                      {stage.label}
                    </span>
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: stage.color }}
                    />
                  </div>

                  <div className="my-1.5">
                    <div className="text-xl font-black text-[#1E293B] tabular-nums">
                      {stage.count}{' '}
                      <span className="text-xs font-medium text-[#64748B]">leads</span>
                    </div>
                    <div className="text-xs font-bold text-[#334155] mt-0.5">
                      {formatCurrencyBRL(stage.total)}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#E2E8F0] text-[11px] text-[#64748B] flex items-center justify-between mt-1">
                    <span>{convRate !== null ? 'Conversão:' : 'Início:'}</span>
                    <span className="font-bold text-[#1E293B]">
                      {convRate !== null ? `${convRate}%` : 'Entrada'}
                    </span>
                  </div>

                  {/* Accent stripe */}
                  <div
                    className="absolute bottom-0 left-0 right-0 h-1"
                    style={{ backgroundColor: stage.color }}
                  />
                </div>
              )
            })}
          </div>

          {/* Progress bar visual distribution */}
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-xs text-[#64748B] font-medium">
              <span>Distribuição do Volume no Pipeline</span>
              <span>
                Total no fluxo:{' '}
                <strong className="text-[#1E293B]">
                  {formatCurrencyBRL(vendas.reduce((acc, v) => acc + (v.valor || 0), 0))}
                </strong>
              </span>
            </div>
            <div className="h-3 w-full bg-[#E2E8F0] rounded-full flex overflow-hidden p-0.5 gap-0.5">
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
                    title={`${stage.label}: ${stage.count} leads (${formatCurrencyBRL(stage.total)})`}
                    className="h-full rounded-full transition-all"
                  />
                )
              })}
            </div>
          </div>
        </HaramaqCard>
      </div>

      {/*
        Two Columns Grid: Recent Clientes & Recent Support Tickets
      */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent Clientes */}
        <HaramaqCard
          title="Clientes Recentes"
          subtitle="Últimos cadastros de produtores, revendas e representantes"
          headerActions={
            <Link
              to="/clientes"
              className="text-xs font-semibold text-[#D92323] hover:text-[#B91C1C] flex items-center gap-1"
            >
              Ver todos <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          }
          noPadding={true}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-2.5 px-4">Nome / Empresa</th>
                  <th className="py-2.5 px-4">Cidade / UF</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {recentClientes.map((c) => (
                  <tr key={c.id} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="py-3 px-4">
                      <p className="font-bold text-[#1E293B]">{c.empresa || c.nome}</p>
                      <p className="text-[11px] text-[#64748B]">{c.nome}</p>
                    </td>
                    <td className="py-3 px-4 text-[#475569]">
                      {c.cidade ? `${c.cidade} - ${c.estado || ''}` : '-'}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge
                        variant={c.status === 'ativo' ? 'success' : 'neutral'}
                        dot={true}
                      >
                        {c.status === 'ativo' ? 'Ativo' : 'Inativo'}
                      </StatusBadge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        to={`/clientes/${c.id}`}
                        className="font-semibold text-[#D92323] hover:text-[#991B1B] transition-colors text-xs"
                      >
                        Ver detalhes
                      </Link>
                    </td>
                  </tr>
                ))}
                {recentClientes.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-[#94A3B8]">
                      Nenhum cliente cadastrado ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </HaramaqCard>

        {/* Recent Tickets */}
        <HaramaqCard
          title="Chamados de Suporte e Pós-Venda"
          subtitle="Atendimentos técnicos e reposição de peças"
          headerActions={
            <Link
              to="/suporte"
              className="text-xs font-semibold text-[#D92323] hover:text-[#B91C1C] flex items-center gap-1"
            >
              Ver suporte <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          }
        >
          <div className="space-y-3">
            {recentTickets.map((t) => {
              const isAberto = t.status === 'aberto'
              const prioVariant =
                t.prioridade === 'alta'
                  ? 'danger'
                  : t.prioridade === 'media'
                    ? 'warning'
                    : 'success'

              return (
                <div
                  key={t.id}
                  onClick={() => navigate('/suporte')}
                  className="p-3.5 rounded-xl border border-[#E2E8F0] hover:border-[#D92323]/40 bg-white hover:bg-[#F8FAFC] cursor-pointer transition-all flex items-start justify-between gap-3 shadow-2xs"
                >
                  <div className="space-y-1 min-w-0">
                    <p className="font-bold text-xs text-[#1E293B] truncate">{t.assunto}</p>
                    <p className="text-[11px] text-[#64748B]">
                      Cliente:{' '}
                      <span className="font-semibold text-[#334155]">
                        {t.expand?.cliente?.empresa || t.expand?.cliente?.nome || 'Cliente'}
                      </span>
                    </p>
                    <p className="text-[10px] text-[#94A3B8]">
                      Registrado em {formatDateBR(t.created)}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <StatusBadge variant={prioVariant} size="sm">
                      Prioridade {t.prioridade}
                    </StatusBadge>
                    <StatusBadge variant={isAberto ? 'danger' : 'success'} dot={true} size="sm">
                      {isAberto ? 'Aberto' : 'Finalizado'}
                    </StatusBadge>
                  </div>
                </div>
              )
            })}
            {recentTickets.length === 0 && (
              <p className="py-6 text-center text-xs text-[#94A3B8]">
                Nenhum chamado de suporte registrado.
              </p>
            )}
          </div>
        </HaramaqCard>
      </div>
    </PageContainer>
  )
}
