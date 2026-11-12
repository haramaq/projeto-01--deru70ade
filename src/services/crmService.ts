import pb from '@/lib/pocketbase/client'
import type {
  Cliente,
  Revenda,
  Venda,
  Ticket,
  User,
  TicketResposta,
  LeadEtapa,
  LeadHistorico,
  LeadTarefa,
  StatusMotivo,
  AuditEntry,
} from '@/types/crm'

type TransferTarget = Pick<User, 'id' | 'name' | 'email' | 'role' | 'carteira' | 'ativo'>

type AuditPayload = {
  autor: string
  alvo: string
  acao: string
  antes?: unknown
  depois?: unknown
}

export const auditService = {
  async record(data: AuditPayload): Promise<AuditEntry | null> {
    try {
      return (await pb.collection('auditoria_acesso').create(data)) as unknown as AuditEntry
    } catch (error) {
      console.warn('Não foi possível registrar auditoria', error)
      return null
    }
  },
}

export const clienteService = {
  async getAll(search?: string): Promise<Cliente[]> {
    let filter = ''
    if (search && search.trim()) {
      const q = search.trim().replace(/'/g, "\\'")
      filter = `nome ~ '${q}' || empresa ~ '${q}' || cnpj ~ '${q}' || cidade ~ '${q}'`
    }
    return (await pb.collection('clientes').getFullList({
      filter: filter || undefined,
      sort: '-created',
    })) as unknown as Cliente[]
  },

  async getById(id: string): Promise<Cliente> {
    return (await pb.collection('clientes').getOne(id)) as unknown as Cliente
  },

  async create(data: Partial<Cliente>): Promise<Cliente> {
    const created = (await pb.collection('clientes').create(data)) as unknown as Cliente
    await auditService.record({
      autor: pb.authStore.record?.id || 'sessão atual',
      alvo: created.id,
      acao: 'criar_cliente',
      antes: null,
      depois: created,
    })
    return created
  },

  async update(id: string, data: Partial<Cliente>): Promise<Cliente> {
    const before = await this.getById(id)
    const updated = (await pb.collection('clientes').update(id, data)) as unknown as Cliente
    await auditService.record({
      autor: pb.authStore.record?.id || 'sessão atual',
      alvo: id,
      acao: 'editar_cliente',
      antes: before,
      depois: updated,
    })
    return updated
  },

  async delete(id: string): Promise<boolean> {
    const current = await this.getById(id)
    const deleted = await pb.collection('clientes').delete(id)
    if (deleted) {
      await auditService.record({
        autor: pb.authStore.record?.id || 'sessão atual',
        alvo: id,
        acao: 'remover_cliente',
        antes: current,
        depois: null,
      })
    }
    return deleted
  },

  async transfer(id: string, target: TransferTarget): Promise<Cliente> {
    const current = await this.getById(id)
    const updated = (await pb.collection('clientes').update(id, {
      responsavel: target.id,
      responsavel_usuario: target.id,
      carteira: target.carteira || '',
    })) as unknown as Cliente
    await auditService.record({
      autor: pb.authStore.record?.id || 'sessão atual',
      alvo: id,
      acao: 'transferir_cliente',
      antes: { responsavel: current.responsavel, carteira: current.carteira || '' },
      depois: {
        responsavel: target.id,
        carteira: target.carteira || '',
        usuario_destino: target.id,
      },
    })
    return updated
  },
}

export const revendaService = {
  async getAll(search?: string): Promise<Revenda[]> {
    let filter = ''
    if (search && search.trim()) {
      const q = search.trim().replace(/'/g, "\\'")
      filter = `nome ~ '${q}' || cidade ~ '${q}' || cnpj ~ '${q}'`
    }
    return (await pb.collection('revendas').getFullList({
      filter: filter || undefined,
      sort: 'nome',
    })) as unknown as Revenda[]
  },
  async getById(id: string): Promise<Revenda> {
    return (await pb.collection('revendas').getOne(id)) as unknown as Revenda
  },
  async create(data: Partial<Revenda>): Promise<Revenda> {
    const created = (await pb.collection('revendas').create({
      ...data,
      tipo_cadastro: 'revenda',
      documento_tipo: 'cnpj',
    })) as unknown as Revenda
    await auditService.record({
      autor: pb.authStore.record?.id || 'sessão atual',
      alvo: created.id,
      acao: 'criar_revenda',
      antes: null,
      depois: created,
    })
    return created
  },
  async update(id: string, data: Partial<Revenda>): Promise<Revenda> {
    const before = await this.getById(id)
    const updated = (await pb.collection('revendas').update(id, data)) as unknown as Revenda
    await auditService.record({
      autor: pb.authStore.record?.id || 'sessão atual',
      alvo: id,
      acao: 'editar_revenda',
      antes: before,
      depois: updated,
    })
    return updated
  },
  async delete(id: string): Promise<boolean> {
    const current = await this.getById(id)
    const deleted = await pb.collection('revendas').delete(id)
    if (deleted) {
      await auditService.record({
        autor: pb.authStore.record?.id || 'sessão atual',
        alvo: id,
        acao: 'remover_revenda',
        antes: current,
        depois: null,
      })
    }
    return deleted
  },

  async transfer(id: string, target: TransferTarget): Promise<Revenda> {
    const current = await this.getById(id)
    const updated = (await pb.collection('revendas').update(id, {
      responsavel: target.id,
      responsavel_usuario: target.id,
      carteira: target.carteira || '',
    })) as unknown as Revenda
    await auditService.record({
      autor: pb.authStore.record?.id || 'sessão atual',
      alvo: id,
      acao: 'transferir_revenda',
      antes: { responsavel: current.responsavel || '', carteira: current.carteira || '' },
      depois: {
        responsavel: target.id,
        carteira: target.carteira || '',
        usuario_destino: target.id,
      },
    })
    return updated
  },
}

const TERMINAL_STAGES: LeadEtapa[] = [
  'arquivado_nao_retorna',
  'perdido_concorrencia',
  'convertido_pedido',
]

export const vendaService = {
  async getAll(): Promise<Venda[]> {
    return (await pb.collection('vendas').getFullList({
      sort: '-created',
      expand: 'cliente,vendedor',
    })) as unknown as Venda[]
  },

  async getByCliente(clienteId: string): Promise<Venda[]> {
    return (await pb.collection('vendas').getFullList({
      filter: `cliente = '${clienteId}'`,
      sort: '-created',
      expand: 'cliente,vendedor',
    })) as unknown as Venda[]
  },

  async getById(id: string): Promise<Venda> {
    return (await pb.collection('vendas').getOne(id, {
      expand: 'cliente,vendedor',
    })) as unknown as Venda
  },

  async create(data: Partial<Venda>): Promise<Venda> {
    const now = new Date()
    const stage = data.etapa || 'agendamento_primeiro_contato'
    const created = (await pb.collection('vendas').create(
      {
        ...data,
        numero_lead: data.numero_lead || `LEAD-${Date.now().toString().slice(-8)}`,
        produto: data.produto || 'PROHMIX',
        valor: data.valor ?? 0,
        probabilidade: data.probabilidade ?? 0,
        etapa: stage,
        status_lead: data.status_lead || 'em_andamento',
        nivel_interesse: data.nivel_interesse || 3,
        data_solicitacao: data.data_solicitacao || now.toISOString(),
        etapa_atual_desde: data.etapa_atual_desde || now.toISOString(),
        prazo_etapa_em:
          data.prazo_etapa_em || new Date(now.getTime() + 24 * 3600 * 1000).toISOString(),
        altforce_sync_status: data.altforce_sync_status || 'not_connected',
      },
      { expand: 'cliente,vendedor' },
    )) as unknown as Venda
    await auditService.record({
      autor: pb.authStore.record?.id || 'sessão atual',
      alvo: created.id,
      acao: 'criar_lead',
      antes: null,
      depois: created,
    })
    return created
  },

  async update(id: string, data: Partial<Venda>): Promise<Venda> {
    const before = await this.getById(id)
    const updated = (await pb.collection('vendas').update(id, data, {
      expand: 'cliente,vendedor',
    })) as unknown as Venda
    await auditService.record({
      autor: pb.authStore.record?.id || 'sessão atual',
      alvo: id,
      acao: 'editar_lead',
      antes: before,
      depois: updated,
    })
    return updated
  },

  async updateEtapa(id: string, etapa: LeadEtapa, motivo?: StatusMotivo): Promise<Venda> {
    if (TERMINAL_STAGES.includes(etapa) && !motivo?.codigo) {
      throw new Error('Selecione um motivo antes de mover o lead para uma etapa de encerramento.')
    }

    const current = await this.getById(id)
    const now = new Date()
    const statusLead =
      etapa === 'arquivado_nao_retorna'
        ? 'arquivado'
        : etapa === 'perdido_concorrencia'
          ? 'perdido'
          : etapa === 'convertido_pedido'
            ? 'convertido_pedido'
            : 'em_andamento'

    const updated = (await pb.collection('vendas').update(
      id,
      {
        etapa,
        status_lead: statusLead,
        status_motivo_codigo: motivo?.codigo || '',
        status_motivo_descricao: motivo?.descricao || '',
        etapa_atual_desde: now.toISOString(),
        prazo_etapa_em: new Date(now.getTime() + 24 * 3600 * 1000).toISOString(),
        altforce_stage_name: etapa,
        altforce_sync_status: 'not_connected',
      },
      { expand: 'cliente,vendedor' },
    )) as unknown as Venda

    try {
      await pb.collection('lead_historico').create({
        lead_id: id,
        etapa_anterior: current.etapa,
        etapa_nova: etapa,
        motivo_codigo: motivo?.codigo || '',
        motivo_descricao: motivo?.descricao || '',
        responsavel: current.vendedor || '',
        data_hora: now.toISOString(),
        tipo_evento: 'movimentacao_etapa',
      })
    } catch (error) {
      console.warn('Não foi possível registrar histórico do lead', error)
    }
    await auditService.record({
      autor: pb.authStore.record?.id || 'sessão atual',
      alvo: id,
      acao: 'movimentar_lead',
      antes: { etapa: current.etapa },
      depois: { etapa, motivo: motivo?.codigo || '' },
    })

    return updated
  },

  async transfer(id: string, target: TransferTarget): Promise<Venda> {
    const current = await this.getById(id)
    const actorId = pb.authStore.record?.id || ''
    const updated = (await pb.collection('vendas').update(
      id,
      {
        vendedor: target.id,
        carteira: target.carteira || '',
      },
      { expand: 'cliente,vendedor' },
    )) as unknown as Venda
    // Auditoria da transferência é GRAVADA PELO SERVIDOR (hook transferencia_historico_atomico):
    // toda reatribuição de vendedor gera lead_historico automaticamente. O frontend NÃO cria
    // mais o registro — criação duplicada violaria a regra única de auditoria server-side.
    await auditService.record({
      autor: actorId || 'sessão atual',
      alvo: id,
      acao: 'transferir_lead',
      antes: { vendedor: current.vendedor || '', carteira: current.carteira || '' },
      depois: { vendedor: target.id, carteira: target.carteira || '' },
    })
    return updated
  },

  async delete(id: string): Promise<boolean> {
    const current = await this.getById(id)
    const deleted = await pb.collection('vendas').delete(id)
    if (deleted) {
      await auditService.record({
        autor: pb.authStore.record?.id || 'sessão atual',
        alvo: id,
        acao: 'remover_lead',
        antes: current,
        depois: null,
      })
    }
    return deleted
  },

  async getHistorico(leadId: string): Promise<LeadHistorico[]> {
    return (await pb.collection('lead_historico').getFullList({
      filter: `lead_id = '${leadId}'`,
      sort: 'data_hora',
      expand: 'responsavel',
    })) as unknown as LeadHistorico[]
  },

  async getTarefas(leadId: string): Promise<LeadTarefa[]> {
    return (await pb.collection('lead_tarefas').getFullList({
      filter: `lead_id = '${leadId}'`,
      sort: 'created',
    })) as unknown as LeadTarefa[]
  },

  async createTarefa(data: Partial<LeadTarefa>): Promise<LeadTarefa> {
    const created = (await pb.collection('lead_tarefas').create(data)) as unknown as LeadTarefa
    await auditService.record({
      autor: pb.authStore.record?.id || 'sessão atual',
      alvo: created.id,
      acao: 'criar_tarefa_lead',
      antes: null,
      depois: created,
    })
    return created
  },

  async getMotivos(): Promise<StatusMotivo[]> {
    return (await pb.collection('lead_motivos_status').getFullList({
      sort: 'ordem',
    })) as unknown as StatusMotivo[]
  },
}

export const ticketService = {
  async getAll(): Promise<Ticket[]> {
    return (await pb.collection('tickets').getFullList({
      sort: '-created',
      expand: 'cliente,atribuido_a',
    })) as unknown as Ticket[]
  },
  async getByCliente(clienteId: string): Promise<Ticket[]> {
    return (await pb.collection('tickets').getFullList({
      filter: `cliente = '${clienteId}'`,
      sort: '-created',
      expand: 'cliente,atribuido_a',
    })) as unknown as Ticket[]
  },
  async getById(id: string): Promise<Ticket> {
    return (await pb
      .collection('tickets')
      .getOne(id, { expand: 'cliente,atribuido_a' })) as unknown as Ticket
  },
  async create(data: Partial<Ticket>): Promise<Ticket> {
    const created = (await pb
      .collection('tickets')
      .create(
        { ...data, status: data.status || 'aberto', respostas: data.respostas || [] },
        { expand: 'cliente,atribuido_a' },
      )) as unknown as Ticket
    await auditService.record({
      autor: pb.authStore.record?.id || 'sessão atual',
      alvo: created.id,
      acao: 'criar_ticket',
      antes: null,
      depois: created,
    })
    return created
  },
  async update(id: string, data: Partial<Ticket>): Promise<Ticket> {
    const before = await this.getById(id)
    const updated = (await pb
      .collection('tickets')
      .update(id, data, { expand: 'cliente,atribuido_a' })) as unknown as Ticket
    await auditService.record({
      autor: pb.authStore.record?.id || 'sessão atual',
      alvo: id,
      acao: 'editar_ticket',
      antes: before,
      depois: updated,
    })
    return updated
  },
  async addResposta(id: string, resposta: TicketResposta): Promise<Ticket> {
    const ticket = await this.getById(id)
    const updated = (await pb
      .collection('tickets')
      .update(
        id,
        { respostas: [...(ticket.respostas || []), resposta] },
        { expand: 'cliente,atribuido_a' },
      )) as unknown as Ticket
    await auditService.record({
      autor: pb.authStore.record?.id || 'sessão atual',
      alvo: id,
      acao: 'responder_ticket',
      antes: { respostas: ticket.respostas || [] },
      depois: { respostas: updated.respostas || [] },
    })
    return updated
  },
  async toggleStatus(id: string, currentStatus: Ticket['status']): Promise<Ticket> {
    const nextStatus = currentStatus === 'aberto' ? 'finalizado' : 'aberto'
    return (await pb
      .collection('tickets')
      .update(id, { status: nextStatus }, { expand: 'cliente,atribuido_a' })) as unknown as Ticket
  },
  async countOpen(): Promise<number> {
    const records = await pb.collection('tickets').getList(1, 1, { filter: "status = 'aberto'" })
    return records.totalItems
  },
}

export const userService = {
  async getAll(): Promise<User[]> {
    return (await pb.collection('users').getFullList({
      sort: 'name',
      fields:
        'id,name,email,role,carteira,ativo,created,updated,perm_dashboard,perm_leads,perm_clientes,perm_revendas,perm_suporte,perm_relatorios,perm_configuracoes,external_id_altforce,senha_provisoria,altforce_sync_status',
    })) as unknown as User[]
  },
  async getTransferTargets(): Promise<TransferTarget[]> {
    // Rota server-side (listar_alvos_transferencia): devolve id/name/role de vendedores,
    // revendedores e triagem ATIVOS — funciona para TODOS os perfis (a listRule de users
    // esconde a coleção de vendedores; a transferência em si continua validada pelo hook
    // transferencia_historico_atomico + updateRule da 0031).
    try {
      const resposta = (await pb.send('/backend/v1/vendedores/alvos-transferencia', {})) as {
        alvos?: Array<{ id: string; name: string; role: string }>
      }
      return (resposta.alvos || []).map((a) => ({
        id: a.id,
        name: a.name,
        email: '',
        role: a.role as TransferTarget['role'],
        carteira: '',
        ativo: true,
      }))
    } catch {
      // Fallback (admin/gestor veem a coleção completa):
      return (await pb.collection('users').getFullList({
        sort: 'name',
        fields: 'id,name,email,role,carteira,ativo',
        filter: 'ativo = true',
      })) as unknown as TransferTarget[]
    }
  },

  /** Resolve nomes por IDs via rota server-side — SOMENTE participantes de transferência do
   * lead informado (o acesso ao lead é validado server-side pela matriz da 0031). Inativos
   * históricos são resolvidos; IDs sem vínculo com o lead não retornam nome. */
  async getNomesUsuarios(leadId: string, ids: string[]): Promise<Record<string, string>> {
    if (!leadId || !ids.length) return {}
    const lista = Array.from(new Set(ids.filter(Boolean))).slice(0, 50)
    const resposta = (await pb.send(
      `/backend/v1/vendedores/alvos-transferencia?ids=${encodeURIComponent(lista.join(','))}&lead=${encodeURIComponent(leadId)}`,
      {},
    )) as { nomes?: Record<string, string> }
    return resposta.nomes || {}
  },
  async create(data: {
    email: string
    password: string
    passwordConfirm: string
    name: string
    role: string
    carteira?: string
    ativo?: boolean
    external_id_altforce?: string
    altforce_sync_status?: 'nao_vinculado' | 'pendente_validacao' | 'validado'
    perm_dashboard?: boolean
    perm_leads?: boolean
    perm_clientes?: boolean
    perm_revendas?: boolean
    perm_suporte?: boolean
    perm_relatorios?: boolean
    perm_configuracoes?: boolean
    permissoes?: Record<string, boolean>
  }): Promise<User> {
    return (await pb.collection('users').create(data)) as unknown as User
  },
  async update(id: string, data: Partial<User>): Promise<User> {
    return (await pb.collection('users').update(id, data)) as unknown as User
  },
  async delete(id: string): Promise<boolean> {
    return await pb.collection('users').delete(id)
  },
  async excluirVendedor(id: string): Promise<{ ok: boolean; vinculos_removidos: number }> {
    return (await pb.send('/backend/v1/usuarios/excluir-vendedor', {
      method: 'POST',
      body: { id },
    })) as unknown as { ok: boolean; vinculos_removidos: number }
  },
  async deactivate(id: string): Promise<User> {
    return (await pb.collection('users').update(id, { ativo: false })) as unknown as User
  },
  async getAudit(filter?: string): Promise<AuditEntry[]> {
    return (await pb.collection('auditoria_acesso').getFullList({
      filter: filter || undefined,
      sort: '-created',
    })) as unknown as AuditEntry[]
  },

  async audit(data: {
    autor: string
    alvo: string
    acao: string
    antes: unknown
    depois: unknown
  }) {
    return pb.collection('auditoria_acesso').create(data)
  },
}

export interface VendedorDdd {
  id: string
  usuario_id: string
  ddi: string
  ddd: string
  ativo: boolean
  observacao?: string
  created?: string
  updated?: string
}

export const dddService = {
  async listByUser(usuarioId: string): Promise<VendedorDdd[]> {
    return (await pb.collection('vendedor_ddd').getFullList({
      filter: `usuario_id = "${usuarioId}"`,
    })) as unknown as VendedorDdd[]
  },
  async create(data: {
    usuario_id: string
    ddi: string
    ddd: string
    ativo?: boolean
    confirmado_por?: string
    observacao?: string
  }): Promise<VendedorDdd> {
    return (await pb.collection('vendedor_ddd').create(data)) as unknown as VendedorDdd
  },
  async update(
    id: string,
    data: { ddd?: string; ddi?: string; ativo?: boolean; observacao?: string },
  ): Promise<VendedorDdd> {
    return (await pb.collection('vendedor_ddd').update(id, data)) as unknown as VendedorDdd
  },
  async remove(id: string): Promise<void> {
    await pb.collection('vendedor_ddd').delete(id)
  },
}

// ===== Territórios comerciais internos HARAMAQ (0033; sem IBGE) =====
export type CidadeAtendida = {
  id: string
  cidade: string
  cidade_normalizada: string
  uf: string
  ativo?: boolean
  observacao?: string
  expand?: Record<string, unknown>
}

export type TerritorioRegiao = {
  id: string
  nome: string
  vendedor_id: string
  ativo?: boolean
  vigente_de?: string
  vigente_ate?: string
  expand?: { vendedor_id?: User }
}

export type TerritorioCidade = {
  id: string
  regiao_id: string
  cidade_id: string
  expand?: { cidade_id?: CidadeAtendida }
}

export type ItemFilaRevisao = {
  id: string
  lead_id: string
  motivo: string
  detalhe?: string
  candidatos?: unknown
  status: 'pendente' | 'resolvida' | 'descartada'
  decidido_por?: string
  decisao?: string
  decidido_em?: string
  expand?: Record<string, unknown>
}

export const normalizarCidade = (t: string): string =>
  String(t || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

export const territorioService = {
  async cidades(search?: string, uf?: string): Promise<CidadeAtendida[]> {
    const filters: string[] = []
    if (search && search.trim()) filters.push(`cidade ~ "${search.trim().replace(/"/g, '')}"`)
    if (uf && uf.trim()) filters.push(`uf = "${uf.trim().toUpperCase()}"`)
    return (await pb.collection('cidades_atendidas').getFullList({
      sort: 'cidade',
      filter: filters.length ? filters.join(' && ') : undefined,
    })) as unknown as CidadeAtendida[]
  },
  async criarCidade(data: {
    cidade: string
    uf: string
    observacao?: string
  }): Promise<CidadeAtendida> {
    const cidade_normalizada = normalizarCidade(data.cidade)
    const ufNormalizada = data.uf.trim().toUpperCase()
    const existentes = (await pb.collection('cidades_atendidas').getFullList({
      filter: `cidade_normalizada = "${cidade_normalizada}" && uf = "${ufNormalizada}"`,
    })) as unknown as CidadeAtendida[]
    if (existentes.length > 0) throw new Error('Cidade já cadastrada para esta UF.')
    return (await pb.collection('cidades_atendidas').create({
      cidade: data.cidade.trim(),
      cidade_normalizada,
      uf: ufNormalizada,
      ativo: true,
      observacao: data.observacao || '',
    })) as unknown as CidadeAtendida
  },
  async alternarCidade(id: string, ativo: boolean): Promise<CidadeAtendida> {
    return (await pb
      .collection('cidades_atendidas')
      .update(id, { ativo })) as unknown as CidadeAtendida
  },

  async regioes(): Promise<TerritorioRegiao[]> {
    return (await pb.collection('territorio_regioes').getFullList({
      sort: 'nome',
      expand: 'vendedor_id',
    })) as unknown as TerritorioRegiao[]
  },
  async criarRegiao(data: { nome: string; vendedor_id: string }): Promise<TerritorioRegiao> {
    return (await pb.collection('territorio_regioes').create({
      nome: data.nome.trim(),
      vendedor_id: data.vendedor_id,
      ativo: true,
    })) as unknown as TerritorioRegiao
  },
  async editarRegiao(
    id: string,
    data: { nome?: string; vendedor_id?: string; ativo?: boolean },
  ): Promise<TerritorioRegiao> {
    return (await pb
      .collection('territorio_regioes')
      .update(id, data)) as unknown as TerritorioRegiao
  },

  async vinculosCidades(): Promise<TerritorioCidade[]> {
    return (await pb.collection('territorio_cidades').getFullList({
      expand: 'cidade_id',
    })) as unknown as TerritorioCidade[]
  },
  async vincularCidade(regiaoId: string, cidadeId: string): Promise<TerritorioCidade> {
    return (await pb.collection('territorio_cidades').create({
      regiao_id: regiaoId,
      cidade_id: cidadeId,
    })) as unknown as TerritorioCidade
  },
  async desvincularCidade(id: string): Promise<void> {
    await pb.collection('territorio_cidades').delete(id)
  },

  async filaRevisao(): Promise<ItemFilaRevisao[]> {
    return (await pb.collection('fila_revisao').getFullList({
      sort: '-created',
      filter: `status = "pendente"`,
    })) as unknown as ItemFilaRevisao[]
  },
  async modoMotor(): Promise<'so_decide' | 'automatico'> {
    try {
      const registros = (await pb.collection('config_motor').getFullList({
        sort: '-updated',
      })) as unknown as Array<{ modo?: string }>
      const modo = registros[0]?.modo
      return modo === 'automatico' ? 'automatico' : 'so_decide'
    } catch {
      return 'so_decide' // sem config → default seguro
    }
  },
  async alternarModoMotor(modo: 'so_decide' | 'automatico'): Promise<void> {
    const registros = (await pb.collection('config_motor').getFullList()) as unknown as Array<{
      id: string
    }>
    const payload = {
      modo,
      atualizado_por: pb.authStore.record?.id || '',
      atualizado_em: new Date().toISOString(),
    }
    if (registros[0]?.id) {
      await pb.collection('config_motor').update(registros[0].id, payload)
    } else {
      await pb.collection('config_motor').create(payload)
    }
  },
  async resolverFila(
    id: string,
    decisao: string,
    status: 'resolvida' | 'descartada',
  ): Promise<ItemFilaRevisao> {
    return (await pb.collection('fila_revisao').update(id, {
      status,
      decisao,
      decidido_por: pb.authStore.record?.id || '',
      decidido_em: new Date().toISOString(),
    })) as unknown as ItemFilaRevisao
  },
}
