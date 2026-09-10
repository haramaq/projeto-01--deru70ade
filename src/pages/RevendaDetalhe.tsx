import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Building2,
  ShieldCheck,
  Phone,
  Mail,
  MapPin,
  Calendar,
  DollarSign,
  TrendingUp,
  Award,
} from 'lucide-react'
import { revendaService, vendaService } from '@/services/crmService'
import type { Revenda, Venda } from '@/types/crm'
import { formatCurrencyBRL, formatDateBR } from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

export default function RevendaDetalhe() {
  const { id } = useParams<{ id: string }>()
  const [revenda, setRevenda] = useState<Revenda | null>(null)
  const [vendasGerais, setVendasGerais] = useState<Venda[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    const load = async () => {
      try {
        const [r, vList] = await Promise.all([revendaService.getById(id), vendaService.getAll()])
        setRevenda(r)
        setVendasGerais(vList)
      } catch (err) {
        console.error(err)
        toast.error('Revenda não encontrada.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-4 border-[#1B4332] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-gray-500">Carregando dados da revenda...</p>
        </div>
      </div>
    )
  }

  if (!revenda) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-gray-500">Revenda não localizada no sistema.</p>
        <Link to="/revendas">
          <Button variant="outline" className="mt-4 rounded-xl text-xs">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar para Revendas
          </Button>
        </Link>
      </div>
    )
  }

  // Estimated sales volume based on region or models
  // If revenda is in Goiás, matches customers in GO, etc.
  const matchingDeals = vendasGerais.filter(
    (v) =>
      v.expand?.cliente?.estado?.toUpperCase() === revenda.estado?.toUpperCase() ||
      v.expand?.cliente?.cidade?.toLowerCase() === revenda.cidade?.toLowerCase(),
  )

  const totalPerformance = matchingDeals.reduce((acc, v) => acc + (v.valor || 0), 0)

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/revendas">
            <Button variant="outline" size="sm" className="h-9 w-9 p-0 rounded-xl border-gray-300">
              <ArrowLeft className="w-4 h-4 text-gray-700" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-[#1B4332] tracking-tight">{revenda.nome}</h1>
              <Badge
                variant="secondary"
                className={
                  revenda.status === 'autorizada'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }
              >
                {revenda.status === 'autorizada' ? 'Autorizada' : 'Pendente'}
              </Badge>
            </div>
            <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
              <MapPin className="w-3.5 h-3.5 text-gray-400" />
              Sede: {revenda.cidade} - {revenda.estado}
            </p>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Info Card */}
        <Card className="rounded-[16px] border border-[#E5E7EB] shadow-xs md:col-span-1">
          <CardHeader className="pb-3 border-b border-gray-100">
            <CardTitle className="text-sm font-bold text-[#1B4332] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#40916C]" />
              Dados do Credenciamento
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3.5 text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                CNPJ
              </span>
              <p className="font-mono font-semibold text-gray-800 mt-0.5">
                {revenda.cnpj || 'Não informado'}
              </p>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Contato Principal
              </span>
              <p className="text-gray-800 font-medium mt-0.5">
                {revenda.contato_principal || 'Não informado'}
              </p>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Telefone
              </span>
              <p className="text-gray-800 flex items-center gap-1.5 mt-0.5">
                <Phone className="w-3.5 h-3.5 text-gray-400" />
                {revenda.telefone || 'Não informado'}
              </p>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                E-mail Comercial
              </span>
              <p className="text-gray-800 flex items-center gap-1.5 mt-0.5 truncate">
                <Mail className="w-3.5 h-3.5 text-gray-400" />
                {revenda.email || 'Não informado'}
              </p>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Modelos Homologados
              </span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {(revenda.modelos || []).map((m) => (
                  <Badge
                    key={m}
                    variant="outline"
                    className="border-emerald-300 bg-emerald-50 text-[#1B4332] font-semibold text-[10px]"
                  >
                    {m}
                  </Badge>
                ))}
              </div>
            </div>

            {revenda.observacoes && (
              <div className="pt-2 border-t border-gray-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Cobertura Territorial & Observações
                </span>
                <p className="text-gray-600 mt-1 italic text-[11px] leading-relaxed">
                  "{revenda.observacoes}"
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sales Performance Card */}
        <div className="md:col-span-2 space-y-6">
          <Card className="rounded-[16px] border border-[#E5E7EB] shadow-xs">
            <CardHeader className="pb-3 border-b border-gray-100">
              <CardTitle className="text-sm font-bold text-[#1B4332] flex items-center gap-2">
                <Award className="w-4 h-4 text-[#F59E0B]" />
                Performance de Vendas na Região de Atuação
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="p-4 rounded-xl bg-[#F8FAF9] border border-gray-100">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500">
                    Volume Total de Negócios Atribuídos
                  </span>
                  <p className="text-2xl font-black text-gray-900 mt-1 tabular-nums">
                    {formatCurrencyBRL(totalPerformance)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {matchingDeals.length} oportunidade(s) registradas
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-700">
                    Status de Credenciamento
                  </span>
                  <p className="text-base font-bold text-[#1B4332] mt-1 flex items-center gap-1.5">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    Revenda Oficial Certificada
                  </p>
                  <p className="text-xs text-emerald-600/80 mt-1">
                    Capacitada para assistência técnica e peças originais Haramaq
                  </p>
                </div>
              </div>

              {/* Deals in territorial zone */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
                  Negócios Vinculados à Cobertura ({matchingDeals.length})
                </h4>
                <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
                  {matchingDeals.map((deal) => (
                    <div
                      key={deal.id}
                      className="p-3.5 flex items-center justify-between text-xs hover:bg-gray-50"
                    >
                      <div>
                        <p className="font-bold text-gray-900">
                          {deal.expand?.cliente?.empresa || deal.expand?.cliente?.nome}
                        </p>
                        <p className="text-[11px] text-gray-500">
                          Linha {deal.produto} &bull; Etapa:{' '}
                          <span className="capitalize font-semibold text-gray-700">
                            {deal.etapa}
                          </span>
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-gray-900 tabular-nums">
                          {formatCurrencyBRL(deal.valor)}
                        </span>
                        <p className="text-[10px] text-gray-400">
                          {formatDateBR(deal.data_prevista_fechamento)}
                        </p>
                      </div>
                    </div>
                  ))}

                  {matchingDeals.length === 0 && (
                    <div className="p-6 text-center text-xs text-gray-400">
                      Nenhum negócio ativo atribuído à região desta revenda no momento.
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
