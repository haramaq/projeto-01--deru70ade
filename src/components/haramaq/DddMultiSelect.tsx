import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/** DDDs brasileiros válidos (ANATEL), com UF — base para busca no datalist. */
export const DDDS_BRASIL: { ddd: string; ufs: string }[] = [
  { ddd: '11', ufs: 'SP' },
  { ddd: '12', ufs: 'SP' },
  { ddd: '13', ufs: 'SP' },
  { ddd: '14', ufs: 'SP' },
  { ddd: '15', ufs: 'SP' },
  { ddd: '16', ufs: 'SP' },
  { ddd: '17', ufs: 'SP' },
  { ddd: '18', ufs: 'SP' },
  { ddd: '19', ufs: 'SP' },
  { ddd: '21', ufs: 'RJ' },
  { ddd: '22', ufs: 'RJ' },
  { ddd: '24', ufs: 'RJ' },
  { ddd: '27', ufs: 'ES' },
  { ddd: '28', ufs: 'ES' },
  { ddd: '31', ufs: 'MG' },
  { ddd: '32', ufs: 'MG' },
  { ddd: '33', ufs: 'MG' },
  { ddd: '34', ufs: 'MG' },
  { ddd: '35', ufs: 'MG' },
  { ddd: '37', ufs: 'MG' },
  { ddd: '38', ufs: 'MG' },
  { ddd: '41', ufs: 'PR' },
  { ddd: '42', ufs: 'PR' },
  { ddd: '43', ufs: 'PR' },
  { ddd: '44', ufs: 'PR' },
  { ddd: '45', ufs: 'PR' },
  { ddd: '46', ufs: 'PR' },
  { ddd: '47', ufs: 'SC' },
  { ddd: '48', ufs: 'SC' },
  { ddd: '49', ufs: 'SC' },
  { ddd: '51', ufs: 'RS' },
  { ddd: '53', ufs: 'RS' },
  { ddd: '54', ufs: 'RS' },
  { ddd: '55', ufs: 'RS' },
  { ddd: '61', ufs: 'DF' },
  { ddd: '62', ufs: 'GO' },
  { ddd: '63', ufs: 'TO' },
  { ddd: '64', ufs: 'GO' },
  { ddd: '65', ufs: 'MT' },
  { ddd: '66', ufs: 'MT' },
  { ddd: '67', ufs: 'MS' },
  { ddd: '68', ufs: 'AC' },
  { ddd: '69', ufs: 'RO' },
  { ddd: '71', ufs: 'BA' },
  { ddd: '73', ufs: 'BA' },
  { ddd: '74', ufs: 'BA' },
  { ddd: '75', ufs: 'BA' },
  { ddd: '77', ufs: 'BA' },
  { ddd: '79', ufs: 'SE' },
  { ddd: '81', ufs: 'PE' },
  { ddd: '82', ufs: 'AL' },
  { ddd: '83', ufs: 'PB' },
  { ddd: '84', ufs: 'RN' },
  { ddd: '85', ufs: 'CE' },
  { ddd: '86', ufs: 'PI' },
  { ddd: '87', ufs: 'PE' },
  { ddd: '88', ufs: 'CE' },
  { ddd: '89', ufs: 'PI' },
  { ddd: '91', ufs: 'PA' },
  { ddd: '92', ufs: 'AM' },
  { ddd: '93', ufs: 'PA' },
  { ddd: '94', ufs: 'PA' },
  { ddd: '95', ufs: 'RR' },
  { ddd: '96', ufs: 'AP' },
  { ddd: '97', ufs: 'AM' },
  { ddd: '98', ufs: 'MA' },
  { ddd: '99', ufs: 'MA' },
]

interface DddMultiSelectProps {
  valor: string // vírgula, ex.: "51,54"
  onChange: (valor: string) => void
  id?: string
  testId?: string
}

/**
 * Multisseleção de DDDs com busca (datalist ANATEL), chips removíveis e validação
 * (aceita somente DDDs de 2 dígitos presentes na lista ANATEL; entrada livre é
 * mantida como pendência visual, não como vínculo válido).
 */
export function DddMultiSelect({ valor, onChange, id, testId }: DddMultiSelectProps) {
  const [entrada, setEntrada] = useState('')
  const [erro, setErro] = useState('')

  const selecionados = useMemo(
    () =>
      valor
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean),
    [valor],
  )

  const adicionar = (bruto: string) => {
    const partes = bruto
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
    const validos: string[] = []
    const invalidos: string[] = []
    for (const p of partes) {
      if (!/^\d{2}$/.test(p) || !DDDS_BRASIL.some((d) => d.ddd === p)) invalidos.push(p)
      else if (!selecionados.includes(p)) validos.push(p)
    }
    if (invalidos.length) setErro(`DDD inválido: ${invalidos.join(', ')}`)
    else setErro('')
    if (validos.length) onChange([...selecionados, ...validos].join(','))
    setEntrada('')
  }

  const remover = (ddd: string) => {
    onChange(selecionados.filter((d) => d !== ddd).join(','))
  }

  return (
    <div className="space-y-1">
      <Label htmlFor={id}>DDDs de atuação (busque e adicione vários)</Label>
      <div className="flex flex-wrap gap-1" data-testid={testId ? `${testId}-chips` : undefined}>
        {selecionados.map((ddd) => (
          <Badge
            key={ddd}
            variant="secondary"
            className="cursor-pointer"
            onClick={() => remover(ddd)}
            title="Clique para remover"
          >
            {ddd} ×
          </Badge>
        ))}
        {selecionados.length === 0 && <span className="text-[11px] text-gray-400">Nenhum DDD</span>}
      </div>
      <Input
        id={id}
        data-testid={testId}
        list="ddds-anatel"
        value={entrada}
        onChange={(e) => setEntrada(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            adicionar(entrada)
          }
        }}
        onBlur={() => entrada.trim() && adicionar(entrada)}
        placeholder="Digite ou busque o DDD (ex.: 51) e pressione Enter"
      />
      <datalist id="ddds-anatel">
        {DDDS_BRASIL.map((d) => (
          <option key={d.ddd} value={d.ddd}>
            {`DDD ${d.ddd} — ${d.ufs}`}
          </option>
        ))}
      </datalist>
      {erro && <p className="text-[11px] text-red-600">{erro}</p>}
    </div>
  )
}
