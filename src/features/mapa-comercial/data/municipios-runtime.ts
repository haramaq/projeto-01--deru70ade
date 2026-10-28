/**
 * Coordenadas oficiais dos municípios do Brasil — carregadas em RUNTIME de fonte pública.
 *
 * Fonte: mirror Kelvins/Municipios-Brasileiros via jsDelivr (dados públicos do IBGE),
 * reconciliado com o CNEFE IBGE 2022 nesta rodada de planejamento (5.570/5.571 códigos;
 * única divergência: Boa Esperança do Norte/MT 5101837, instalado 01/2025, pós-CNEFE).
 *
 * Formato esperado do JSON (utf-8-sig): [{codigo_ibge, nome, codigo_uf, latitude, longitude}, ...]
 * A UF é resolvida pela tabela de estados do mesmo repositório (codigo_uf → sigla).
 *
 * Por que runtime e não embutido: ~300 KB de dados públicos não precisam pesar no bundle;
 * o cache em memória garante 1 fetch por sessão e o painel cita a fonte.
 */
export interface MunicipalityPoint {
  codigoIbge: string
  nome: string
  uf: string
  lat: number
  lng: number
  normalizedName: string
}

export const MUNICIPIOS_JSON_URL =
  'https://cdn.jsdelivr.net/gh/kelvins/Municipios-Brasileiros@main/json/municipios.json'
export const ESTADOS_JSON_URL =
  'https://cdn.jsdelivr.net/gh/kelvins/Municipios-Brasileiros@main/json/estados.json'

export const DATASET_FONTE =
  'mirror Kelvins/Municipios-Brasileiros via jsDelivr (dados públicos IBGE; reconciliado com CNEFE 2022)'

let cache: MunicipalityPoint[] | null = null
let loading: Promise<MunicipalityPoint[]> | null = null

function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`fonte indisponível (HTTP ${response.status})`)
  return await response.json()
}

/** Carrega os 5.571 municípios (1 fetch por sessão; lança se a fonte pública falhar). */
export async function loadMunicipalities(): Promise<MunicipalityPoint[]> {
  if (cache) return cache
  if (loading) return loading
  loading = (async () => {
    const [municipios, estados] = await Promise.all([
      fetchJson(MUNICIPIOS_JSON_URL) as Promise<Array<Record<string, unknown>>>,
      fetchJson(ESTADOS_JSON_URL) as Promise<Array<Record<string, unknown>>>,
    ])
    const siglaPorCodigo = new Map<string, string>()
    for (const estado of estados) {
      siglaPorCodigo.set(String(estado.codigo_uf), String(estado.uf))
    }
    const rows: MunicipalityPoint[] = []
    for (const m of municipios) {
      const codigoIbge = String(m.codigo_ibge)
      const nome = String(m.nome)
      const uf = siglaPorCodigo.get(String(m.codigo_uf)) ?? ''
      const lat = Number(m.latitude)
      const lng = Number(m.longitude)
      if (
        !/^\d{7}$/.test(codigoIbge) ||
        !nome ||
        !uf ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
      )
        continue
      rows.push({ codigoIbge, nome, uf, lat, lng, normalizedName: normalizeName(nome) })
    }
    if (rows.length < 5500) throw new Error(`dataset incompleto (${rows.length} municípios)`)
    cache = rows
    return rows
  })()
  return loading
}

export function cachedMunicipalities(): MunicipalityPoint[] | null {
  return cache
}

export function datasetMeta(): { fonte: string; carregado: boolean } {
  return { fonte: DATASET_FONTE, carregado: cache !== null }
}
