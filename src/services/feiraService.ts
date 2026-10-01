import pb from '@/lib/pocketbase/client'
import { auditService } from '@/services/crmService'
import type {
  Feira,
  FeiraArquivo,
  FeiraArquivoTipo,
  FeiraCusto,
  FeiraCustoCategoria,
  FeiraLeituraStatus,
  FeiraResultado,
  FeiraResultadoTipo,
} from '@/types/crm'

export type FeiraCostInput = Partial<FeiraCusto> & { feira: string }
export type FeiraResultInput = Omit<Partial<FeiraResultado>, 'pedido_arquivo'> & {
  feira: string
  pedido_arquivo?: File
}
export type FeiraResultUpdateInput = Omit<Partial<FeiraResultado>, 'pedido_arquivo'> & {
  pedido_arquivo?: File
}
export type FeiraFileInput = {
  feira: string
  arquivo?: File
  nome_arquivo: string
  tipo_arquivo: FeiraArquivoTipo
  leitura_status: FeiraLeituraStatus
  texto_extraido?: string
  dados_extraidos?: unknown
  total_custo_extraido?: number
  custos_importados?: number
  observacoes?: string
}

export const FEIRA_COST_CATEGORIES: FeiraCustoCategoria[] = [
  'locacao_terreno',
  'estrutura_estande',
  'alimentacao',
  'bebida',
  'hospedagem',
  'deslocamento',
  'logistica_maquinas',
  'relatorios_equipe_comercial',
  'outros',
]

export const FEIRA_COST_LABELS: Record<FeiraCustoCategoria, string> = {
  locacao_terreno: 'Locação de terreno',
  estrutura_estande: 'Estrutura de estande',
  alimentacao: 'Alimentação',
  bebida: 'Bebida',
  hospedagem: 'Hospedagem',
  deslocamento: 'Deslocamento',
  logistica_maquinas: 'Logística de máquinas',
  relatorios_equipe_comercial: 'Relatórios da equipe comercial',
  outros: 'Demais custos relacionados',
}

export const FEIRA_STATUS_LABELS = {
  planejada: 'Planejada',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
} as const

export const FEIRA_RESULT_LABELS: Record<FeiraResultadoTipo, string> = {
  venda_realizada: 'Venda realizada',
  proposta: 'Proposta',
  lead_gerado: 'Lead gerado',
}

async function recordAudit(acao: string, alvo: string, antes: unknown, depois: unknown) {
  await auditService.record({
    autor: pb.authStore.record?.id || 'sessão atual',
    alvo,
    acao,
    antes,
    depois,
  })
}

export const feiraService = {
  async getAll(): Promise<Feira[]> {
    return (await pb
      .collection('feiras')
      .getFullList({ sort: '-data_inicio,-ano,nome' })) as unknown as Feira[]
  },

  async create(data: Partial<Feira>): Promise<Feira> {
    const created = (await pb.collection('feiras').create(data)) as unknown as Feira
    await recordAudit('criar_feira', created.id, null, created)
    return created
  },

  async update(id: string, data: Partial<Feira>): Promise<Feira> {
    const before = (await pb.collection('feiras').getOne(id)) as unknown as Feira
    const updated = (await pb.collection('feiras').update(id, data)) as unknown as Feira
    await recordAudit('editar_feira', id, before, updated)
    return updated
  },

  async delete(id: string): Promise<boolean> {
    const before = (await pb.collection('feiras').getOne(id)) as unknown as Feira
    const deleted = await pb.collection('feiras').delete(id)
    if (deleted) await recordAudit('remover_feira', id, before, null)
    return deleted
  },

  async getCustos(feiraId?: string): Promise<FeiraCusto[]> {
    const filter = feiraId ? `feira = '${feiraId}'` : undefined
    return (await pb.collection('feira_custos').getFullList({
      filter,
      sort: '-data_custo,-created',
      expand: 'feira',
    })) as unknown as FeiraCusto[]
  },

  async createCusto(data: FeiraCostInput): Promise<FeiraCusto> {
    const created = (await pb.collection('feira_custos').create(
      {
        ...data,
        valor_estimado: data.valor_estimado ?? 0,
        valor_realizado: data.valor_realizado ?? 0,
      },
      { expand: 'feira' },
    )) as unknown as FeiraCusto
    await recordAudit('criar_custo_feira', created.id, null, created)
    return created
  },

  async updateCusto(id: string, data: Partial<FeiraCusto>): Promise<FeiraCusto> {
    const before = (await pb
      .collection('feira_custos')
      .getOne(id, { expand: 'feira' })) as unknown as FeiraCusto
    const updated = (await pb
      .collection('feira_custos')
      .update(id, data, { expand: 'feira' })) as unknown as FeiraCusto
    await recordAudit('editar_custo_feira', id, before, updated)
    return updated
  },

  async deleteCusto(id: string): Promise<boolean> {
    const before = (await pb.collection('feira_custos').getOne(id)) as unknown as FeiraCusto
    const deleted = await pb.collection('feira_custos').delete(id)
    if (deleted) await recordAudit('remover_custo_feira', id, before, null)
    return deleted
  },

  async getResultados(feiraId?: string): Promise<FeiraResultado[]> {
    const filter = feiraId ? `feira = '${feiraId}'` : undefined
    return (await pb.collection('feira_resultados').getFullList({
      filter,
      sort: '-data_resultado,-created',
      expand: 'feira',
    })) as unknown as FeiraResultado[]
  },

  async createResultado(data: FeiraResultInput): Promise<FeiraResultado> {
    const payload: Record<string, unknown> = {
      ...data,
      quantidade: data.quantidade ?? 0,
      valor_venda: data.valor_venda ?? 0,
    }
    if (!data.pedido_arquivo) delete payload.pedido_arquivo
    const created = (await pb.collection('feira_resultados').create(payload, {
      expand: 'feira',
    })) as unknown as FeiraResultado
    await recordAudit('criar_resultado_feira', created.id, null, created)
    return created
  },

  async updateResultado(id: string, data: FeiraResultUpdateInput): Promise<FeiraResultado> {
    const before = (await pb
      .collection('feira_resultados')
      .getOne(id, { expand: 'feira' })) as unknown as FeiraResultado
    const payload: Record<string, unknown> = { ...data }
    if (!data.pedido_arquivo) delete payload.pedido_arquivo
    const updated = (await pb
      .collection('feira_resultados')
      .update(id, payload, { expand: 'feira' })) as unknown as FeiraResultado
    await recordAudit('editar_resultado_feira', id, before, updated)
    return updated
  },

  async deleteResultado(id: string): Promise<boolean> {
    const before = (await pb.collection('feira_resultados').getOne(id)) as unknown as FeiraResultado
    const deleted = await pb.collection('feira_resultados').delete(id)
    if (deleted) await recordAudit('remover_resultado_feira', id, before, null)
    return deleted
  },

  async getArquivos(feiraId?: string): Promise<FeiraArquivo[]> {
    const filter = feiraId ? `feira = '${feiraId}'` : undefined
    return (await pb.collection('feira_arquivos').getFullList({
      filter,
      sort: '-created',
      expand: 'feira',
    })) as unknown as FeiraArquivo[]
  },

  async createArquivo(data: FeiraFileInput): Promise<FeiraArquivo> {
    const payload: Record<string, unknown> = { ...data }
    delete payload.arquivo
    if (data.arquivo) payload.arquivo = data.arquivo
    const created = (await pb.collection('feira_arquivos').create(payload, {
      expand: 'feira',
    })) as unknown as FeiraArquivo
    await recordAudit('importar_arquivo_feira', created.id, null, {
      ...created,
      arquivo: data.nome_arquivo,
    })
    return created
  },

  async updateArquivo(id: string, data: Partial<FeiraArquivo>): Promise<FeiraArquivo> {
    const before = (await pb
      .collection('feira_arquivos')
      .getOne(id, { expand: 'feira' })) as unknown as FeiraArquivo
    const updated = (await pb
      .collection('feira_arquivos')
      .update(id, data, { expand: 'feira' })) as unknown as FeiraArquivo
    await recordAudit('editar_arquivo_feira', id, before, updated)
    return updated
  },

  async deleteArquivo(id: string): Promise<boolean> {
    const before = (await pb.collection('feira_arquivos').getOne(id)) as unknown as FeiraArquivo
    const deleted = await pb.collection('feira_arquivos').delete(id)
    if (deleted) await recordAudit('remover_arquivo_feira', id, before, null)
    return deleted
  },
}
