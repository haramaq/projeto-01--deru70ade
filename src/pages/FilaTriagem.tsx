import { useCallback, useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/contexts/AuthContext'
import { PageContainer } from '@/components/haramaq/PageContainer'
import { HaramaqCard } from '@/components/haramaq/HaramaqCard'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { triagemHumanaService } from '@/services/crmService'
import type { TriagemHumana } from '@/types/crm'

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

      <Tabs defaultValue="comercial">
        <TabsList>
          <TabsTrigger value="comercial">Triagem Comercial</TabsTrigger>
          <TabsTrigger value="nao-comercial">Não Comercial</TabsTrigger>
        </TabsList>

        <TabsContent value="comercial">
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
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-3"
                  >
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
        </TabsContent>

        <TabsContent value="nao-comercial">
          <NaoComercialTab user={user} />
        </TabsContent>
      </Tabs>
    </PageContainer>
  )
}

function NaoComercialTab({ user }: { user: ReturnType<typeof useAuth>['user'] }) {
  const [itens, setItens] = useState<TriagemHumana[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [processando, setProcessando] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setErro('')
    try {
      const lista = await triagemHumanaService.listar()
      setItens(lista)
    } catch {
      setErro('Não foi possível carregar os atendimentos não comerciais.')
      setItens([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const assumir = async (id: string) => {
    if (!user) return
    setProcessando(id)
    try {
      await triagemHumanaService.assumir(id, user.id)
      toast.success('Solicitação assumida.')
      await carregar()
    } catch {
      toast.error('Não foi possível assumir a solicitação.')
      await carregar()
    } finally {
      setProcessando(null)
    }
  }

  const resolver = async (id: string) => {
    if (!user) return
    setProcessando(id)
    try {
      await triagemHumanaService.resolver(id)
      toast.success('Solicitação resolvida.')
      await carregar()
    } catch {
      toast.error('Não foi possível resolver a solicitação.')
      await carregar()
    } finally {
      setProcessando(null)
    }
  }

  const CATEGORIA_LABELS: Record<string, string> = {
    pecas: 'Peças',
    assistencia: 'Assistência técnica',
    pos_venda: 'Pós-venda',
    financeiro: 'Financeiro',
    fornecedores: 'Fornecedores',
    emprego: 'Emprego',
    revendas: 'Revendas',
    outros: 'Outros',
  }

  return (
    <HaramaqCard>
      {loading ? (
        <p className="text-sm text-[#64748B]">Carregando…</p>
      ) : erro ? (
        <p className="text-sm font-medium text-red-600" role="alert">
          {erro}
        </p>
      ) : itens.length === 0 ? (
        <p className="text-sm text-[#94A3B8]">Nenhuma solicitação não comercial.</p>
      ) : (
        <div className="divide-y">
          {itens.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <p className="text-sm font-semibold text-[#1E293B]">
                  {item.nome_solicitante} · {item.telefone}
                </p>
                <p className="text-xs text-[#64748B]">
                  <Badge variant="secondary">
                    {CATEGORIA_LABELS[item.categoria] || item.categoria}
                  </Badge>
                  {' · '}
                  {item.descricao || 'Sem descrição'}
                </p>
                <p className="text-xs text-[#94A3B8]">
                  {item.status === 'pendente'
                    ? 'Pendente'
                    : item.status === 'em_atendimento'
                      ? 'Em atendimento'
                      : 'Resolvido'}
                  {item.responsavel ? ' · Atribuído' : ''}
                </p>
              </div>
              <div className="flex gap-1">
                {item.status === 'pendente' && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={processando === item.id}
                    onClick={() => void assumir(item.id)}
                  >
                    {processando === item.id ? 'Assumindo…' : 'Assumir'}
                  </Button>
                )}
                {item.status === 'em_atendimento' && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={processando === item.id}
                    onClick={() => void resolver(item.id)}
                  >
                    {processando === item.id ? 'Resolvendo…' : 'Resolver'}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </HaramaqCard>
  )
}
