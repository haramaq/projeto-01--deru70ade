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
} from '@/types/crm'

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
    return (await pb.collection('clientes').create(data)) as unknown as Cliente
  },

  async update(id: string, data: Partial<Cliente>): Promise<Cliente> {
    return (await pb.collection('clientes').update(id, data)) as unknown as Cliente
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('clientes').delete(id)
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
    return (await pb.collection('revendas').create(data)) as unknown as Revenda
  },
  async update(id: string, data: Partial<Revenda>): Promise<Revenda> {
    return (await pb.collection('revendas').update(id, data)) as unknown as Revenda
  },
  async delete(id: string): Promise<boolean> {
    return await pb.collection('revendas').delete(id)
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
    return (await pb.collection('vendas').create(
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
  },

  async update(id: string, data: Partial<Venda>): Promise<Venda> {
    return (await pb.collection('vendas').update(id, data, {
      expand: 'cliente,vendedor',
    })) as unknown as Venda
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
      })
    } catch (error) {
      console.warn('Não foi possível registrar histórico do lead', error)
    }

    return updated
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('vendas').delete(id)
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
    return (await pb.collection('lead_tarefas').create(data)) as unknown as LeadTarefa
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
    return (await pb
      .collection('tickets')
      .create(
        { ...data, status: data.status || 'aberto', respostas: data.respostas || [] },
        { expand: 'cliente,atribuido_a' },
      )) as unknown as Ticket
  },
  async update(id: string, data: Partial<Ticket>): Promise<Ticket> {
    return (await pb
      .collection('tickets')
      .update(id, data, { expand: 'cliente,atribuido_a' })) as unknown as Ticket
  },
  async addResposta(id: string, resposta: TicketResposta): Promise<Ticket> {
    const ticket = await this.getById(id)
    return (await pb
      .collection('tickets')
      .update(
        id,
        { respostas: [...(ticket.respostas || []), resposta] },
        { expand: 'cliente,atribuido_a' },
      )) as unknown as Ticket
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
    return (await pb.collection('users').getFullList({ sort: 'name' })) as unknown as User[]
  },
  async create(data: {
    email: string
    password: string
    passwordConfirm: string
    name: string
    role: string
  }): Promise<User> {
    return (await pb.collection('users').create(data)) as unknown as User
  },
  async update(id: string, data: Partial<User>): Promise<User> {
    return (await pb.collection('users').update(id, data)) as unknown as User
  },
  async deactivate(id: string): Promise<User> {
    return (await pb.collection('users').update(id, { ativo: false })) as unknown as User
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
