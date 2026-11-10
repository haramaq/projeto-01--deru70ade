// RoteiroEditor.tsx — Editor de perguntas, obrigatoriedade e regras de classificação
// SPEC-2-001 / CA-2-01 — Interface administrativa de roteiros
// Corrigido: condições E/OU alinhadas ao contrato de classificar_lead.js

import React, { useState } from 'react'
import { Plus, Trash2, Save, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { RoteiroPergunta, RoteiroRegra, RoteiroConteudo } from '@/services/roteiroService'

interface RoteiroEditorProps {
  conteudoInicial?: RoteiroConteudo
  onPublicar: (conteudo: RoteiroConteudo) => Promise<void>
  disabled?: boolean
}

export const RoteiroEditor: React.FC<RoteiroEditorProps> = ({
  conteudoInicial,
  onPublicar,
  disabled,
}) => {
  const [perguntas, setPerguntas] = useState<RoteiroPergunta[]>(conteudoInicial?.perguntas || [])
  const [regras, setRegras] = useState<RoteiroRegra[]>(conteudoInicial?.regras_classificacao || [])
  const [publicando, setPublicando] = useState(false)
  const [erros, setErros] = useState<string[]>([])

  const adicionarPergunta = () => {
    const novaOrdem = perguntas.length + 1
    setPerguntas([
      ...perguntas,
      {
        id: `q${String(novaOrdem).padStart(3, '0')}`,
        ordem: novaOrdem,
        texto: '',
        tipo_resposta: 'texto',
        campo_destino: '',
        obrigatoria: false,
      },
    ])
  }

  const removerPergunta = (index: number) => {
    setPerguntas(perguntas.filter((_, i) => i !== index))
  }

  const atualizarPergunta = (index: number, campo: keyof RoteiroPergunta, valor: unknown) => {
    const novas = [...perguntas]
    novas[index] = { ...novas[index], [campo]: valor }
    setPerguntas(novas)
  }

  const adicionarRegra = () => {
    setRegras([...regras, { operador: 'E', estado: '', condicoes: [] }])
  }

  const removerRegra = (index: number) => {
    setRegras(regras.filter((_, i) => i !== index))
  }

  const atualizarRegra = (index: number, campo: keyof RoteiroRegra, valor: unknown) => {
    const novas = [...regras]
    novas[index] = { ...novas[index], [campo]: valor }
    setRegras(novas)
  }

  const adicionarCondicao = (regraIndex: number) => {
    const novas = [...regras]
    novas[regraIndex] = {
      ...novas[regraIndex],
      condicoes: [
        ...novas[regraIndex].condicoes,
        { pergunta_id: '', valor: '', preenchida: false },
      ],
    }
    setRegras(novas)
  }

  const removerCondicao = (regraIndex: number, condIndex: number) => {
    const novas = [...regras]
    novas[regraIndex] = {
      ...novas[regraIndex],
      condicoes: novas[regraIndex].condicoes.filter((_, i) => i !== condIndex),
    }
    setRegras(novas)
  }

  const atualizarCondicao = (
    regraIndex: number,
    condIndex: number,
    campo: string,
    valor: unknown,
  ) => {
    const novas = [...regras]
    const condicoes = [...novas[regraIndex].condicoes]
    condicoes[condIndex] = { ...condicoes[condIndex], [campo]: valor }
    novas[regraIndex] = { ...novas[regraIndex], condicoes }
    setRegras(novas)
  }

  // Validação local antes do envio (não substitui validação server-side)
  const validarConteudo = (): string[] => {
    const erros: string[] = []

    if (perguntas.length === 0) {
      erros.push('O roteiro deve ter pelo menos uma pergunta.')
    }

    for (let i = 0; i < perguntas.length; i++) {
      const p = perguntas[i]
      if (!p.id) erros.push(`Pergunta ${i + 1}: ID ausente.`)
      if (!p.texto) erros.push(`Pergunta ${p.id || i + 1}: texto ausente.`)
      if (!p.campo_destino) erros.push(`Pergunta ${p.id || i + 1}: campo_destino ausente.`)
    }

    // Verificar IDs duplicados
    const ids = perguntas.map((p) => p.id)
    const duplicados = ids.filter((id, i) => ids.indexOf(id) !== i)
    if (duplicados.length > 0) {
      erros.push(`IDs de pergunta duplicados: ${duplicados.join(', ')}`)
    }

    // Validar regras
    for (let i = 0; i < regras.length; i++) {
      const r = regras[i]
      if (!r.estado) erros.push(`Regra ${i + 1}: estado resultante ausente.`)
      if (r.operador !== 'DEFAULT' && r.condicoes.length === 0) {
        erros.push(`Regra ${i + 1} (${r.operador}): deve ter pelo menos uma condição.`)
      }
      for (let j = 0; j < r.condicoes.length; j++) {
        const c = r.condicoes[j]
        if (!c.pergunta_id) {
          erros.push(`Regra ${i + 1}, condição ${j + 1}: pergunta_id ausente.`)
        } else if (!perguntas.some((p) => p.id === c.pergunta_id)) {
          erros.push(
            `Regra ${i + 1}, condição ${j + 1}: pergunta_id "${c.pergunta_id}" não corresponde a nenhuma pergunta cadastrada.`,
          )
        }
      }
    }

    return erros
  }

  const handlePublicar = async () => {
    const errosValidacao = validarConteudo()
    setErros(errosValidacao)
    if (errosValidacao.length > 0) return

    setPublicando(true)
    try {
      await onPublicar({ perguntas, regras_classificacao: regras })
    } finally {
      setPublicando(false)
    }
  }

  return (
    <div className="space-y-4">
      {erros.length > 0 && (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-red-800 font-medium mb-2">
              <AlertTriangle className="h-4 w-4" />
              Corrija os seguintes erros antes de publicar:
            </div>
            <ul className="text-sm text-red-700 list-disc pl-5">
              {erros.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Perguntas do Roteiro</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {perguntas.map((p, i) => (
            <div key={i} className="flex items-center gap-2 border rounded-lg p-3">
              <span className="text-sm font-mono text-slate-500 w-12">{p.id}</span>
              <Input
                placeholder="Texto da pergunta"
                value={p.texto}
                onChange={(e) => atualizarPergunta(i, 'texto', e.target.value)}
                className="flex-1"
                disabled={disabled}
              />
              <Input
                placeholder="campo_destino (ex: vendas.produto)"
                value={p.campo_destino}
                onChange={(e) => atualizarPergunta(i, 'campo_destino', e.target.value)}
                className="w-48"
                disabled={disabled}
              />
              <Select
                value={p.tipo_resposta}
                onValueChange={(v) => atualizarPergunta(i, 'tipo_resposta', v)}
                disabled={disabled}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="texto">Texto</SelectItem>
                  <SelectItem value="select">Seleção</SelectItem>
                  <SelectItem value="numero">Número</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1">
                <Switch
                  checked={p.obrigatoria}
                  onCheckedChange={(v) => atualizarPergunta(i, 'obrigatoria', v)}
                  disabled={disabled}
                />
                <span className="text-xs text-slate-500">Obrig.</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removerPergunta(i)}
                disabled={disabled}
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          ))}
          <Button variant="outline" onClick={adicionarPergunta} disabled={disabled}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar pergunta
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Regras de Classificação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {regras.map((r, i) => (
            <div key={i} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Select
                  value={r.operador}
                  onValueChange={(v) => atualizarRegra(i, 'operador', v)}
                  disabled={disabled}
                >
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="E">Todas (E)</SelectItem>
                    <SelectItem value="OU">Qualquer (OU)</SelectItem>
                    <SelectItem value="DEFAULT">Padrão</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Estado resultante"
                  value={r.estado}
                  onChange={(e) => atualizarRegra(i, 'estado', e.target.value)}
                  className="flex-1"
                  disabled={disabled}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removerRegra(i)}
                  disabled={disabled}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>

              {r.operador !== 'DEFAULT' && (
                <div className="pl-4 space-y-2 border-l-2 border-slate-200">
                  {r.condicoes.map((c, j) => (
                    <div key={j} className="flex items-center gap-2">
                      <Select
                        value={c.pergunta_id}
                        onValueChange={(v) => atualizarCondicao(i, j, 'pergunta_id', v)}
                        disabled={disabled}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="Pergunta" />
                        </SelectTrigger>
                        <SelectContent>
                          {perguntas.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.id} — {p.texto?.slice(0, 30) || 'Sem texto'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="Valor esperado (opcional)"
                        value={c.valor}
                        onChange={(e) => atualizarCondicao(i, j, 'valor', e.target.value)}
                        className="flex-1"
                        disabled={disabled}
                      />
                      <div className="flex items-center gap-1">
                        <Switch
                          checked={c.preenchida || false}
                          onCheckedChange={(v) => atualizarCondicao(i, j, 'preenchida', v)}
                          disabled={disabled}
                        />
                        <span className="text-xs text-slate-500">Preench.</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removerCondicao(i, j)}
                        disabled={disabled}
                      >
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => adicionarCondicao(i)}
                    disabled={disabled}
                  >
                    <Plus className="h-3 w-3 mr-1" /> Adicionar condição
                  </Button>
                </div>
              )}
            </div>
          ))}
          <Button variant="outline" onClick={adicionarRegra} disabled={disabled}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar regra
          </Button>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={handlePublicar}
          disabled={disabled || publicando || perguntas.length === 0}
        >
          <Save className="h-4 w-4 mr-1" />
          {publicando ? 'Publicando…' : 'Publicar nova versão'}
        </Button>
      </div>
    </div>
  )
}
