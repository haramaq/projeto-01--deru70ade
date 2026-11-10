// RoteiroHistorico.tsx — Histórico de versões do roteiro com vigência e hash
// SPEC-2-001 / CA-2-01 — Interface administrativa de roteiros

import React, { useEffect, useState } from 'react'
import { History } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDateBR } from '@/lib/formatters'
import { listarVersoes, type RoteiroVersao } from '@/services/roteiroService'

interface RoteiroHistoricoProps {
  regraChave?: string
  refreshKey?: number
}

export const RoteiroHistorico: React.FC<RoteiroHistoricoProps> = ({
  regraChave = 'roteiro:qualificacao:qa',
  refreshKey,
}) => {
  const [versoes, setVersoes] = useState<RoteiroVersao[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    listarVersoes(regraChave)
      .then(setVersoes)
      .catch((e) => setErro(String(e).slice(0, 200)))
      .finally(() => setLoading(false))
  }, [regraChave, refreshKey])

  if (loading) return <div className="text-sm text-slate-500">Carregando histórico…</div>
  if (erro) return <div className="text-sm text-red-500">Erro: {erro}</div>
  if (versoes.length === 0)
    return <div className="text-sm text-slate-500">Nenhuma versão encontrada.</div>

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Histórico de Versões
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {versoes.map((v) => {
            const vigente = v.vigente_ate === ''
            return (
              <div
                key={v.id}
                className={`border rounded-lg p-3 ${vigente ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">v{v.versao}</span>
                    {vigente ? (
                      <Badge variant="default" className="bg-emerald-100 text-emerald-800">
                        Vigente
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Encerrada</Badge>
                    )}
                  </div>
                  <span className="text-xs text-slate-500">{formatDateBR(v.created)}</span>
                </div>
                <div className="mt-1 text-xs text-slate-600">
                  <span>Criado por: {v.criado_por}</span>
                  {v.vigente_de && (
                    <span className="ml-3">Vigente de: {formatDateBR(v.vigente_de)}</span>
                  )}
                  {v.vigente_ate && (
                    <span className="ml-3">Até: {formatDateBR(v.vigente_ate)}</span>
                  )}
                </div>
                <div className="mt-1 text-xs font-mono text-slate-400">
                  Hash: {v.hash_conteudo?.slice(0, 16)}…
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {v.conteudo?.perguntas?.length || 0} pergunta(s) ·{' '}
                  {v.conteudo?.regras_classificacao?.length || 0} regra(s)
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
