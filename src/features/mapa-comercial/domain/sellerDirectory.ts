/**
 * Diretório de vendedores do Mapa Comercial — integração SEM vínculo automático.
 *
 * Distinção obrigatória (decisões D-7/D-8):
 * - Vendedor do CRM = registro em `users` (role 'vendedor') — identidade real.
 * - Identidade territorial = rótulo do KML (`visualGroupId`/`visualGroupName`) — NUNCA identidade CRM.
 * - A correspondência por nome é SUGESTÃO para revisão humana; homônimos (André×2, Sidnei×2)
 *   permanecem entradas independentes; múltiplos usuários com o mesmo nome = ambíguo (sem match).
 *
 * Cores: preferência LOCAL do navegador (localStorage, chave = visualGroupId) — não é
 * configuração compartilhada e não vai ao banco.
 */
import type { KmlTerritory } from '../kml/parseKml'

export interface CrmSellerRef {
  id: string
  name: string
  role: string
  ativo: boolean
}

export interface SellerDirectoryRow {
  /** Rótulo territorial do KML (visualGroupName). */
  kmlLabel: string
  visualGroupId: string
  territoryCount: number
  /** Correspondência SUGERIDA por nome exato normalizado (revisão humana obrigatória). */
  crmSuggestion: CrmSellerRef | null
  /** true quando o nome sugere match mas há homônimos (2+ territórios ou 2+ usuários com o mesmo nome). */
  homonimo: boolean
}

export function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Monta o diretório: rótulos KML (por visualGroupId) + sugestão de usuário do CRM por nome. */
export function buildSellerDirectory(
  users: readonly CrmSellerRef[],
  territories: readonly KmlTerritory[],
): SellerDirectoryRow[] {
  // territórios agrupados por visualGroupId (homônimos = grupos distintos)
  const grupos = new Map<string, { label: string; count: number }>()
  for (const t of territories) {
    const atual = grupos.get(t.visualGroupId)
    if (atual) atual.count += 1
    else grupos.set(t.visualGroupId, { label: t.visualGroupName, count: 1 })
  }
  // usuários por nome normalizado (para detectar ambiguidade)
  const vendedores = users.filter((u) => u.role === 'vendedor')
  const porNome = new Map<string, CrmSellerRef[]>()
  for (const u of vendedores) {
    const chave = normalizeName(u.name ?? '')
    if (!chave) continue
    porNome.set(chave, [...(porNome.get(chave) ?? []), u])
  }
  const linhas: SellerDirectoryRow[] = []
  for (const [groupId, { label, count }] of grupos) {
    const candidatos = porNome.get(normalizeName(label)) ?? []
    const homonimoTerritorio =
      [...grupos.values()].filter((g) => normalizeName(g.label) === normalizeName(label)).length > 1
    const homonimoUsuario = candidatos.length > 1
    linhas.push({
      kmlLabel: label,
      visualGroupId: groupId,
      territoryCount: count,
      crmSuggestion:
        candidatos.length === 1
          ? {
              id: candidatos[0].id,
              name: candidatos[0].name,
              role: candidatos[0].role,
              ativo: candidatos[0].ativo,
            }
          : null,
      homonimo: homonimoTerritorio || homonimoUsuario,
    })
  }
  return linhas.sort((a, b) => a.kmlLabel.localeCompare(b.kmlLabel, 'pt-BR'))
}

// ===== Persistência local das cores (preferência do navegador) =====

const COLORS_KEY = 'mapa-comercial:cores'

export function loadColorPrefs(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(COLORS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const limpo: Record<string, string> = {}
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)) limpo[k] = v.toLowerCase()
    }
    return limpo
  } catch {
    return {}
  }
}

export function saveColorPref(visualGroupId: string, color: string): void {
  try {
    const atual = loadColorPrefs()
    if (/^#[0-9a-f]{6}$/i.test(color)) {
      atual[visualGroupId] = color.toLowerCase()
      window.localStorage.setItem(COLORS_KEY, JSON.stringify(atual))
    }
  } catch {
    /* localStorage indisponível — preferência apenas de sessão */
  }
}

export function clearColorPref(visualGroupId: string): void {
  try {
    const atual = loadColorPrefs()
    delete atual[visualGroupId]
    window.localStorage.setItem(COLORS_KEY, JSON.stringify(atual))
  } catch {
    /* idem */
  }
}

export function clearColorPrefs(): void {
  try {
    window.localStorage.removeItem(COLORS_KEY)
  } catch {
    /* idem */
  }
}
