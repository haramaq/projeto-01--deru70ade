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
    const now = new Date().toISOString()
    const updated = (await pb.collection('vendas').update(
      id,
      {
        vendedor: target.id,
        carteira: target.carteira || '',
      },
      { expand: 'cliente,vendedor' },
    )) as unknown as Venda
    await pb.collection('lead_historico').create({
      lead_id: id,
      etapa_anterior: current.etapa,
      etapa_nova: current.etapa,
      responsavel: target.id,
      data_hora: now,
      tipo_evento: 'transferencia',
      usuario_origem: actorId,
      usuario_destino: target.id,
      observacao: `Transferido da carteira ${current.carteira || 'não definida'} para ${target.carteira || 'não definida'}.`,
    })
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
        'id,name,email,role,carteira,ativo,created,updated,perm_dashboard,perm_leads,perm_clientes,perm_revendas,perm_suporte,perm_relatorios,perm_configuracoes',
    })) as unknown as User[]
  },
  async getTransferTargets(): Promise<TransferTarget[]> {
    return (await pb.collection('users').getFullList({
      sort: 'name',
      fields: 'id,name,email,role,carteira,ativo',
      filter: 'ativo = true',
    })) as unknown as TransferTarget[]
  },
  async create(data: {
    email: string
    password: string
    passwordConfirm: string
    name: string
    role: string
    carteira?: string
    ativo?: boolean
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
