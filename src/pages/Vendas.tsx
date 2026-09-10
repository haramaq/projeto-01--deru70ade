import React, { useState, useEffect, useMemo, useTransition } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Plus,
  Search,
  Filter,
  DollarSign,
  Calendar,
  Clock,
  ArrowRight,
  TrendingUp,
  X,
  Edit2,
  Trash2,
  CheckCircle2,
} from 'lucide-react'
import { vendaService, clienteService, userService } from '@/services/crmService'
import type { Venda, VendaEtapa, Cliente, User, ProdutoModelo } from '@/types/crm'
import { formatCurrencyBRL, formatDateBR } from '@/lib/formatters'
import useRealtime from '@/hooks/use-realtime'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const ETAPAS: { key: VendaEtapa; label: string; borderTop: string; color: string }[] = [
  { key: 'prospeccao', label: 'Prospecção', borderTop: 'border-t-[#40916C]', color: '#40916C' },
  { key: 'orcamento', label: 'Orçamento', borderTop: 'border-t-[#2D6A4F]', color: '#2D6A4F' },
  { key: 'negociacao', label: 'Negociação', borderTop: 'border-t-[#F59E0B]', color: '#F59E0B' },
  { key: 'fechamento', label: 'Fechamento', borderTop: 'border-t-[#DC2626]', color: '#DC2626' },
  {
    key: 'pecas_pos_vendas',
    label: 'Peças e Pós-vendas',
    borderTop: 'border-t-[#7C3AED]',
    color: '#7C3AED',
  },
  {
    key: 'financeiro_fiscal',
    label: 'Financeiro e Fiscal',
    borderTop: 'border-t-[#0369A1]',
    color: '#0369A1',
  },
]

export default function Vendas() {
  const { user, role } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [, startTransition] = useTransition()

  const [vendas, setVendas] = useState<Venda[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [vendedores, setVendedores] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProduto, setSelectedProduto] = useState<string>('todos')
  const [selectedVendedor, setSelectedVendedor] = useState<string>('todos')

  // Modals
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [activeDeal, setActiveDeal] = useState<Venda | null>(null)
  const [proximaAcaoInput, setProximaAcaoInput] = useState('')
  const [savingAction, setSavingAction] = useState(false)

  // Create Modal
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [newCliente, setNewCliente] = useState('')
  const [newProduto, setNewProduto] = useState<ProdutoModelo>('PROHMIX')
  const [newValor, setNewValor] = useState<string>('350000')
  const [newEtapa, setNewEtapa] = useState<VendaEtapa>('prospeccao')
  const [newProbabilidade, setNewProbabilidade] = useState<number>(30)
  const [newDataFechamento, setNewDataFechamento] = useState<string>('')
  const [newProximaAcao, setNewProximaAcao] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Drag state
  const [draggedVendaId, setDraggedVendaId] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<VendaEtapa | null>(null)

  const loadData = async () => {
    try {
      const [vList, cList, uList] = await Promise.all([
        vendaService.getAll(),
        clienteService.getAll(),
        userService.getAll(),
      ])
      setVendas(vList)
      setClientes(cList)
      setVendedores(uList)
    } catch (err) {
      console.error(err)
      toast.error('Erro ao carregar dados do funil de vendas.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Check query params for "nova=true"
  useEffect(() => {
    if (searchParams.get('nova') === 'true') {
      setCreateModalOpen(true)
      const cId = searchParams.get('clienteId')
      if (cId) setNewCliente(cId)
      // clear query
      searchParams.delete('nova')
      searchParams.delete('clienteId')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

  // Realtime
  useRealtime('vendas', () => {
    vendaService
      .getAll()
      .then(setVendas)
      .catch(() => {})
  })

  // Filtered Deals
  const filteredDeals = useMemo(() => {
    return vendas.filter((v) => {
      // search
      const cName = v.expand?.cliente?.nome || ''
      const cEmpresa = v.expand?.cliente?.empresa || ''
      const matchesSearch =
        cName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cEmpresa.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.produto.toLowerCase().includes(searchTerm.toLowerCase())

      // produto
      const matchesProduto = selectedProduto === 'todos' || v.produto === selectedProduto

      // vendedor
      const matchesVendedor = selectedVendedor === 'todos' || v.vendedor === selectedVendedor

      return matchesSearch && matchesProduto && matchesVendedor
    })
  }, [vendas, searchTerm, selectedProduto, selectedVendedor])

  // Group by stage and sort descending by value
  const dealsByStage = useMemo(() => {
    const map: Record<VendaEtapa, Venda[]> = {
      prospeccao: [],
      orcamento: [],
      negociacao: [],
      fechamento: [],
      pecas_pos_vendas: [],
      financeiro_fiscal: [],
    }

    filteredDeals.forEach((d) => {
      if (map[d.etapa]) {
        map[d.etapa].push(d)
      }
    })

    // Sort descending by value
    Object.keys(map).forEach((key) => {
      map[key as VendaEtapa].sort((a, b) => (b.valor || 0) - (a.valor || 0))
    })

    return map
  }, [filteredDeals])

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id)
    setDraggedVendaId(id)
  }

  const handleDragOver = (e: React.DragEvent, etapa: VendaEtapa) => {
    e.preventDefault()
    setDragOverCol(etapa)
  }

  const handleDragLeave = () => {
    setDragOverCol(null)
  }

  const handleDrop = async (e: React.DragEvent, targetEtapa: VendaEtapa) => {
    e.preventDefault()
    setDragOverCol(null)
    const id = e.dataTransfer.getData('text/plain') || draggedVendaId
    if (!id) return

    const targetVenda = vendas.find((v) => v.id === id)
    if (!targetVenda || targetVenda.etapa === targetEtapa) return

    // Optimistic UI update
    setVendas((prev) => prev.map((v) => (v.id === id ? { ...v, etapa: targetEtapa } : v)))

    try {
      const etapaLabel = ETAPAS.find((et) => et.key === targetEtapa)?.label
      await vendaService.updateEtapa(id, targetEtapa)
      toast.success(`Negócio movido para ${etapaLabel}`)
    } catch (err) {
      console.error(err)
      toast.error('Erro ao atualizar etapa no banco de dados.')
      // Revert
      loadData()
    } finally {
      setDraggedVendaId(null)
    }
  }

  // Handle open deal detail
  const handleOpenDetail = (deal: Venda) => {
    setActiveDeal(deal)
    setProximaAcaoInput(deal.proxima_acao || '')
    setDetailModalOpen(true)
  }

  // Handle save Next Action
  const handleSaveNextAction = async () => {
    if (!activeDeal) return
    setSavingAction(true)
    try {
      const updated = await vendaService.update(activeDeal.id, {
        proxima_acao: proximaAcaoInput,
      })
      setActiveDeal(updated)
      setVendas((prev) => prev.map((v) => (v.id === updated.id ? updated : v)))
      toast.success('Próxima ação atualizada!')
    } catch {
      toast.error('Erro ao salvar próxima ação.')
    } finally {
      setSavingAction(false)
    }
  }

  // Handle create deal
  const handleCreateDeal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCliente) {
      toast.error('Selecione um cliente para a venda.')
      return
    }

    setIsSubmitting(true)
    try {
      const created = await vendaService.create({
        cliente: newCliente,
        produto: newProduto,
        valor: parseFloat(newValor) || 0,
        etapa: newEtapa,
        probabilidade: Number(newProbabilidade),
        data_prevista_fechamento: newDataFechamento || undefined,
        vendedor: user?.id,
        proxima_acao: newProximaAcao,
      })

      startTransition(() => {
        setVendas((prev) => [created, ...prev])
      })
      toast.success('Negócio criado com sucesso!')
      setCreateModalOpen(false)
      // Reset form
      setNewCliente('')
      setNewValor('350000')
      setNewProximaAcao('')
    } catch (err) {
      console.error(err)
      toast.error('Erro ao registrar novo negócio.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteDeal = async (id: string) => {
    if (!confirm('Deseja realmente remover esta oportunidade de venda?')) return
    try {
      await vendaService.delete(id)
      setVendas((prev) => prev.filter((v) => v.id !== id))
      setDetailModalOpen(false)
      toast.success('Negócio excluído com sucesso.')
    } catch {
      toast.error('Erro ao excluir negócio.')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-4 border-[#1B4332] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-gray-500">Carregando funil de vendas...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1B4332] tracking-tight">
            Funil de Vendas Haramaq
          </h1>
          <p className="text-xs text-gray-500">
            Pipeline operacional de vagões misturadores PROHMIX e SUPERMIX
          </p>
        </div>

        <Button
          onClick={() => setCreateModalOpen(true)}
          className="bg-[#DC2626] hover:bg-[#b91c1c] text-white font-semibold rounded-xl gap-2 shadow-sm transition-transform hover:scale-[1.02] self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          Nova Venda
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-[16px] border border-[#E5E7EB] shadow-xs flex flex-col md:flex-row items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Buscar por cliente, empresa ou modelo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-10 rounded-xl border-gray-200 text-xs"
          />
        </div>

        {/* Produto Filter */}
        <div className="w-full md:w-48">
          <Select value={selectedProduto} onValueChange={setSelectedProduto}>
            <SelectTrigger className="h-10 rounded-xl border-gray-200 text-xs">
              <SelectValue placeholder="Produto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Produtos</SelectItem>
              <SelectItem value="PROHMIX">PROHMIX</SelectItem>
              <SelectItem value="SUPERMIX">SUPERMIX</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Vendedor Filter */}
        <div className="w-full md:w-56">
          <Select value={selectedVendedor} onValueChange={setSelectedVendedor}>
            <SelectTrigger className="h-10 rounded-xl border-gray-200 text-xs">
              <SelectValue placeholder="Vendedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Vendedores</SelectItem>
              {vendedores.map((vnd) => (
                <SelectItem key={vnd.id} value={vnd.id}>
                  {vnd.name || vnd.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {(searchTerm || selectedProduto !== 'todos' || selectedVendedor !== 'todos') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchTerm('')
              setSelectedProduto('todos')
              setSelectedVendedor('todos')
            }}
            className="text-xs text-gray-500 hover:text-red-600 gap-1"
          >
            <X className="w-3.5 h-3.5" />
            Limpar
          </Button>
        )}
      </div>

      {/* Kanban Board — etapas compatíveis com o fluxo configurável do Altforce */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 overflow-x-auto pb-4">
        {ETAPAS.map((col) => {
          const deals = dealsByStage[col.key] || []
          const totalVal = deals.reduce((acc, d) => acc + (d.valor || 0), 0)
          const isOver = dragOverCol === col.key

          return (
            <div
              key={col.key}
              onDragOver={(e) => handleDragOver(e, col.key)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.key)}
              className={cn(
                'bg-gray-50/80 rounded-[16px] border-2 border-dashed border-transparent p-3 flex flex-col min-h-[580px] transition-colors',
                isOver && 'border-emerald-500 bg-emerald-50/40',
              )}
            >
              {/* Column Header with specific top border color */}
              <div
                className={cn(
                  'bg-white rounded-xl p-3.5 border border-[#E5E7EB] border-t-4 mb-3 shadow-2xs flex items-center justify-between',
                  col.borderTop,
                )}
              >
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800">
                    {col.label}
                  </h3>
                  <p className="text-[11px] font-semibold text-gray-500 mt-0.5">
                    {formatCurrencyBRL(totalVal)}
                  </p>
                </div>
                <Badge
                  variant="secondary"
                  className="bg-gray-100 text-gray-800 text-xs font-bold rounded-lg px-2"
                >
                  {deals.length}
                </Badge>
              </div>

              {/* Cards Container */}
              <div className="space-y-3 flex-1">
                {deals.map((deal) => {
                  const clienteName =
                    deal.expand?.cliente?.empresa || deal.expand?.cliente?.nome || 'Cliente'
                  const vendedorName =
                    deal.expand?.vendedor?.name || deal.expand?.vendedor?.email || 'Vendedor'

                  return (
                    <div
                      key={deal.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, deal.id)}
                      onClick={() => handleOpenDetail(deal)}
                      className={cn(
                        'bg-white rounded-xl p-4 border border-[#E5E7EB] shadow-xs hover:border-[#1B4332]/40 hover:shadow-md cursor-grab active:cursor-grabbing transition-all duration-200 transform',
                        draggedVendaId === deal.id ? 'opacity-40 scale-95' : 'hover:-translate-y-1',
                      )}
                    >
                      {/* Top row: Client name & product badge */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="font-bold text-xs text-gray-900 line-clamp-1">
                          {clienteName}
                        </span>
                        <Badge
                          variant="secondary"
                          className={cn(
                            'text-[10px] font-extrabold uppercase px-1.5 py-0',
                            deal.produto === 'SUPERMIX'
                              ? 'bg-red-50 text-[#DC2626] border border-red-200'
                              : 'bg-emerald-50 text-[#1B4332] border border-emerald-200',
                          )}
                        >
                          {deal.produto}
                        </Badge>
                      </div>

                      {/* Value (R$) & Probability */}
                      <div className="flex items-baseline justify-between mb-3">
                        <div className="text-base font-extrabold text-gray-900 tabular-nums">
                          {formatCurrencyBRL(deal.valor)}
                        </div>
                        <span className="text-[11px] font-semibold text-gray-500">
                          {deal.probabilidade}% prob.
                        </span>
                      </div>

                      {/* Next Action preview */}
                      {deal.proxima_acao && (
                        <div className="p-2 rounded-lg bg-[#F8FAF9] text-[11px] text-gray-600 border border-gray-100 mb-3 line-clamp-2">
                          <strong className="text-gray-800">Próx:</strong> {deal.proxima_acao}
                        </div>
                      )}

                      {/* Bottom Footer: Date & Assigned salesperson */}
                      <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-[10px] text-gray-400">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDateBR(deal.data_prevista_fechamento || deal.created)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-[#1B4332] text-white flex items-center justify-center font-bold text-[9px]">
                            {vendedorName.charAt(0).toUpperCase()}
                          </div>
                          <span className="truncate max-w-[70px] text-gray-600 font-medium">
                            {vendedorName.split(' ')[0]}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}

                {deals.length === 0 && (
                  <div className="h-28 border border-dashed border-gray-200 rounded-xl flex items-center justify-center text-xs text-gray-400">
                    Nenhum negócio nesta etapa
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Deal Detail Modal */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="max-w-xl rounded-2xl">
          <DialogHeader>
            <div className="flex items-center justify-between pr-4">
              <DialogTitle className="text-lg font-bold text-[#1B4332]">
                Detalhes do Negócio
              </DialogTitle>
              <Badge
                variant="outline"
                className={cn(
                  'text-xs font-bold uppercase',
                  activeDeal?.produto === 'SUPERMIX'
                    ? 'border-red-300 text-red-700 bg-red-50'
                    : 'border-emerald-300 text-emerald-800 bg-emerald-50',
                )}
              >
                {activeDeal?.produto}
              </Badge>
            </div>
          </DialogHeader>

          {activeDeal && (
            <div className="space-y-4 pt-2 text-xs">
              {/* Client & Values info */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Cliente / Empresa
                    </span>
                    <p className="text-sm font-bold text-gray-900">
                      {activeDeal.expand?.cliente?.empresa || activeDeal.expand?.cliente?.nome}
                    </p>
                    <p className="text-gray-500">{activeDeal.expand?.cliente?.nome}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Valor Proposto
                    </span>
                    <p className="text-lg font-black text-gray-900">
                      {formatCurrencyBRL(activeDeal.valor)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-200/60">
                  <div>
                    <span className="text-[10px] text-gray-400 font-semibold">Etapa Atual</span>
                    <p className="font-bold text-gray-800 capitalize">{activeDeal.etapa}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 font-semibold">Probabilidade</span>
                    <p className="font-bold text-gray-800">{activeDeal.probabilidade}%</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 font-semibold">
                      Previsão Fechamento
                    </span>
                    <p className="font-bold text-gray-800">
                      {formatDateBR(activeDeal.data_prevista_fechamento)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Editable "Próxima Ação" */}
              <div className="space-y-2">
                <Label
                  htmlFor="nextAction"
                  className="font-bold text-gray-700 flex items-center justify-between"
                >
                  <span>Próxima Ação Comercial</span>
                  <span className="text-[11px] font-normal text-gray-400">
                    O que precisa ser feito para avançar a venda
                  </span>
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="nextAction"
                    value={proximaAcaoInput}
                    onChange={(e) => setProximaAcaoInput(e.target.value)}
                    placeholder="Ex: Agendar demonstração técnica na fábrica ou alinhar FINAME..."
                    className="h-10 text-xs rounded-xl"
                  />
                  <Button
                    onClick={handleSaveNextAction}
                    disabled={savingAction}
                    className="bg-[#1B4332] hover:bg-[#2D6A4F] text-white text-xs rounded-xl px-4 shrink-0"
                  >
                    {savingAction ? 'Salvando...' : 'Atualizar'}
                  </Button>
                </div>
              </div>

              {/* Stage Progress Timeline */}
              <div className="pt-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2 block">
                  Linha do Tempo das Etapas
                </span>
                <div className="flex items-center justify-between relative overflow-x-auto pb-2">
                  {' '}
                  <div className="absolute left-2 right-2 top-3 h-0.5 bg-gray-200 -z-0" />
                  {ETAPAS.map((st, i) => {
                    const currentIdx = ETAPAS.findIndex((e) => e.key === activeDeal.etapa)
                    const isPassed = i <= currentIdx
                    const isCurrent = i === currentIdx

                    return (
                      <div
                        key={st.key}
                        onClick={async () => {
                          const updated = await vendaService.updateEtapa(activeDeal.id, st.key)
                          setActiveDeal(updated)
                          setVendas((prev) => prev.map((v) => (v.id === updated.id ? updated : v)))
                          toast.success(`Etapa alterada para ${st.label}`)
                        }}
                        className="flex flex-col items-center gap-1 z-10 cursor-pointer group"
                      >
                        <div
                          className={cn(
                            'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-transform group-hover:scale-110',
                            isPassed
                              ? 'bg-[#1B4332] border-[#1B4332] text-white'
                              : 'bg-white border-gray-300 text-gray-400',
                            isCurrent && 'ring-2 ring-red-500',
                          )}
                        >
                          {i + 1}
                        </div>
                        <span
                          className={cn(
                            'text-[10px] font-semibold',
                            isPassed ? 'text-gray-900' : 'text-gray-400',
                          )}
                        >
                          {st.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
            {activeDeal && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteDeal(activeDeal.id)}
                className="text-xs text-red-600 hover:bg-red-50 hover:text-red-700 gap-1 rounded-xl"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Excluir Negócio
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDetailModalOpen(false)}
              className="text-xs rounded-xl"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Deal Creation Modal */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#1B4332]">
              Nova Oportunidade de Venda
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateDeal} className="space-y-4 pt-2 text-xs">
            <div className="space-y-1.5">
              <Label htmlFor="clienteSelect" className="font-semibold text-gray-700">
                Cliente / Construtora / Usina *
              </Label>
              <Select value={newCliente} onValueChange={setNewCliente} required>
                <SelectTrigger id="clienteSelect" className="h-10 rounded-xl text-xs">
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.empresa ? `${c.empresa} (${c.nome})` : c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="produtoSelect" className="font-semibold text-gray-700">
                  Modelo do Misturador *
                </Label>
                <Select
                  value={newProduto}
                  onValueChange={(val) => setNewProduto(val as ProdutoModelo)}
                >
                  <SelectTrigger id="produtoSelect" className="h-10 rounded-xl text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PROHMIX">PROHMIX (Compacto / Médio)</SelectItem>
                    <SelectItem value="SUPERMIX">SUPERMIX (Pesado / Grande Porte)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="valorInput" className="font-semibold text-gray-700">
                  Valor Negociado (R$) *
                </Label>
                <Input
                  id="valorInput"
                  type="number"
                  step="1000"
                  value={newValor}
                  onChange={(e) => setNewValor(e.target.value)}
                  placeholder="350000"
                  required
                  className="h-10 rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="etapaSelect" className="font-semibold text-gray-700">
                  Etapa Inicial
                </Label>
                <Select value={newEtapa} onValueChange={(val) => setNewEtapa(val as VendaEtapa)}>
                  <SelectTrigger id="etapaSelect" className="h-10 rounded-xl text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prospeccao">Prospecção</SelectItem>
                    <SelectItem value="orcamento">Orçamento</SelectItem>
                    <SelectItem value="negociacao">Negociação</SelectItem>
                    <SelectItem value="fechamento">Fechamento</SelectItem>
                    <SelectItem value="pecas_pos_vendas">Peças e Pós-vendas</SelectItem>
                    <SelectItem value="financeiro_fiscal">Financeiro e Fiscal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="probInput" className="font-semibold text-gray-700">
                  Probabilidade (%)
                </Label>
                <Input
                  id="probInput"
                  type="number"
                  min={0}
                  max={100}
                  value={newProbabilidade}
                  onChange={(e) => setNewProbabilidade(Number(e.target.value))}
                  className="h-10 rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dataPrevista" className="font-semibold text-gray-700">
                Previsão de Fechamento
              </Label>
              <Input
                id="dataPrevista"
                type="date"
                value={newDataFechamento}
                onChange={(e) => setNewDataFechamento(e.target.value)}
                className="h-10 rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="proximaAcao" className="font-semibold text-gray-700">
                Próxima Ação
              </Label>
              <Input
                id="proximaAcao"
                value={newProximaAcao}
                onChange={(e) => setNewProximaAcao(e.target.value)}
                placeholder="Ex: Enviar proposta comercial técnica com prazo de garantia..."
                className="h-10 rounded-xl text-xs"
              />
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateModalOpen(false)}
                className="rounded-xl text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-[#DC2626] hover:bg-[#b91c1c] text-white rounded-xl text-xs font-semibold px-5"
              >
                {isSubmitting ? 'Salvando...' : 'Salvar Negócio'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
