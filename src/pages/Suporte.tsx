import React, { useState, useEffect, useMemo } from 'react'
import {
  Plus,
  Search,
  Headphones,
  CheckCircle,
  Clock,
  MessageSquare,
  Send,
  User,
  Calendar,
  AlertTriangle,
  RotateCcw,
  X,
} from 'lucide-react'
import { ticketService, clienteService } from '@/services/crmService'
import type { Ticket, TicketPrioridade, TicketStatus, Cliente } from '@/types/crm'
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

export default function Suporte() {
  const { user } = useAuth()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // New ticket modal
  const [newModalOpen, setNewModalOpen] = useState(false)
  const [newCliente, setNewCliente] = useState('')
  const [newAssunto, setNewAssunto] = useState('')
  const [newPrioridade, setNewPrioridade] = useState<TicketPrioridade>('media')
  const [newDescricao, setNewDescricao] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Detail & Comments modal
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null)
  const [respostaTexto, setRespostaTexto] = useState('')
  const [sendingResposta, setSendingResposta] = useState(false)

  const loadData = async () => {
    try {
      const [tList, cList] = await Promise.all([ticketService.getAll(), clienteService.getAll()])
      setTickets(tList)
      setClientes(cList)
    } catch {
      toast.error('Erro ao carregar tickets de suporte.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Realtime subscription for instant sync
  useRealtime('tickets', () => {
    ticketService
      .getAll()
      .then((list) => {
        setTickets(list)
        // Update active ticket if opened
        if (activeTicket) {
          const updated = list.find((t) => t.id === activeTicket.id)
          if (updated) setActiveTicket(updated)
        }
      })
      .catch(() => {})
  })

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    if (!searchTerm.trim()) return tickets
    const q = searchTerm.toLowerCase().trim()
    return tickets.filter((t) => {
      const clienteName = t.expand?.cliente?.nome || ''
      const empresa = t.expand?.cliente?.empresa || ''
      return (
        t.assunto.toLowerCase().includes(q) ||
        (t.descricao && t.descricao.toLowerCase().includes(q)) ||
        clienteName.toLowerCase().includes(q) ||
        empresa.toLowerCase().includes(q)
      )
    })
  }, [tickets, searchTerm])

  const openTickets = filteredTickets.filter((t) => t.status === 'aberto')
  const closedTickets = filteredTickets.filter(
    (t) => t.status === 'finalizado' || t.status === 'fechado',
  )

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCliente) {
      toast.error('Selecione um cliente para vincular o ticket.')
      return
    }
    if (!newAssunto.trim()) {
      toast.error('O assunto do ticket é obrigatório.')
      return
    }

    setIsSubmitting(true)
    try {
      const created = await ticketService.create({
        cliente: newCliente,
        assunto: newAssunto.trim(),
        descricao: newDescricao.trim(),
        prioridade: newPrioridade,
        status: 'aberto',
        atribuido_a: user?.id,
      })

      setTickets((prev) => [created, ...prev])
      toast.success('Ticket aberto com sucesso!')
      setNewModalOpen(false)
      setNewCliente('')
      setNewAssunto('')
      setNewDescricao('')
      setNewPrioridade('media')
    } catch {
      toast.error('Erro ao registrar chamado de suporte.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenDetail = (t: Ticket) => {
    setActiveTicket(t)
    setRespostaTexto('')
    setDetailModalOpen(true)
  }

  const handleToggleStatus = async (ticket: Ticket) => {
    try {
      const updated = await ticketService.toggleStatus(ticket.id, ticket.status)
      setActiveTicket(updated)
      setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
      toast.success(
        updated.status === 'finalizado'
          ? 'Ticket marcado como finalizado!'
          : 'Ticket reaberto com sucesso!',
      )
    } catch {
      toast.error('Erro ao atualizar status do ticket.')
    }
  }

  const handleSendResposta = async () => {
    if (!activeTicket || !respostaTexto.trim()) return

    setSendingResposta(true)
    try {
      const novaResposta = {
        autor: user?.name || 'Agente Haramaq',
        data: new Date().toISOString(),
        mensagem: respostaTexto.trim(),
      }

      const updated = await ticketService.addResposta(activeTicket.id, novaResposta)
      setActiveTicket(updated)
      setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
      setRespostaTexto('')
      toast.success('Resposta adicionada ao chamado.')
    } catch {
      toast.error('Erro ao salvar resposta no chamado.')
    } finally {
      setSendingResposta(false)
    }
  }

  const priorityBadge = (p: TicketPrioridade) => {
    if (p === 'alta') {
      return (
        <Badge
          variant="outline"
          className="border-red-300 bg-red-50 text-red-700 text-[10px] font-bold uppercase"
        >
          Alta
        </Badge>
      )
    }
    if (p === 'media') {
      return (
        <Badge
          variant="outline"
          className="border-amber-300 bg-amber-50 text-amber-700 text-[10px] font-bold uppercase"
        >
          Média
        </Badge>
      )
    }
    return (
      <Badge
        variant="outline"
        className="border-emerald-300 bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase"
      >
        Baixa
      </Badge>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-4 border-[#1B4332] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-gray-500">Carregando painel de suporte...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1B4332] tracking-tight">
            Central de Suporte e Pós-Venda
          </h1>
          <p className="text-xs text-gray-500">
            Acompanhamento técnico em tempo real para frotas de misturadores Haramaq
          </p>
        </div>

        <Button
          onClick={() => setNewModalOpen(true)}
          className="bg-[#DC2626] hover:bg-[#b91c1c] text-white font-semibold rounded-xl gap-2 shadow-sm transition-transform hover:scale-[1.02] self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Novo Ticket
        </Button>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-[16px] border border-[#E5E7EB] shadow-xs flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Pesquisar por assunto, cliente ou descrição do chamado..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-10 rounded-xl border-gray-200 text-xs"
          />
        </div>
        {searchTerm && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSearchTerm('')}
            className="text-xs text-gray-500 hover:text-red-600 gap-1"
          >
            <X className="w-3.5 h-3.5" />
            Limpar
          </Button>
        )}
      </div>

      {/* Ticket Board: Two Columns (Abertos / Finalizados) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Abertos */}
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-red-50/80 p-3.5 rounded-xl border border-red-100">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#DC2626]" />
              <h2 className="font-bold text-sm text-[#DC2626] uppercase tracking-wider">
                Chamados em Aberto
              </h2>
            </div>
            <Badge className="bg-[#DC2626] text-white font-bold text-xs px-2.5">
              {openTickets.length}
            </Badge>
          </div>

          <div className="space-y-3 min-h-[400px]">
            {openTickets.map((ticket) => {
              const clienteName =
                ticket.expand?.cliente?.empresa || ticket.expand?.cliente?.nome || 'Cliente'
              const agentName =
                ticket.expand?.atribuido_a?.name ||
                ticket.expand?.atribuido_a?.email ||
                'Suporte Haramaq'

              return (
                <div
                  key={ticket.id}
                  onClick={() => handleOpenDetail(ticket)}
                  className="bg-white rounded-xl p-4 border border-[#E5E7EB] hover:border-red-200 hover:shadow-md cursor-pointer transition-all duration-200 space-y-2.5 transform hover:-translate-y-0.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-xs text-gray-900 line-clamp-2">
                      {ticket.assunto}
                    </h3>
                    {priorityBadge(ticket.prioridade)}
                  </div>

                  <p className="text-xs text-gray-600 line-clamp-2">
                    {ticket.descricao || 'Sem descrição informada.'}
                  </p>

                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
                    <div>
                      <span className="font-semibold text-gray-800">{clienteName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-400">
                        {formatDateBR(ticket.created)}
                      </span>
                      {ticket.respostas && ticket.respostas.length > 0 && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded-md">
                          <MessageSquare className="w-3 h-3 text-gray-500" />
                          {ticket.respostas.length}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}

            {openTickets.length === 0 && (
              <div className="h-40 border border-dashed border-gray-200 rounded-xl flex items-center justify-center text-xs text-gray-400">
                Nenhum chamado aberto pendente no momento.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Finalizados */}
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-emerald-50/80 p-3.5 rounded-xl border border-emerald-100">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#2D6A4F]" />
              <h2 className="font-bold text-sm text-[#2D6A4F] uppercase tracking-wider">
                Chamados Finalizados
              </h2>
            </div>
            <Badge className="bg-[#2D6A4F] text-white font-bold text-xs px-2.5">
              {closedTickets.length}
            </Badge>
          </div>

          <div className="space-y-3 min-h-[400px]">
            {closedTickets.map((ticket) => {
              const clienteName =
                ticket.expand?.cliente?.empresa || ticket.expand?.cliente?.nome || 'Cliente'

              return (
                <div
                  key={ticket.id}
                  onClick={() => handleOpenDetail(ticket)}
                  className="bg-white/90 rounded-xl p-4 border border-[#E5E7EB] hover:border-emerald-200 hover:shadow-md cursor-pointer transition-all duration-200 space-y-2.5 opacity-90 hover:opacity-100 transform hover:-translate-y-0.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-xs text-gray-900 line-clamp-2">
                      {ticket.assunto}
                    </h3>
                    <Badge
                      variant="secondary"
                      className="bg-emerald-100 text-emerald-800 text-[10px] font-semibold"
                    >
                      Finalizado
                    </Badge>
                  </div>

                  <p className="text-xs text-gray-500 line-clamp-2">
                    {ticket.descricao || 'Sem descrição.'}
                  </p>

                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
                    <span className="font-medium text-gray-700">{clienteName}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-400">
                        {formatDateBR(ticket.created)}
                      </span>
                      {ticket.respostas && ticket.respostas.length > 0 && (
                        <span className="flex items-center gap-1 text-[10px] text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded-md">
                          <MessageSquare className="w-3 h-3 text-gray-500" />
                          {ticket.respostas.length}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}

            {closedTickets.length === 0 && (
              <div className="h-40 border border-dashed border-gray-200 rounded-xl flex items-center justify-center text-xs text-gray-400">
                Nenhum chamado finalizado arquivado.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Ticket Detail & Thread Modal */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="max-w-2xl rounded-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-start justify-between gap-3 pr-4">
              <div className="space-y-1">
                <DialogTitle className="text-base font-bold text-[#1B4332]">
                  {activeTicket?.assunto}
                </DialogTitle>
                <p className="text-xs text-gray-500">
                  Cliente:{' '}
                  <strong className="text-gray-800">
                    {activeTicket?.expand?.cliente?.empresa ||
                      activeTicket?.expand?.cliente?.nome ||
                      'Cliente'}
                  </strong>{' '}
                  &bull; Aberto em {formatDateBR(activeTicket?.created)}
                </p>
              </div>

              {activeTicket && (
                <div className="flex items-center gap-2">
                  {priorityBadge(activeTicket.prioridade)}
                  <Button
                    size="sm"
                    variant={activeTicket.status === 'aberto' ? 'default' : 'outline'}
                    onClick={() => handleToggleStatus(activeTicket)}
                    className={cn(
                      'text-xs font-semibold rounded-xl h-8 px-3',
                      activeTicket.status === 'aberto'
                        ? 'bg-[#2D6A4F] hover:bg-[#1B4332] text-white'
                        : 'border-[#DC2626] text-[#DC2626] hover:bg-red-50',
                    )}
                  >
                    {activeTicket.status === 'aberto' ? (
                      <>
                        <CheckCircle className="w-3.5 h-3.5 mr-1" />
                        Finalizar Chamado
                      </>
                    ) : (
                      <>
                        <RotateCcw className="w-3.5 h-3.5 mr-1" />
                        Reabrir Chamado
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>

          {activeTicket && (
            <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1 text-xs">
              {/* Problem Description Box */}
              <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Descrição do Problema / Solicitação
                </span>
                <p className="text-gray-800 leading-relaxed whitespace-pre-line">
                  {activeTicket.descricao || 'Nenhuma descrição detalhada informada.'}
                </p>
              </div>

              {/* Comments / Replies Thread */}
              <div className="space-y-3 pt-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-600 block">
                  Histórico de Atendimento e Respostas ({activeTicket.respostas?.length || 0})
                </span>

                <div className="space-y-2.5">
                  {(activeTicket.respostas || []).map((resp, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl bg-[#F8FAF9] border border-gray-200/80 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-900 text-xs">{resp.autor}</span>
                        <span className="text-[10px] text-gray-400">{formatDateBR(resp.data)}</span>
                      </div>
                      <p className="text-gray-700 leading-relaxed text-xs">{resp.mensagem}</p>
                    </div>
                  ))}

                  {(!activeTicket.respostas || activeTicket.respostas.length === 0) && (
                    <p className="text-center py-4 text-gray-400 italic">
                      Nenhuma resposta registrada ainda neste chamado.
                    </p>
                  )}
                </div>
              </div>

              {/* Reply Box */}
              <div className="pt-3 border-t border-gray-100 space-y-2">
                <Label htmlFor="respostaArea" className="font-semibold text-gray-700">
                  Responder ao Chamado
                </Label>
                <div className="flex gap-2">
                  <Textarea
                    id="respostaArea"
                    rows={2}
                    value={respostaTexto}
                    onChange={(e) => setRespostaTexto(e.target.value)}
                    placeholder="Digite orientações técnicas, despacho de peças ou parecer do suporte..."
                    className="text-xs rounded-xl"
                  />
                  <Button
                    onClick={handleSendResposta}
                    disabled={sendingResposta || !respostaTexto.trim()}
                    className="bg-[#1B4332] hover:bg-[#2D6A4F] text-white rounded-xl h-auto px-4 self-end shrink-0"
                  >
                    <Send className="w-4 h-4 mr-1" />
                    Enviar
                  </Button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="border-t border-gray-100 pt-3">
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

      {/* New Ticket Modal */}
      <Dialog open={newModalOpen} onOpenChange={setNewModalOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#1B4332]">
              Abrir Chamado de Suporte
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateTicket} className="space-y-4 pt-2 text-xs">
            <div className="space-y-1.5">
              <Label htmlFor="ticketCliente" className="font-semibold text-gray-700">
                Cliente / Usina / Empresa *
              </Label>
              <Select value={newCliente} onValueChange={setNewCliente} required>
                <SelectTrigger id="ticketCliente" className="h-10 text-xs rounded-xl">
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

            <div className="space-y-1.5">
              <Label htmlFor="ticketAssunto" className="font-semibold text-gray-700">
                Assunto do Chamado *
              </Label>
              <Input
                id="ticketAssunto"
                value={newAssunto}
                onChange={(e) => setNewAssunto(e.target.value)}
                placeholder="Ex: Falha no sensor de fluxo hidráulico..."
                required
                className="h-10 text-xs rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ticketPrioridade" className="font-semibold text-gray-700">
                Nível de Prioridade
              </Label>
              <Select
                value={newPrioridade}
                onValueChange={(val) => setNewPrioridade(val as TicketPrioridade)}
              >
                <SelectTrigger id="ticketPrioridade" className="h-10 text-xs rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa (Dúvida operacional ou manual)</SelectItem>
                  <SelectItem value="media">Média (Manutenção preventiva programada)</SelectItem>
                  <SelectItem value="alta">Alta (Máquina parada / Urgência na usina)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ticketDesc" className="font-semibold text-gray-700">
                Descrição do Problema
              </Label>
              <Textarea
                id="ticketDesc"
                rows={3}
                value={newDescricao}
                onChange={(e) => setNewDescricao(e.target.value)}
                placeholder="Descreva sintomas, modelo de misturador envolvido e mensagens do painel..."
                className="text-xs rounded-xl"
              />
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setNewModalOpen(false)}
                className="rounded-xl text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-[#DC2626] hover:bg-[#b91c1c] text-white rounded-xl text-xs font-semibold px-5"
              >
                {isSubmitting ? 'Registrando...' : 'Abrir Ticket'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
