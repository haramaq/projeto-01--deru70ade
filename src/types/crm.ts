export type UserRole = 'admin' | 'triagem' | 'vendedor' | 'revendedor' | 'gestor' | 'suporte'

export interface User {
  id: string
  email: string
  name: string
  avatar?: string
  role: UserRole
  ativo: boolean
  carteira?: string
  created: string
  updated: string
}

export type ClienteStatus = 'ativo' | 'inativo'
export type SyncStatus = 'pending' | 'not_connected' | 'synced' | 'error'

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
  origem?: string
  altforce_id?: string
  altforce_sync_status?: SyncStatus
  altforce_last_synced_at?: string
  altforce_payload?: Record<string, unknown>
  campos_customizados?: Record<string, unknown>
  responsavel?: string
  carteira?: string
  created: string
  updated: string
}

export type RevendaStatus = 'autorizada' | 'pendente'
export type ProdutoModelo = 'PROHMIX' | 'SUPERMIX'

export type CategoriaProduto =
  | 'Linha Prohmix'
  | 'Linha Supermix'
  | 'Linha Tipper'
  | 'Vagões Rodoviários'
  | 'Colhedora de forragens'
  | 'Homogeneizador de esterco'
  | 'Revolvedor de cama'

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

export type LeadEtapa =
  | 'agendamento_primeiro_contato'
  | 'em_contato'
  | 'revenda_contato'
  | 'orcamentacao'
  | 'contato_futuro_agendado'
  | 'arquivado_nao_retorna'
  | 'perdido_concorrencia'
  | 'convertido_pedido'
  | 'pecas_pos_vendas'
  | 'financeiro_fiscal'

/** @deprecated Use LeadEtapa; retained to avoid breaking existing modules. */
export type VendaEtapa = LeadEtapa

export type LeadStatus = 'em_andamento' | 'arquivado' | 'perdido' | 'convertido_pedido'
export type NivelInteresse = 1 | 2 | 3 | 4 | 5

export interface StatusMotivo {
  codigo: string
  status?: 'arquivado' | 'perdido' | 'convertido_pedido'
  descricao: string
}

export interface LeadHistorico {
  id: string
  lead_id: string
  etapa_anterior?: LeadEtapa
  etapa_nova: LeadEtapa
  motivo_codigo?: string
  motivo_descricao?: string
  responsavel?: string
  data_hora: string
  observacao?: string
  created?: string
}

export interface LeadTarefa {
  id: string
  lead_id: string
  titulo: string
  equipe?: string
  responsavel?: string
  status: 'pendente' | 'em_andamento' | 'concluida' | 'cancelada'
  prazo?: string
  observacoes?: string
  created?: string
}

export interface Venda {
  id: string
  numero_lead?: string
  cliente: string
  produto?: ProdutoModelo
  categoria_produto?: CategoriaProduto
  valor: number
  etapa: LeadEtapa
  status_lead?: LeadStatus
  status_motivo_codigo?: string
  status_motivo_descricao?: string
  nivel_interesse?: NivelInteresse
  origem_lead?: string
  data_solicitacao?: string
  etapa_atual_desde?: string
  prazo_etapa_em?: string
  observacoes_ia?: string
  equipe?: string
  equipes?: string[]
  responsavel_cargo?: string
  data_prevista_fechamento?: string
  vendedor?: string
  proxima_acao?: string
  probabilidade: number
  origem?: string
  altforce_id?: string
  altforce_stage_id?: string
  altforce_stage_name?: string
  altforce_step_model_id?: string
  altforce_sync_status?: SyncStatus
  altforce_last_synced_at?: string
  altforce_payload?: Record<string, unknown>
  campos_customizados?: Record<string, unknown>
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
  cliente: string
  assunto: string
  descricao?: string
  prioridade: TicketPrioridade
  status: TicketStatus
  atribuido_a?: string
  respostas?: TicketResposta[]
  created: string
  updated: string
  expand?: {
    cliente?: Cliente
    atribuido_a?: User
  }
}
