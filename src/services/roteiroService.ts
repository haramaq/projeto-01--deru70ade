// roteiroService.ts — Serviço para gerenciamento de roteiros de qualificação
// SPEC-2-001 / CA-2-01 — Interface administrativa de roteiros
// Usa o hook existente regras_publicar.js (POST /backend/v1/regras/publicar)
// e a collection regras_versao para leitura do histórico.

import pb from '@/lib/pocketbase/client'

export interface RoteiroPergunta {
  id: string
  ordem: number
  texto: string
  tipo_resposta: 'texto' | 'select' | 'numero'
  campo_destino: string
  obrigatoria: boolean
  validacao?: { min_length?: number; max_length?: number }
  condicao_exibicao?: string | null
  opcoes?: string[]
}

export interface RoteiroRegra {
  operador: 'E' | 'OU' | 'DEFAULT'
  estado: string
  condicoes: Array<{
    pergunta_id: string
    valor?: string
    preenchida?: boolean
  }>
}

export interface RoteiroConteudo {
  perguntas: RoteiroPergunta[]
  regras_classificacao: RoteiroRegra[]
}

export interface RoteiroVersao {
  id: string
  regra_chave: string
  versao: number
  conteudo: RoteiroConteudo
  status: string
  vigente_de: string
  vigente_ate: string
  criado_por: string
  hash_conteudo: string
  created: string
  updated: string
}

const REGRA_CHAVE_QA = 'roteiro:qualificacao:qa'
const REGRA_CHAVE_COMERCIAL = 'roteiro:qualificacao'

/**
 * Lista todas as versões de um roteiro, ordenadas por versão decrescente.
 */
export async function listarVersoes(regraChave: string = REGRA_CHAVE_QA): Promise<RoteiroVersao[]> {
  return pb.collection('regras_versao').getFullList({
    filter: `regra_chave = "${regraChave}"`,
    sort: '-versao',
  }) as Promise<RoteiroVersao[]>
}

/**
 * Retorna a versão vigente de um roteiro (vigente_ate vazio).
 */
export async function obterVersaoVigente(
  regraChave: string = REGRA_CHAVE_QA,
): Promise<RoteiroVersao | null> {
  const versoes = await pb.collection('regras_versao').getFullList({
    filter: `regra_chave = "${regraChave}" && vigente_ate = ""`,
    sort: '-versao',
    perPage: 1,
  })
  return versoes.length > 0 ? (versoes[0] as RoteiroVersao) : null
}

/**
 * Publica uma nova versão do roteiro usando o hook regras_publicar.js.
 * Fecha a versão anterior atomicamente e cria a nova.
 */
export async function publicarRoteiro(
  conteudo: RoteiroConteudo,
  criadoPor: string,
  regraChave: string = REGRA_CHAVE_QA,
): Promise<{ versao: number; versao_id: string; hash_conteudo: string }> {
  const result = await pb.send('/backend/v1/regras/publicar', {
    method: 'POST',
    body: {
      regra_chave: regraChave,
      conteudo,
      criado_por: criadoPor,
    },
  })
  return result as { versao: number; versao_id: string; hash_conteudo: string }
}

export { REGRA_CHAVE_QA, REGRA_CHAVE_COMERCIAL }
