import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { MapPin, Plus, Power, Trash2, AlertTriangle, Search } from 'lucide-react'
import PageContainer, { PageHeader } from '@/components/haramaq/PageContainer'
import { HaramaqCard } from '@/components/haramaq/HaramaqCard'
import HaramaqButton from '@/components/haramaq/HaramaqControls'
import StatusBadge from '@/components/haramaq/StatusBadge'
import {
  territorioService,
  dddService,
  userService,
  normalizarCidade,
  type CidadeAtendida,
  type TerritorioRegiao,
  type TerritorioCidade,
  type ItemFilaRevisao,
  type VendedorDdd,
} from '@/services/crmService'
import type { User } from '@/types/crm'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const UFS = [
  'RS',
  'SC',
  'PR',
  'SP',
  'MG',
  'RJ',
  'ES',
  'MS',
  'MT',
  'GO',
  'DF',
  'BA',
  'SE',
  'AL',
  'PE',
  'PB',
  'RN',
  'CE',
  'PI',
  'MA',
  'PA',
  'AP',
  'AM',
  'RR',
  'AC',
  'RO',
  'TO',
]

type Conflito = { cidadeId: string; cidade: string; uf: string; regioes: string[] }

export default function TerritoriosComerciais() {
  const [cidades, setCidades] = useState<CidadeAtendida[]>([])
  const [regioes, setRegioes] = useState<TerritorioRegiao[]>([])
  const [vinculos, setVinculos] = useState<TerritorioCidade[]>([])
  const [fila, setFila] = useState<ItemFilaRevisao[]>([])
  const [vendedores, setVendedores] = useState<User[]>([])
  const [ddds, setDdds] = useState<Record<string, VendedorDdd[]>>({})
  const [busca, setBusca] = useState('')
  const [ufFiltro, setUfFiltro] = useState('')
  const [regiaoFiltro, setRegiaoFiltro] = useState('')
  const [novoAberto, setNovoAberto] = useState(false)
  const [novaCidade, setNovaCidade] = useState('')
  const [novaUf, setNovaUf] = useState('')
  const [novaRegiaoAberto, setNovaRegiaoAberto] = useState(false)
  const [nomeRegiao, setNomeRegiao] = useState('')
  const [vendedorRegiao, setVendedorRegiao] = useState('')
  const [vinculoRegiao, setVinculoRegiao] = useState('')
  const [vinculoCidade, setVinculoCidade] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [modo, setModo] = useState<'so_decide' | 'automatico'>('so_decide')

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const [cs, rs, vs, fr, md] = await Promise.all([
        territorioService.cidades(),
        territorioService.regioes(),
        userService.getAll().catch(() => [] as User[]),
        territorioService.filaRevisao().catch(() => [] as ItemFilaRevisao[]),
        territorioService.modoMotor().catch(() => 'so_decide' as const),
      ])
      setModo(md)
      setCidades(cs)
      setRegioes(rs)
      setVendedores(Array.isArray(vs) ? vs : [])
      setFila(fr)
      const vs2 = await territorioService.vinculosCidades()
      setVinculos(vs2)
      const ativos = (Array.isArray(vs) ? vs : []).filter(
        (u) => u.ativo && (u.role === 'vendedor' || u.role === 'revendedor'),
      )
      const mapaDdds: Record<string, VendedorDdd[]> = {}
      await Promise.all(
        ativos.map(async (u) => {
          mapaDdds[u.id] = await dddService.listByUser(u.id).catch(() => [])
        }),
      )
      setDdds(mapaDdds)
    } catch {
      toast.error(
        'Não foi possível carregar os territórios. Verifique se a migration 0033 foi aplicada.',
      )
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  // Conflitos de cobertura: mesma cidade vinculada a 2+ regiões ATIVAS (requisito 8/10):
  const conflitos = useMemo<Conflito[]>(() => {
    const porCidade: Record<string, string[]> = {}
    for (const v of vinculos) {
      const regiao = regioes.find((r) => r.id === v.regiao_id)
      if (!regiao || !regiao.ativo) continue
      porCidade[v.cidade_id] = [...(porCidade[v.cidade_id] || []), v.regiao_id]
    }
    return Object.entries(porCidade)
      .filter(([, regs]) => regs.length > 1)
      .map(([cidadeId, regs]) => {
        const c = cidades.find((x) => x.id === cidadeId)
        return {
          cidadeId,
          cidade: c?.cidade || cidadeId,
          uf: c?.uf || '',
          regioes: regs.map((rid) => regioes.find((r) => r.id === rid)?.nome || rid),
        }
      })
  }, [vinculos, regioes, cidades])

  // Cidades sem responsável: ativas, sem vínculo com região ativa (requisito 10):
  const cidadesSemResponsavel = useMemo(() => {
    const comRegiaoAtiva = new Set(
      vinculos
        .filter((v) => regioes.find((r) => r.id === v.regiao_id)?.ativo)
        .map((v) => v.cidade_id),
    )
    return cidades.filter((c) => c.ativo !== false && !comRegiaoAtiva.has(c.id))
  }, [cidades, vinculos, regioes])

  const cidadesFiltradas = useMemo(() => {
    const termo = normalizarCidade(busca)
    return cidades.filter((c) => {
      if (ufFiltro && c.uf !== ufFiltro) return false
      if (regiaoFiltro) {
        const cidadesDaRegiao = new Set(
          vinculos.filter((v) => v.regiao_id === regiaoFiltro).map((v) => v.cidade_id),
        )
        if (!cidadesDaRegiao.has(c.id)) return false
      }
      if (termo && normalizarCidade(c.cidade).indexOf(termo) === -1) return false
      return true
    })
  }, [cidades, busca, ufFiltro, regiaoFiltro, vinculos])

  const conflitoAntesDeSalvar = useCallback(
    (regiaoId: string, cidadeId: string): boolean => {
      const jaVinculada = vinculos.filter(
        (v) =>
          v.cidade_id === cidadeId &&
          v.regiao_id !== regiaoId &&
          regioes.find((r) => r.id === v.regiao_id)?.ativo,
      )
      return jaVinculada.length > 0
    },
    [vinculos, regioes],
  )

  const cadastrarCidade = async () => {
    if (!novaCidade.trim() || novaUf.length !== 2) {
      toast.error('Informe a cidade e a UF (2 letras).')
      return
    }
    try {
      await territorioService.criarCidade({ cidade: novaCidade, uf: novaUf })
      toast.success('Cidade cadastrada.')
      setNovaCidade('')
      setNovaUf('')
      setNovoAberto(false)
      carregar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao cadastrar cidade.')
    }
  }

  const criarRegiao = async () => {
    if (!nomeRegiao.trim() || !vendedorRegiao) {
      toast.error('Informe o nome da região e o vendedor responsável.')
      return
    }
    try {
      await territorioService.criarRegiao({ nome: nomeRegiao, vendedor_id: vendedorRegiao })
      toast.success('Região criada.')
      setNomeRegiao('')
      setVendedorRegiao('')
      setNovaRegiaoAberto(false)
      carregar()
    } catch {
      toast.error('Falha ao criar região.')
    }
  }

  const vincular = async () => {
    if (!vinculoRegiao || !vinculoCidade) {
      toast.error('Selecione a região e a cidade.')
      return
    }
    if (conflitoAntesDeSalvar(vinculoRegiao, vinculoCidade)) {
      const c = cidades.find((x) => x.id === vinculoCidade)
      toast.warning(
        `Atenção: ${c?.cidade}/${c?.uf} já pertence a outra região ativa. O vínculo criará conflito de cobertura (revisão humana na distribuição).`,
      )
    }
    try {
      await territorioService.vincularCidade(vinculoRegiao, vinculoCidade)
      toast.success('Cidade vinculada à região.')
      setVinculoCidade('')
      carregar()
    } catch {
      toast.error('Falha ao vincular cidade.')
    }
  }

  const alternarRegiao = async (r: TerritorioRegiao) => {
    try {
      await territorioService.editarRegiao(r.id, { ativo: !r.ativo })
      toast.success(r.ativo ? 'Região desativada (histórico preservado).' : 'Região ativada.')
      carregar()
    } catch {
      toast.error('Falha ao alterar a região.')
    }
  }

  const vendedoresAtivos = vendedores.filter(
    (u) => u.ativo && (u.role === 'vendedor' || u.role === 'revendedor'),
  )

  return (
    <PageContainer maxWidth="wide">
      <PageHeader
        title="Territórios Comerciais"
        subtitle="Cadastro interno de cidades atendidas, regiões e vendedores responsáveis (distribuição por DDI/DDD + cidade/UF)."
        badge={
          <button
            type="button"
            title="Modo do motor de distribuição (controlado pelo servidor). Clique para alternar."
            onClick={async () => {
              const novo = modo === 'automatico' ? 'so_decide' : 'automatico'
              try {
                await territorioService.alternarModoMotor(novo)
                setModo(novo)
                toast.success(
                  'Modo do motor alterado para ' +
                    (novo === 'automatico' ? 'AUTOMÁTICO (atribui)' : 'SÓ DECIDE (recomenda)') +
                    '.',
                )
              } catch {
                toast.error('Falha ao alterar o modo do motor.')
              }
            }}
          >
            <StatusBadge variant={modo === 'automatico' ? 'danger' : 'neutral'}>
              Motor: {modo === 'automatico' ? 'AUTOMÁTICO' : 'SÓ DECIDE'}
            </StatusBadge>
          </button>
        }
        actions={
          <>
            <HaramaqButton onClick={() => setNovoAberto(true)}>
              <Plus className="h-4 w-4 mr-1" /> Nova cidade
            </HaramaqButton>
            <HaramaqButton onClick={() => setNovaRegiaoAberto(true)}>
              <Plus className="h-4 w-4 mr-1" /> Nova região
            </HaramaqButton>
          </>
        }
      />

      {conflitos.length > 0 && (
        <div className="mb-4 rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] p-3 text-sm text-[#B91C1C]">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" /> {conflitos.length} conflito(s) de cobertura
          </div>
          <ul className="mt-1 list-disc pl-5">
            {conflitos.map((c) => (
              <li key={c.cidadeId}>
                {c.cidade}/{c.uf} — regiões: {c.regioes.join(', ')}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3 mb-5">
        <HaramaqCard className="lg:col-span-2 p-4">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="h-4 w-4 text-[#B91C1C]" />
            <h2 className="font-semibold text-[#1E293B]">Cidades atendidas</h2>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-[#94A3B8]" />
              <Input
                className="pl-8"
                placeholder="Pesquisar cidade..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <Select
              value={ufFiltro || 'todas'}
              onValueChange={(v) => setUfFiltro(v === 'todas' ? '' : v)}
            >
              <SelectTrigger className="w-full sm:w-28">
                <SelectValue placeholder="UF" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {UFS.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={regiaoFiltro || 'todas'}
              onValueChange={(v) => setRegiaoFiltro(v === 'todas' ? '' : v)}
            >
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Região" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as regiões</SelectItem>
                {regioes.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="max-h-80 overflow-y-auto rounded border">
            <table className="w-full text-sm">
              <thead className="bg-[#FEF2F2] sticky top-0">
                <tr className="text-left text-[#B91C1C]">
                  <th className="px-3 py-2 font-semibold">Cidade</th>
                  <th className="px-3 py-2 font-semibold">UF</th>
                  <th className="px-3 py-2 font-semibold">Regiões</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {carregando && (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-[#64748B]">
                      Carregando...
                    </td>
                  </tr>
                )}
                {!carregando && cidadesFiltradas.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-[#64748B]">
                      Nenhuma cidade encontrada.
                    </td>
                  </tr>
                )}
                {cidadesFiltradas.map((c) => {
                  const regs = vinculos
                    .filter((v) => v.cidade_id === c.id)
                    .map((v) => regioes.find((r) => r.id === v.regiao_id))
                    .filter(Boolean) as TerritorioRegiao[]
                  return (
                    <tr key={c.id} className="border-t">
                      <td className="px-3 py-2">{c.cidade}</td>
                      <td className="px-3 py-2">{c.uf}</td>
                      <td className="px-3 py-2">
                        {regs.length === 0 ? (
                          <span className="text-[#94A3B8]">—</span>
                        ) : (
                          regs.map((r) => (
                            <span
                              key={r.id}
                              className={
                                'mr-1 inline-block rounded px-1.5 py-0.5 text-xs ' +
                                (r.ativo
                                  ? 'bg-[#FEE2E2] text-[#B91C1C]'
                                  : 'bg-[#F1F5F9] text-[#64748B]')
                              }
                            >
                              {r.nome}
                              {r.ativo ? '' : ' (inativa)'}
                            </span>
                          ))
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          className="text-[#64748B] hover:text-[#B91C1C]"
                          title={c.ativo === false ? 'Ativar cidade' : 'Desativar cidade'}
                          onClick={async () => {
                            try {
                              await territorioService.alternarCidade(c.id, c.ativo === false)
                              carregar()
                            } catch {
                              toast.error('Falha ao alterar cidade.')
                            }
                          }}
                        >
                          <Power
                            className={
                              'h-4 w-4 ' +
                              (c.ativo === false ? 'text-[#94A3B8]' : 'text-emerald-600')
                            }
                          />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {cidadesSemResponsavel.length > 0 && (
            <p className="mt-2 text-xs text-[#B91C1C]">
              {cidadesSemResponsavel.length} cidade(s) ativa(s) sem região responsável.
            </p>
          )}
        </HaramaqCard>

        <HaramaqCard className="p-4">
          <h2 className="font-semibold text-[#1E293B] mb-3">Regiões e vendedores</h2>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {regioes.map((r) => {
              const cidadesDaRegiao = vinculos.filter((v) => v.regiao_id === r.id).length
              const listaDdds = (ddds[r.vendedor_id] || []).filter((d) => d.ativo !== false)
              return (
                <div key={r.id} className="rounded border p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-[#1E293B] truncate">{r.nome}</p>
                      <p className="text-xs text-[#64748B] truncate">
                        {r.expand?.vendedor_id?.name || r.vendedor_id} · {cidadesDaRegiao} cidade(s)
                      </p>
                      <p className="text-xs text-[#B91C1C]">
                        DDDs:{' '}
                        {listaDdds.length
                          ? listaDdds
                              .map(
                                (d) => `${d.ddi === '+55' || d.ddi === '55' ? '' : d.ddi}${d.ddd}`,
                              )
                              .join(', ') || '—'
                          : 'nenhum'}
                      </p>
                    </div>
                    <button
                      className="text-[#64748B] hover:text-[#B91C1C]"
                      title={r.ativo ? 'Desativar região' : 'Ativar região'}
                      onClick={() => alternarRegiao(r)}
                    >
                      <Power
                        className={'h-4 w-4 ' + (r.ativo ? 'text-emerald-600' : 'text-[#94A3B8]')}
                      />
                    </button>
                  </div>
                </div>
              )
            })}
            {regioes.length === 0 && !carregando && (
              <p className="text-sm text-[#64748B]">Nenhuma região cadastrada.</p>
            )}
          </div>

          <div className="mt-4 border-t pt-3">
            <h3 className="text-sm font-semibold text-[#1E293B] mb-2">Vincular cidade à região</h3>
            <div className="space-y-2">
              <Select
                value={vinculoRegiao || 'selecione'}
                onValueChange={(v) => setVinculoRegiao(v === 'selecione' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Região" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="selecione" disabled>
                    Selecione a região
                  </SelectItem>
                  {regioes
                    .filter((r) => r.ativo)
                    .map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.nome}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Select
                value={vinculoCidade || 'selecione'}
                onValueChange={(v) => setVinculoCidade(v === 'selecione' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Cidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="selecione" disabled>
                    Selecione a cidade
                  </SelectItem>
                  {cidades
                    .filter((c) => c.ativo !== false)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.cidade}/{c.uf}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <HaramaqButton className="w-full" onClick={vincular}>
                Vincular
              </HaramaqButton>
            </div>
          </div>
        </HaramaqCard>
      </div>

      <HaramaqCard className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-4 w-4 text-[#B91C1C]" />
          <h2 className="font-semibold text-[#1E293B]">Fila de revisão humana</h2>
          <span className="text-xs text-[#64748B]">({fila.length} pendente(s))</span>
        </div>
        <div className="max-h-60 overflow-y-auto rounded border">
          <table className="w-full text-sm">
            <thead className="bg-[#FEF2F2] sticky top-0">
              <tr className="text-left text-[#B91C1C]">
                <th className="px-3 py-2 font-semibold">Lead</th>
                <th className="px-3 py-2 font-semibold">Motivo</th>
                <th className="px-3 py-2 font-semibold">Detalhe</th>
                <th className="px-3 py-2 font-semibold">Ação</th>
              </tr>
            </thead>
            <tbody>
              {fila.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-[#64748B]">
                    Nenhum item pendente.
                  </td>
                </tr>
              )}
              {fila.map((f) => (
                <tr key={f.id} className="border-t">
                  <td className="px-3 py-2 font-mono text-xs">{f.lead_id.slice(0, 8)}…</td>
                  <td className="px-3 py-2">{f.motivo}</td>
                  <td className="px-3 py-2 text-[#64748B]">{(f.detalhe || '').slice(0, 80)}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <button
                        className="text-xs rounded bg-emerald-600 text-white px-2 py-1"
                        onClick={async () => {
                          try {
                            await territorioService.resolverFila(
                              f.id,
                              'Aceito pelo admin (atribuição manual no Kanban).',
                              'resolvida',
                            )
                            toast.success(
                              'Item resolvido. Atribua o lead manualmente no Kanban se desejar.',
                            )
                            carregar()
                          } catch {
                            toast.error('Falha ao resolver item.')
                          }
                        }}
                      >
                        Aceitar
                      </button>
                      <button
                        className="text-xs rounded bg-[#F1F5F9] text-[#64748B] px-2 py-1"
                        onClick={async () => {
                          try {
                            await territorioService.resolverFila(
                              f.id,
                              'Descartado pelo admin.',
                              'descartada',
                            )
                            toast.success('Item descartado.')
                            carregar()
                          } catch {
                            toast.error('Falha ao descartar item.')
                          }
                        }}
                      >
                        Descartar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </HaramaqCard>

      <Dialog open={novoAberto} onOpenChange={setNovoAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova cidade atendida</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="ncCidade">Cidade</Label>
              <Input
                id="ncCidade"
                value={novaCidade}
                onChange={(e) => setNovaCidade(e.target.value)}
                placeholder="Ex.: Passo Fundo"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ncUf">UF</Label>
              <Input
                id="ncUf"
                value={novaUf}
                onChange={(e) => setNovaUf(e.target.value.toUpperCase().slice(0, 2))}
                placeholder="RS"
                maxLength={2}
              />
            </div>
            <HaramaqButton className="w-full" onClick={cadastrarCidade}>
              Cadastrar cidade
            </HaramaqButton>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={novaRegiaoAberto} onOpenChange={setNovaRegiaoAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova região comercial</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="nrNome">Nome da região</Label>
              <Input
                id="nrNome"
                value={nomeRegiao}
                onChange={(e) => setNomeRegiao(e.target.value)}
                placeholder="Ex.: Região Norte/RS"
              />
            </div>
            <div className="space-y-1">
              <Label>Vendedor responsável</Label>
              <Select
                value={vendedorRegiao || 'selecione'}
                onValueChange={(v) => setVendedorRegiao(v === 'selecione' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Vendedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="selecione" disabled>
                    Selecione o vendedor
                  </SelectItem>
                  {vendedoresAtivos.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <HaramaqButton className="w-full" onClick={criarRegiao}>
              Criar região
            </HaramaqButton>
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}
