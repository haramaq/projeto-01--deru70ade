import pb from '@/lib/pocketbase/client'
import type { Cliente, Revenda, Venda, Ticket, User, TicketResposta } from '@/types/crm'

export const clienteService = {
  async getAll(search?: string): Promise<Cliente[]> {
    let filter = ''
    if (search && search.trim()) {
      const q = search.trim()
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
      const q = search.trim()
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

export const vendaService = {
  async getAll(): Promise<Venda[]> {
    return (await pb.collection('vendas').getFullList({
      sort: '-valor',
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
    return (await pb.collection('vendas').create(data, {
      expand: 'cliente,vendedor',
    })) as unknown as Venda
  },

  async update(id: string, data: Partial<Venda>): Promise<Venda> {
    return (await pb.collection('vendas').update(id, data, {
      expand: 'cliente,vendedor',
    })) as unknown as Venda
  },

  async updateEtapa(id: string, etapa: Venda['etapa']): Promise<Venda> {
    return (await pb
      .collection('vendas')
      .update(id, { etapa }, { expand: 'cliente,vendedor' })) as unknown as Venda
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('vendas').delete(id)
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
    return (await pb.collection('tickets').getOne(id, {
      expand: 'cliente,atribuido_a',
    })) as unknown as Ticket
  },

  async create(data: Partial<Ticket>): Promise<Ticket> {
    return (await pb.collection('tickets').create(
      {
        ...data,
        status: data.status || 'aberto',
        respostas: data.respostas || [],
      },
      {
        expand: 'cliente,atribuido_a',
      },
    )) as unknown as Ticket
  },

  async update(id: string, data: Partial<Ticket>): Promise<Ticket> {
    return (await pb.collection('tickets').update(id, data, {
      expand: 'cliente,atribuido_a',
    })) as unknown as Ticket
  },

  async addResposta(id: string, resposta: TicketResposta): Promise<Ticket> {
    const ticket = await this.getById(id)
    const existingRespostas = ticket.respostas || []
    const updatedRespostas = [...existingRespostas, resposta]
    return (await pb
      .collection('tickets')
      .update(
        id,
        { respostas: updatedRespostas },
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
    const records = await pb.collection('tickets').getList(1, 1, {
      filter: "status = 'aberto'",
    })
    return records.totalItems
  },
}

export const userService = {
  async getAll(): Promise<User[]> {
    return (await pb.collection('users').getFullList({
      sort: 'name',
    })) as unknown as User[]
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

  async delete(id: string): Promise<boolean> {
    return await pb.collection('users').delete(id)
  },
}
