import { useCallback, useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/contexts/AuthContext'
import { PageContainer } from '@/components/haramaq/PageContainer'
import { HaramaqCard } from '@/components/haramaq/HaramaqCard'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface FilaItem {
  id: string
  numero_lead: string
  etapa: string
  origem_lead: string
  cliente_nome: string
  created: string
}

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
 * Fila de Triagem — leads SEM responsável (decisão owner 30/10 14:54).
 * Consulta EXCLUSIVA pela rota server-side /backend/v1/triagem/fila. Atribuição segura via
 * /backend/v1/triagem/atribuir (server-side, idempotente, 409 em concorrência).
 * Vendedores não acessam esta página (rota protegida por papel no App.tsx).
 */
export default function FilaTriagem() {
  const { user } = useAuth()
  const [itens, setItens] = useState<FilaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [atribuindo, setAtribuindo] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setErro('')
    try {
      const resposta = (await pb.send('/backend/v1/triagem/fila', {})) as {
        itens?: FilaItem[]
      }
      setItens(resposta.itens || [])
    } catch {
      setErro('Não foi possível carregar a fila de triagem.')
      setItens([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const atribuirParaSi = async (leadId: string) => {
    if (!user) return
    setAtribuindo(leadId)
    try {
      await pb.send('/backend/v1/triagem/atribuir', {
        method: 'POST',
        body: { lead: leadId, vendedor: user.id },
      })
      toast.success('Lead atribuído a você.')
      await carregar()
    } catch (error) {
      const mensagem =
        error instanceof Error && error.message.includes('já atribuído')
          ? 'Este lead acabou de ser assumido por outro usuário.'
          : 'Não foi possível atribuir o lead.'
      toast.error(mensagem)
      await carregar()
    } finally {
      setAtribuindo(null)
    }
  }

  return (
    <PageContainer>
      <div className="mb-4">
        <h1 className="text-xl font-bold text-[#1E293B]">Fila de Triagem</h1>
        <p className="text-sm text-[#64748B]">
          Leads sem responsável aguardando atribuição. Somente leitura de fila — a atribuição é
          registrada pelo servidor com auditoria.
        </p>
      </div>

      <HaramaqCard>
        {loading ? (
          <p className="text-sm text-[#64748B]">Carregando fila…</p>
        ) : erro ? (
          <p className="text-sm font-medium text-red-600" role="alert">
            {erro}
          </p>
        ) : itens.length === 0 ? (
          <p className="text-sm text-[#94A3B8]">Nenhum lead na fila.</p>
        ) : (
          <div className="divide-y">
            {itens.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="text-sm font-semibold text-[#1E293B]">
                    {item.numero_lead || item.id}
                    {item.cliente_nome ? ` · ${item.cliente_nome}` : ''}
                  </p>
                  <p className="text-xs text-[#64748B]">
                    {ETAPA_LABELS[item.etapa] || item.etapa}
                    {item.origem_lead ? ` · ${item.origem_lead}` : ''}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={atribuindo === item.id}
                  onClick={() => void atribuirParaSi(item.id)}
                >
                  {atribuindo === item.id ? 'Atribuindo…' : 'Assumir lead'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </HaramaqCard>
    </PageContainer>
  )
}
