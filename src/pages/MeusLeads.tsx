import { useEffect, useMemo, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/contexts/AuthContext'
import { PageContainer } from '@/components/haramaq/PageContainer'
import { HaramaqCard } from '@/components/haramaq/HaramaqCard'
import { MetricCard } from '@/components/haramaq/MetricCard'
import { StatusBadge } from '@/components/haramaq/StatusBadge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Venda } from '@/types/crm'

const ETAPA_LABELS: Record<string, string> = {
  agendamento_primeiro_contato: 'Agendamento de 1º contato',
  em_contato: 'Em contato',
  revenda_contato: 'Contato via revenda',
  orcamentacao: 'Orçamentação',
  contato_futuro_agendado: 'Contato futuro agendado',
  arquivado_nao_retorna: 'Arquivado (sem retorno)',
  perdido_concorrencia: 'Perdido para concorrência',
  convertido_pedido: 'Convertido em pedido',
  pecas_pos_vendas: 'Peças e pós-vendas',
  financeiro_fiscal: 'Financeiro / fiscal',
  fornecedores: 'Fornecedores',
}

/**
 * Meus Leads — Prioridade 2 do Lote 2.
 * Consulta `vendas` com filtro server-side pelo users.id autenticado:
 *   filter: vendedor = "<auth.id>"
 * O isolamento REAL é a listRule do PocketBase (vendedor = @request.auth.id);
 * este filtro apenas restringe a consulta do próprio usuário. A carteira
 * textual é exibida como rótulo complementar, nunca como filtro de autorização.
 *
 * Acesso nesta fase: admin/gestor apenas — vendedor/revendedor entram após a
 * correção RBAC de vendas (E2b), enquanto existir acesso cruzado por carteira.
 */
export default function MeusLeads() {
  const { user } = useAuth()
  const [leads, setLeads] = useState<Venda[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')

  useEffect(() => {
    if (!user?.id) return
    let cancelado = false
    setLoading(true)
    setErro('')
    pb.collection('vendas')
      .getFullList({
        sort: '-updated',
        filter: `vendedor = "${user.id}"`,
      })
      .then((regs) => {
        if (!cancelado) setLeads(regs as unknown as Venda[])
      })
      .catch(() => {
        if (!cancelado) setErro('Não foi possível carregar seus leads.')
      })
      .finally(() => {
        if (!cancelado) setLoading(false)
      })
    return () => {
      cancelado = true
    }
  }, [user?.id])

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return leads
    return leads.filter((l) =>
      [l.cliente, l.produto, l.etapa, l.origem, l.numero_lead]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    )
  }, [leads, busca])

  const metricas = useMemo(
    () => ({
      total: leads.length,
      ativos: leads.filter((l) => l.status_lead === 'em_andamento' || !l.status_lead).length,
      convertidos: leads.filter((l) => l.status_lead === 'convertido_pedido').length,
    }),
    [leads],
  )

  return (
    <PageContainer>
      <div className="mb-4">
        <h1 className="text-xl font-bold text-[#1B4332]">Meus Leads</h1>
        <p className="text-sm text-gray-500">
          Leads atribuídos a você ({user?.name || user?.email || 'sessão atual'}). Isolamento por
          conta — outros vendedores não veem estes registros.
        </p>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MetricCard label="Meus leads" value={String(metricas.total)} />
        <MetricCard label="Em andamento" value={String(metricas.ativos)} />
        <MetricCard label="Convertidos" value={String(metricas.convertidos)} />
      </div>

      <HaramaqCard>
        <div className="mb-3 space-y-1">
          <Label htmlFor="busca-leads">Buscar</Label>
          <Input
            id="busca-leads"
            data-testid="busca-meus-leads"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Cliente, produto, etapa, origem..."
          />
        </div>

        {loading && <p className="py-6 text-center text-sm text-gray-500">Carregando...</p>}
        {erro && <p className="py-6 text-center text-sm text-red-600">{erro}</p>}
        {!loading && !erro && filtrados.length === 0 && (
          <p className="py-6 text-center text-sm text-gray-500" data-testid="meus-leads-vazio">
            Nenhum lead atribuído a você ainda.
          </p>
        )}
        {!loading && !erro && filtrados.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="meus-leads-tabela">
              <thead>
                <tr className="border-b text-left text-[11px] uppercase tracking-wide text-gray-500">
                  <th className="py-2 pr-3">Cliente</th>
                  <th className="py-2 pr-3">Produto</th>
                  <th className="py-2 pr-3">Etapa</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Carteira</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((l) => (
                  <tr key={l.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-medium text-gray-800">
                      {l.expand?.cliente?.nome || l.cliente}
                    </td>
                    <td className="py-2 pr-3">{l.produto}</td>
                    <td className="py-2 pr-3">{ETAPA_LABELS[l.etapa] || l.etapa}</td>
                    <td className="py-2 pr-3">
                      {l.status_lead ? (
                        <StatusBadge variant="neutral" dot>
                          {l.status_lead.replace('_', ' ')}
                        </StatusBadge>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-2 pr-3 text-gray-500">{l.carteira || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </HaramaqCard>
    </PageContainer>
  )
}
