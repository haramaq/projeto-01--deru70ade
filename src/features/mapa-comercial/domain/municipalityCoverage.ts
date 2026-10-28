/**
 * Consulta territorial por município (Lote 3 — preparação L1-C/IBGE).
 *
 * Estratégia (decisões anteriores preservadas):
 * - O KML define territórios POLIGONAIS por vendedor (rótulo visual, nunca identidade CRM).
 * - A consulta usa a COORDENADA OFICIAL do município (dataset real reconciliado com CNEFE/IBGE)
 *   testada contra os polígonos (ray casting, algoritmo padrão even-odd).
 * - Município fora de todo polígono = SEM COBERTURA (sinalizado, nunca atribuído).
 * - Município dentro de 2+ polígonos = CONFLITO (sinalizado para revisão humana, nunca automático).
 * - Nenhuma escrita: consulta pura em memória.
 */
import { MUNICIPIOS, MUNICIPIO_DATASET_META } from '../data/municipios-coordenadas.ts'
import type { KmlTerritory } from '../kml/parseKml'

export interface MunicipalityPoint {
  codigoIbge: string
  nome: string
  uf: string
  lat: number
  lng: number
  normalizedName: string
}

export interface MunicipalityHit {
  municipality: MunicipalityPoint
  /** Territórios (rótulos visuais do KML) cujos polígonos contêm a coordenada do município. */
  territories: Array<{ id: string; label: string; color?: string }>
  status: 'coberto' | 'conflito' | 'sem-cobertura'
}

let cache: MunicipalityPoint[] | null = null

export function loadMunicipalities(): MunicipalityPoint[] {
  if (cache) return cache
  cache = MUNICIPIOS.map(([codigoIbge, nome, uf, lat, lng]) => ({
    codigoIbge,
    nome,
    uf,
    lat,
    lng,
    normalizedName: normalizeName(nome),
  }))
  return cache
}

export function datasetMeta(): { total: number; fonte: string; geradoEm: string } {
  return {
    total: MUNICIPIO_DATASET_META.total,
    fonte: MUNICIPIO_DATASET_META.fonte,
    geradoEm: MUNICIPIO_DATASET_META.gerado_em,
  }
}

function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Ray casting even-odd: ponto dentro de anel. Rings do KML são pares [lng, lat]. */
export function pointInRing(
  lat: number,
  lng: number,
  ring: ReadonlyArray<readonly [number, number]>,
): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0],
      yi = ring[i][1]
    const xj = ring[j][0],
      yj = ring[j][1]
    const intersects = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    if (intersects) inside = !inside
  }
  return inside
}

export function pointInTerritory(lat: number, lng: number, territory: KmlTerritory): boolean {
  for (const polygon of territory.polygons) {
    const outer = polygon.rings[0]
    if (!outer || outer.length < 3) continue
    if (!pointInRing(lat, lng, outer)) continue
    // dentro do anel externo: verificar buracos (anel interno = fora)
    let inHole = false
    for (let h = 1; h < polygon.rings.length; h++) {
      if (pointInRing(lat, lng, polygon.rings[h])) {
        inHole = true
        break
      }
    }
    if (!inHole) return true
  }
  return false
}

/** Consulta principal: município (nome normalizado + UF opcional) OU código IBGE de 7 dígitos (canônico) → vendedores cujos territórios o contêm. */
export function lookupMunicipality(
  query: string,
  territories: readonly KmlTerritory[],
): MunicipalityHit | { error: 'nao-encontrado' | 'ambiguo' } {
  const q = normalizeName(query)
  if (!q) return { error: 'nao-encontrado' }
  const all = loadMunicipalities()
  // código IBGE de 7 dígitos tem prioridade (identidade canônica — decisão D-6)
  const codigoMatch = query.trim().match(/^(\d{7})(\s*,\s*[a-z]{2})?$/i)
  if (codigoMatch) {
    const byCode = all.find((m) => m.codigoIbge === codigoMatch[1])
    if (!byCode) return { error: 'nao-encontrado' }
    return resolveHit(byCode, territories)
  }
  // suporta "nome, UF" ou "nome / UF"
  const match = q.match(/^(.+?)[\s,;/]+([a-z]{2})$/)
  const nomeQ = match ? match[1].trim() : q
  const ufQ = match ? match[2].toUpperCase() : null

  let candidates = ufQ
    ? all.filter((m) => m.uf === ufQ && m.normalizedName === nomeQ)
    : all.filter((m) => m.normalizedName === nomeQ)
  if (candidates.length === 0) {
    // fallback: prefixo (mínimo 3 chars) para nomes parciais
    if (nomeQ.length >= 3) {
      candidates = ufQ
        ? all.filter((m) => m.uf === ufQ && m.normalizedName.startsWith(nomeQ))
        : all.filter((m) => m.normalizedName.startsWith(nomeQ))
    }
  }
  if (candidates.length === 0) return { error: 'nao-encontrado' }
  if (candidates.length > 1) {
    // ambíguo só quando nomes idênticos em UFs distintas sem UF informada
    if (!ufQ && new Set(candidates.map((m) => m.uf)).size > 1) return { error: 'ambiguo' }
    candidates = [candidates[0]]
  }
  return resolveHit(candidates[0], territories)
}

function resolveHit(
  municipality: MunicipalityPoint,
  territories: readonly KmlTerritory[],
): MunicipalityHit {
  const hits = territories
    .filter((t) => pointInTerritory(municipality.lat, municipality.lng, t))
    .map((t) => ({ id: t.id, label: t.visualGroupName }))
  const status: MunicipalityHit['status'] =
    hits.length === 0 ? 'sem-cobertura' : hits.length === 1 ? 'coberto' : 'conflito'
  return { municipality, territories: hits, status }
}

/** Varredura: municípios de uma UF sem cobertura e com conflitos (para o painel de lacunas). */
export function coverageSummary(
  territories: readonly KmlTerritory[],
  ufFilter?: string,
): { semCobertura: number; conflitos: number; cobertos: number; total: number } {
  const all = loadMunicipalities().filter((m) => !ufFilter || m.uf === ufFilter)
  let semCobertura = 0,
    conflitos = 0,
    cobertos = 0
  for (const m of all) {
    const n = territories.filter((t) => pointInTerritory(m.lat, m.lng, t)).length
    if (n === 0) semCobertura++
    else if (n === 1) cobertos++
    else conflitos++
  }
  return { semCobertura, conflitos, cobertos, total: all.length }
}
