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
export const MUNICIPIOS_JSON_URL_FALLBACK =
  'https://raw.githubusercontent.com/kelvins/Municipios-Brasileiros/main/json/municipios.json'
export const ESTADOS_JSON_URL =
  'https://cdn.jsdelivr.net/gh/kelvins/Municipios-Brasileiros@main/json/estados.json'
export const ESTADOS_JSON_URL_FALLBACK =
  'https://raw.githubusercontent.com/kelvins/Municipios-Brasileiros/main/json/estados.json'

export const DATASET_FONTE =
  'mirror Kelvins/Municipios-Brasileiros via jsDelivr (dados públicos IBGE; reconciliado com CNEFE 2022)'

let cache: MunicipalityPoint[] | null = null
let loading: Promise<MunicipalityPoint[]> | null = null
let loadError: string | null = null

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

async function fetchJsonComFallback(url: string, fallbackUrl: string): Promise<unknown> {
  try {
    return await fetchJson(url)
  } catch (erroPrimario) {
    // fallback local de rede (mesmo dataset, mirror alternativo) — nunca inventa dados
    try {
      return await fetchJson(fallbackUrl)
    } catch {
      throw erroPrimario
    }
  }
}

/** Carrega os 5.571 municípios (1 fetch por sessão; lança se a fonte pública falhar). */
export async function loadMunicipalities(): Promise<MunicipalityPoint[]> {
  if (cache) return cache
  // falha anterior NÃO fica presa: nova chamada refaz o fetch (o loading rejeitado é descartado)
  if (loading) {
    const resultado = await loading.then(
      () => true,
      () => false,
    )
    if (resultado && cache) return cache
    if (!cache) loading = null
  }
  loading = (async () => {
    const [municipios, estados] = await Promise.all([
      fetchJsonComFallback(MUNICIPIOS_JSON_URL, MUNICIPIOS_JSON_URL_FALLBACK) as Promise<
        Array<Record<string, unknown>>
      >,
      fetchJsonComFallback(ESTADOS_JSON_URL, ESTADOS_JSON_URL_FALLBACK) as Promise<
        Array<Record<string, unknown>>
      >,
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
    loadError = null
    return rows
  })()
  loading = loading.catch((erro: unknown) => {
    loadError = erro instanceof Error ? erro.message : String(erro)
    loading = null
    throw erro
  })
  return loading
}

export function cachedMunicipalities(): MunicipalityPoint[] | null {
  return cache
}

export function datasetMeta(): { fonte: string; carregado: boolean } {
  return { fonte: DATASET_FONTE, carregado: cache !== null }
}

/** Estado da última tentativa de carregamento (para diagnóstico na UI, sem inventar dados). */
export function datasetLoadError(): string | null {
  return loadError
}
