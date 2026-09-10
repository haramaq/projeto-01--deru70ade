export type UserRole = 'admin' | 'vendedor' | 'suporte'

export interface User {
  id: string
  email: string
  name: string
  avatar?: string
  role: UserRole
  created: string
  updated: string
}

export type ClienteStatus = 'ativo' | 'inativo'

export interface Cliente {
  id: string
  nome: string
  empresa?: string
  cnpj?: string
  email?: string
  telefone?: string
  cidade?: string
  estado?: string
  status: ClienteStatus
  observacoes?: string
  created: string
  updated: string
}

export type RevendaStatus = 'autorizada' | 'pendente'
export type ProdutoModelo = 'PROHMIX' | 'SUPERMIX'

export interface Revenda {
  id: string
  nome: string
  cnpj?: string
  cidade?: string
  estado?: string
  telefone?: string
  contato_principal?: string
  email?: string
  modelos: ProdutoModelo[]
  status: RevendaStatus
  observacoes?: string
  created: string
  updated: string
}

export type VendaEtapa = 'prospeccao' | 'orcamento' | 'negociacao' | 'fechamento'

export interface Venda {
  id: string
  cliente: string // ID
  produto: ProdutoModelo
  valor: number
  etapa: VendaEtapa
  probabilidade: number
  data_prevista_fechamento?: string
  vendedor?: string // ID
  proxima_acao?: string
  created: string
  updated: string
  expand?: {
    cliente?: Cliente
    vendedor?: User
  }
}

export type TicketPrioridade = 'baixa' | 'media' | 'alta'
export type TicketStatus = 'aberto' | 'finalizado' | 'fechado'

export interface TicketResposta {
  autor: string
  data: string
  mensagem: string
}

export interface Ticket {
  id: string
  cliente: string // ID
  assunto: string
  descricao?: string
  prioridade: TicketPrioridade
  status: TicketStatus
  atribuido_a?: string // ID
  respostas?: TicketResposta[]
  created: string
  updated: string
  expand?: {
    cliente?: Cliente
    atribuido_a?: User
  }
}
