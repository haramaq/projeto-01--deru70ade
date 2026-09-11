import React, { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Building,
  Mail,
  Phone,
  MapPin,
  Calendar,
  DollarSign,
  TrendingUp,
  Headphones,
  PlusCircle,
  FileText,
  Clock,
} from 'lucide-react'
import { clienteService, vendaService, ticketService } from '@/services/crmService'
import type { Cliente, Venda, Ticket } from '@/types/crm'
import { formatCurrencyBRL, formatDateBR } from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'

export default function ClienteDetalhe() {
  const { id } = useParams<{ id: string }>()
  const { role } = useAuth()
  const navigate = useNavigate()

  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [vendas, setVendas] = useState<Venda[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    const loadAll = async () => {
      try {
        const [c, vList, tList] = await Promise.all([
          clienteService.getById(id),
          vendaService.getByCliente(id),
          ticketService.getByCliente(id),
        ])
        setCliente(c)
        setVendas(vList)
        setTickets(tList)
      } catch (err) {
        console.error(err)
        toast.error('Cliente não encontrado.')
      } finally {
        setLoading(false)
      }
    }
    loadAll()
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-4 border-[#1B4332] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-gray-500">Carregando perfil do cliente...</p>
        </div>
      </div>
    )
  }

  if (!cliente) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-gray-500">Cliente não localizado no sistema.</p>
        <Link to="/clientes">
          <Button variant="outline" className="mt-4 rounded-xl text-xs">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar para Clientes
          </Button>
        </Link>
      </div>
    )
  }

  const canCreate = role === 'admin' || role === 'vendedor'
  const totalVolumeVendas = vendas.reduce((acc, v) => acc + (v.valor || 0), 0)

  return (
    <div className="w-full max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-5 md:py-6 space-y-6">
      {/* Top Bar with Back Button & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/clientes">
            <Button
              variant="outline"
              size="sm"
              className="h-9 w-9 p-0 rounded-lg border-[#E2E8F0] hover:bg-[#F8FAFC]"
            >
              <ArrowLeft className="w-4 h-4 text-[#1E293B]" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-[#1E293B] tracking-tight">
                {cliente.empresa || cliente.nome}
              </h1>
              <Badge
                variant="secondary"
                className={
                  cliente.status === 'ativo'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-semibold'
                    : 'bg-gray-100 text-gray-700 text-[10px] font-semibold'
                }
              >
                {cliente.status === 'ativo' ? 'Ativo' : 'Inativo'}
              </Badge>
            </div>
            <p className="text-xs text-[#64748B]">
              Contato Principal:{' '}
              <span className="font-semibold text-[#1E293B]">{cliente.nome}</span>
            </p>
          </div>
        </div>

        {canCreate && (
          <Button
            onClick={() => navigate(`/vendas?nova=true&clienteId=${cliente.id}`)}
            className="bg-[#D92323] hover:bg-[#B91C1C] text-white font-semibold rounded-lg gap-2 shadow-xs transition-colors self-start sm:self-auto h-9 text-xs"
          >
            <PlusCircle className="w-4 h-4" />
            Novo Lead para este Cliente{' '}
          </Button>
        )}
      </div>

      {/* Main Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Info Card */}
        <Card className="rounded-xl border border-[#E2E8F0] shadow-xs md:col-span-1 bg-white">
          <CardHeader className="pb-3 border-b border-[#F1F5F9]">
            <CardTitle className="text-sm font-bold text-[#1E293B]">Ficha Cadastral</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3.5 text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                CNPJ
              </span>
              <p className="font-mono font-semibold text-gray-800 mt-0.5">
                {cliente.cnpj || 'Não informado'}
              </p>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Localização
              </span>
              <p className="text-gray-800 flex items-center gap-1.5 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                {cliente.cidade ? `${cliente.cidade} - ${cliente.estado || ''}` : 'Não informada'}
              </p>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Telefone / Contato
              </span>
              <p className="text-gray-800 flex items-center gap-1.5 mt-0.5">
                <Phone className="w-3.5 h-3.5 text-gray-400" />
                {cliente.telefone || 'Não informado'}
              </p>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                E-mail
              </span>
              <p className="text-gray-800 flex items-center gap-1.5 mt-0.5 truncate">
                <Mail className="w-3.5 h-3.5 text-gray-400" />
                {cliente.email || 'Não informado'}
              </p>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Data de Cadastro
              </span>
              <p className="text-gray-800 flex items-center gap-1.5 mt-0.5">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                {formatDateBR(cliente.created)}
              </p>
            </div>

            {cliente.observacoes && (
              <div className="pt-2 border-t border-gray-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Observações
                </span>
                <p className="text-gray-600 mt-1 italic text-[11px] leading-relaxed">
                  "{cliente.observacoes}"
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Deals & Tickets Tabs / Sections */}
        <div className="md:col-span-2 space-y-6">
          {/* Deals list */}
          <Card className="rounded-xl border border-[#E2E8F0] shadow-xs bg-white">
            <CardHeader className="pb-3 border-b border-[#F1F5F9] flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-[#1E293B] flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#D92323]" />
                  Leads deste Cliente ({vendas.length})
                </CardTitle>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Volume total negociado:{' '}
                  <strong className="text-[#1E293B]">{formatCurrencyBRL(totalVolumeVendas)}</strong>
                </p>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-gray-100">
                {vendas.map((v) => (
                  <div
                    key={v.id}
                    className="p-4 flex items-center justify-between hover:bg-gray-50/60 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-gray-900">
                          {v.categoria_produto || 'Categoria não informada'}
                        </span>
                        <Badge
                          variant="outline"
                          className={
                            v.produto === 'SUPERMIX'
                              ? 'text-red-700 bg-red-50 text-[10px]'
                              : 'text-emerald-700 bg-emerald-50 text-[10px]'
                          }
                        >
                          {v.produto}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1">
                        Etapa:{' '}
                        <span className="font-semibold text-gray-700 capitalize">{v.etapa}</span>{' '}
                        &bull; Probabilidade: {v.probabilidade}%
                      </p>
                      {v.proxima_acao && (
                        <p className="text-[11px] text-gray-600 mt-1 italic">
                          Próx: {v.proxima_acao}
                        </p>
                      )}
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-black text-gray-900 tabular-nums">
                        {formatCurrencyBRL(v.valor)}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-1">
                        Previsão: {formatDateBR(v.data_prevista_fechamento)}
                      </p>
                    </div>
                  </div>
                ))}

                {vendas.length === 0 && (
                  <div className="py-8 text-center text-xs text-gray-400">
                    Nenhum lead vinculado a este cliente até o momento.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Support Tickets list */}
          <Card className="rounded-xl border border-[#E2E8F0] shadow-xs bg-white">
            <CardHeader className="pb-3 border-b border-[#F1F5F9] flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold text-[#1E293B] flex items-center gap-2">
                <Headphones className="w-4 h-4 text-[#D92323]" />
                Histórico de Suporte Pós-Venda ({tickets.length})
              </CardTitle>
              <Link
                to="/suporte"
                className="text-xs font-semibold text-[#D92323] hover:text-[#991B1B]"
              >
                Abrir Suporte
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-gray-100">
                {tickets.map((t) => (
                  <div
                    key={t.id}
                    className="p-4 flex items-center justify-between hover:bg-gray-50/60 transition-colors"
                  >
                    <div>
                      <p className="font-semibold text-xs text-gray-900">{t.assunto}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">{t.descricao}</p>
                      <p className="text-[10px] text-gray-400 mt-1">
                        Aberto em {formatDateBR(t.created)} &bull; {t.respostas?.length || 0}{' '}
                        resposta(s)
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge
                        variant="secondary"
                        className={
                          t.status === 'aberto'
                            ? 'bg-red-50 text-red-600 border border-red-100 text-[10px]'
                            : 'bg-emerald-50 text-emerald-600 border border-emerald-100 text-[10px]'
                        }
                      >
                        {t.status === 'aberto' ? 'Aberto' : 'Finalizado'}
                      </Badge>
                      <span className="text-[10px] text-gray-500 uppercase font-semibold">
                        Prioridade {t.prioridade}
                      </span>
                    </div>
                  </div>
                ))}

                {tickets.length === 0 && (
                  <div className="py-8 text-center text-xs text-gray-400">
                    Nenhum ticket de suporte registrado para este cliente.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
