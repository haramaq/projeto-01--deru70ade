import React, { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, Polygon, TileLayer, Tooltip, useMap } from 'react-leaflet'
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  FileUp,
  Info,
  LocateFixed,
  MapPinned,
  Maximize,
  Palette,
  RotateCcw,
  Search,
  Trash2,
  X,
  ZoomIn,
} from 'lucide-react'
import { latLngBounds, divIcon } from 'leaflet'
import type { LatLngBoundsExpression, LatLngTuple, PathOptions } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { PageContainer, PageHeader } from '@/components/haramaq'
import {
  buildSellerSummaries,
  colorForSeller,
  filterTerritories,
  findTerritoryOverlapPairs,
  overlapTerritoryIds,
} from '@/features/mapa-comercial/domain/territoryView'
import {
  MAX_KML_CHARACTERS,
  parseKmlVendorTerritories,
} from '@/features/mapa-comercial/kml/parseKml'
import type { KmlParseResult, KmlTerritory } from '@/features/mapa-comercial/kml/parseKml'
import {
  datasetMeta,
  lookupMunicipality,
  coverageSummary,
  cachedMunicipalities,
} from '@/features/mapa-comercial/domain/municipalityCoverage'
import type { MunicipalityLookupResult } from '@/features/mapa-comercial/domain/municipalityCoverage'
import { decodeKmlVendedores } from '@/features/mapa-comercial/data/kml-vendedores'
import {
  loadMunicipalities,
  datasetLoadError,
} from '@/features/mapa-comercial/data/municipios-runtime'
import {
  buildSellerDirectory,
  loadColorPrefs,
  saveColorPref,
  clearColorPref,
  clearColorPrefs,
} from '@/features/mapa-comercial/domain/sellerDirectory'
import type { SellerDirectoryRow } from '@/features/mapa-comercial/domain/sellerDirectory'
import { userService } from '@/services/crmService'
import { useAuth } from '@/contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import '@/features/mapa-comercial/mapa.css'

const LOCAL_QA_MODE = import.meta.env.MODE === 'localqa'

const MAX_KML_BYTES = 20 * 1024 * 1024
const DEFAULT_BRAZIL_CENTER: LatLngTuple = [-14.4, -51.4]

function territoryPositions(territory: KmlTerritory): LatLngTuple[][][] {
  return territory.polygons.map((polygon) =>
    polygon.rings.map((ring) =>
      ring.map(([longitude, latitude]) => [latitude, longitude] as LatLngTuple),
    ),
  )
}

function makeBounds(territories: readonly KmlTerritory[]): LatLngBoundsExpression | null {
  const points = territories.flatMap((territory) =>
    territory.polygons.flatMap((polygon) =>
      (polygon.rings[0] ?? []).map(([longitude, latitude]) => [latitude, longitude] as LatLngTuple),
    ),
  )
  return points.length ? latLngBounds(points) : null
}

function FitTerritories({
  territories,
  selected,
  focus,
}: {
  territories: readonly KmlTerritory[]
  selected: KmlTerritory | null
  focus: { lat: number; lng: number; zoom: number; nonce: number } | null
}) {
  const map = useMap()
  useEffect(() => {
    if (focus) {
      map.setView([focus.lat, focus.lng], focus.zoom)
      return
    }
    const bounds = makeBounds(selected ? [selected] : territories)
    if (bounds && 'isValid' in bounds && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: selected ? 13 : 7 })
    } else if (!territories.length) {
      map.setView(DEFAULT_BRAZIL_CENTER, 4)
    }
  }, [map, territories, selected?.id, focus?.nonce])
  return null
}

/** Marcador visual do município pesquisado (divIcon sem dependência de assets). */
function MuniMarker({
  marker,
}: {
  marker: {
    lat: number
    lng: number
    nome: string
    uf: string
    codigoIbge: string
    status: 'coberto' | 'conflito' | 'sem-cobertura'
    vendedores: string[]
  } | null
}) {
  if (!marker) return null
  const cor =
    marker.status === 'coberto' ? '#059669' : marker.status === 'conflito' ? '#d97706' : '#64748b'
  const rotulo =
    marker.status === 'coberto'
      ? 'Coberto por: ' + marker.vendedores.join(', ')
      : marker.status === 'conflito'
        ? 'Conflito — ' +
          marker.vendedores.length +
          ' territórios: ' +
          marker.vendedores.join(', ') +
          ' (revisão humana)'
        : 'Sem cobertura territorial definida no KML'
  return (
    <Marker
      position={[marker.lat, marker.lng]}
      icon={divIcon({
        className: 'map-muni-marker',
        html: `<span style="display:block;width:14px;height:14px;border-radius:50%;background:${cor};border:2px solid #fff;box-shadow:0 1px 4px rgb(15 23 42 / 45%)"></span>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      })}
    >
      <Tooltip permanent direction="top" offset={[0, -8]}>
        {marker.nome} · {marker.uf} · IBGE {marker.codigoIbge} — {rotulo}
      </Tooltip>
    </Marker>
  )
}

function TerritoryLayer({
  territory,
  color,
  selected,
  overlaps,
  onSelect,
}: {
  territory: KmlTerritory
  color: string
  selected: boolean
  overlaps: boolean
  onSelect: (territoryId: string) => void
}) {
  const pathOptions: PathOptions = {
    color: selected ? '#182b38' : color,
    weight: selected ? 3 : overlaps ? 2.3 : 1.5,
    opacity: 0.96,
    fillColor: color,
    fillOpacity: selected ? 0.48 : 0.25,
    dashArray: overlaps ? '7 4' : undefined,
    lineJoin: 'round',
  }
  return (
    <>
      {territoryPositions(territory).map((rings, index) => (
        <Polygon
          key={`${territory.id}-${index}`}
          positions={rings}
          pathOptions={pathOptions}
          eventHandlers={{ click: () => onSelect(territory.id) }}
        >
          <Tooltip sticky>
            {territory.visualGroupName} · território {territory.id.split('-').at(-1)}
          </Tooltip>
        </Polygon>
      ))}
    </>
  )
}

function errorMessage(result: Exclude<KmlParseResult, { ok: true }>): string {
  switch (result.error) {
    case 'XML_INVALID':
      return 'O arquivo não é um KML/XML válido ou excede o limite de tamanho.'
    case 'VENDOR_FOLDER_NOT_FOUND':
      return 'Não foi encontrada a pasta oficial de vendedores no documento “Vendedores”.'
    case 'VENDOR_FOLDER_AMBIGUOUS':
      return 'Há mais de uma pasta oficial de vendedores. A importação foi interrompida.'
    case 'NO_VALID_POLYGONS':
      return 'A pasta oficial não contém territórios poligonais válidos.'
  }
}

export default function MapaComercial() {
  const fileInput = useRef<HTMLInputElement>(null)
  const { user } = useAuth()
  const navigate = useNavigate()
  const isAdmin = user?.role === 'admin'
  const [result, setResult] = useState<Extract<KmlParseResult, { ok: true }> | null>(null)
  const [query, setQuery] = useState('')
  const [hiddenSellerIds, setHiddenSellerIds] = useState<Set<string>>(() => new Set())
  const [overlapsOnly, setOverlapsOnly] = useState(false)
  const [customColors, setCustomColors] = useState<Record<string, string>>(() => loadColorPrefs())
  const [selectedTerritoryId, setSelectedTerritoryId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [readingFile, setReadingFile] = useState(false)
  const [muniQuery, setMuniQuery] = useState('')
  const [muniResult, setMuniResult] = useState<MunicipalityLookupResult | null>(null)
  const [muniBusy, setMuniBusy] = useState(false)
  const [muniSummary, setMuniSummary] = useState<{ total: number; fonte: string } | null>(null)
  const [muniMarker, setMuniMarker] = useState<{
    lat: number
    lng: number
    nome: string
    uf: string
    codigoIbge: string
    status: 'coberto' | 'conflito' | 'sem-cobertura'
    vendedores: string[]
  } | null>(null)
  const [mapFocus, setMapFocus] = useState<{
    lat: number
    lng: number
    zoom: number
    nonce: number
  } | null>(null)
  const [crmSellers, setCrmSellers] = useState<
    Array<{ id: string; name: string; ativo: boolean; role: string }>
  >([])
  const [directoryOpen, setDirectoryOpen] = useState(false)

  // Pré-carregamento automático: KML oficial versionado (embutido, gzip) + dataset de municípios
  // (fetch público com cache de sessão). O upload manual continua disponível para outra versão.
  useEffect(() => {
    let cancelado = false
    ;(async () => {
      try {
        const kml = await decodeKmlVendedores()
        const parsed = parseKmlVendorTerritories(kml)
        if (cancelado) return
        if (parsed.ok) setResult(parsed)
        else
          setMessage({
            kind: 'error',
            text: 'KML oficial embutido inválido — use o upload manual.',
          })
      } catch {
        if (!cancelado)
          setMessage({
            kind: 'error',
            text: 'Falha ao decodificar o KML embutido — use o upload manual.',
          })
      }
      try {
        const municipios = await loadMunicipalities()
        if (cancelado) return
        setMuniSummary({ total: municipios.length, fonte: datasetMeta().fonte })
      } catch {
        if (!cancelado)
          setMuniSummary({
            total: 0,
            fonte: 'fonte pública de municípios indisponível nesta sessão',
          })
      }
    })()
    return () => {
      cancelado = true
    }
  }, [])

  const territories = result?.territories ?? []
  const sellers = useMemo(() => buildSellerSummaries(territories), [territories])
  const overlapPairs = useMemo(() => findTerritoryOverlapPairs(territories), [territories])
  const overlapIds = useMemo(() => overlapTerritoryIds(overlapPairs), [overlapPairs])
  const filteredTerritories = useMemo(
    () => filterTerritories(territories, query, hiddenSellerIds, overlapsOnly, overlapIds),
    [territories, query, hiddenSellerIds, overlapsOnly, overlapIds],
  )
  const selectedTerritory =
    territories.find((territory) => territory.id === selectedTerritoryId) ?? null

  // Cobertura territorial: calculada 1× quando a camada E o dataset de municípios estão prontos.
  const coverage = useMemo(() => {
    if (!territories.length || !muniSummary || !muniSummary.total) return null
    return coverageSummary(territories)
  }, [territories, muniSummary])
  const ufCoverage = useMemo(() => {
    if (!territories.length || !muniSummary || !muniSummary.total) return []
    const ufs = [
      'AC',
      'AL',
      'AP',
      'AM',
      'BA',
      'CE',
      'DF',
      'ES',
      'GO',
      'MA',
      'MT',
      'MS',
      'MG',
      'PA',
      'PB',
      'PR',
      'PE',
      'PI',
      'RJ',
      'RN',
      'RS',
      'RO',
      'RR',
      'SC',
      'SP',
      'SE',
      'TO',
    ]
    return ufs.map((uf) => ({ uf, ...coverageSummary(territories, uf) }))
  }, [territories, muniSummary])

  async function importFile(file: File | undefined) {
    if (!file) return
    if (file.size > MAX_KML_BYTES || file.size > MAX_KML_CHARACTERS) {
      setMessage({ kind: 'error', text: 'O KML excede o limite local de 20 MB.' })
      return
    }
    if (!/\.kml$/i.test(file.name) && file.type !== 'application/vnd.google-earth.kml+xml') {
      setMessage({ kind: 'error', text: 'Selecione um arquivo KML.' })
      return
    }

    setReadingFile(true)
    setMessage(null)
    try {
      const xml = await file.text()
      const parsed = parseKmlVendorTerritories(xml)
      if (parsed.ok === false) {
        setMessage({ kind: 'error', text: errorMessage(parsed) })
        return
      }
      setResult(parsed)
      setHiddenSellerIds(new Set())
      setCustomColors({})
      clearColorPrefs()
      setQuery('')
      setOverlapsOnly(false)
      setSelectedTerritoryId(null)
      setMessage({
        kind: 'success',
        text: 'KML processado neste navegador. O conteúdo e as descrições não foram enviados nem armazenados.',
      })
    } catch {
      setMessage({
        kind: 'error',
        text: 'Não foi possível ler o arquivo local. Nenhum conteúdo foi enviado.',
      })
    } finally {
      setReadingFile(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  function clearMap() {
    setResult(null)
    setQuery('')
    setHiddenSellerIds(new Set())
    setCustomColors({})
    clearColorPrefs()
    setSelectedTerritoryId(null)
    setOverlapsOnly(false)
    setMuniResult(null)
    setMuniMarker(null)
    setMapFocus(null)
    setMuniSummary(null)
    setMessage({
      kind: 'success',
      text: 'A camada e as personalizações da sessão foram removidas.',
    })
    if (fileInput.current) fileInput.current.value = ''
  }

  function handleMunicipalityLookup() {
    if (!result || muniBusy) return
    setMuniBusy(true)
    void (async () => {
      try {
        // dataset ausente → tenta (re)carregar antes de falhar (fallback de mirror + retry)
        if (!cachedMunicipalities()) {
          try {
            await loadMunicipalities()
            setMuniSummary({ total: cachedMunicipalities()!.length, fonte: datasetMeta().fonte })
          } catch {
            const erro = datasetLoadError()
            setMuniResult({ error: 'fonte-indisponivel' })
            setMuniMarker(null)
            setMapFocus(null)
            setMessage({
              kind: 'error',
              text: `Fonte de municípios indisponível (${erro ?? 'falha de rede'}) — a consulta por código/nome exige essa base. Tente novamente.`,
            })
            return
          }
        }
        const hit = lookupMunicipality(muniQuery, territories)
        setMuniResult(hit)
        if (!('error' in hit)) {
          const vendedores = hit.territories.map((t) => t.label)
          setMuniMarker({
            lat: hit.municipality.lat,
            lng: hit.municipality.lng,
            nome: hit.municipality.nome,
            uf: hit.municipality.uf,
            codigoIbge: hit.municipality.codigoIbge,
            status: hit.status,
            vendedores,
          })
          // centraliza o mapa no município (zoom 11 ≈ município; conflito mantém todos os territórios visíveis)
          setMapFocus({
            lat: hit.municipality.lat,
            lng: hit.municipality.lng,
            zoom: 11,
            nonce: Date.now(),
          })
          // destaca no mapa o território responsável (quando único)
          if (hit.territories.length === 1) setSelectedTerritoryId(hit.territories[0].id)
          // conflito: mantém todos visíveis (sem atribuição automática), sem seleção única
          if (hit.territories.length > 1) setSelectedTerritoryId(null)
        } else {
          setMuniMarker(null)
          setMapFocus(null)
        }
      } finally {
        setMuniBusy(false)
      }
    })()
  }

  function toggleSeller(sellerId: string) {
    setHiddenSellerIds((current) => {
      const next = new Set(current)
      if (next.has(sellerId)) next.delete(sellerId)
      else next.add(sellerId)
      return next
    })
  }

  // Diretório de vendedores: usuários do CRM (role vendedor) × rótulos do KML — sem vínculo automático.
  const sellerDirectory = useMemo(
    () => buildSellerDirectory(crmSellers, territories),
    [crmSellers, territories],
  )
  useEffect(() => {
    if (!isAdmin) return
    let cancelado = false
    userService
      .getAll()
      .then((users) => {
        if (cancelado) return
        setCrmSellers(
          users
            .filter((u) => u.role === 'vendedor')
            .map((u) => ({ id: u.id, name: u.name ?? '', ativo: u.ativo !== false, role: u.role })),
        )
      })
      .catch(() => {
        if (!cancelado) setCrmSellers([])
      })
    return () => {
      cancelado = true
    }
  }, [isAdmin])

  function handleColorChange(visualGroupId: string, color: string): void {
    setCustomColors((current) => ({ ...current, [visualGroupId]: color }))
    saveColorPref(visualGroupId, color)
  }
  function handleColorReset(visualGroupId: string): void {
    setCustomColors((current) => {
      const next = { ...current }
      delete next[visualGroupId]
      return next
    })
    clearColorPref(visualGroupId)
  }

  return (
    <PageContainer maxWidth="full" className="map-commercial-page">
      <PageHeader
        title="Mapa Comercial"
        subtitle="Territórios comerciais dos vendedores · consulta por município, UF ou código IBGE · somente leitura"
        badge={
          <span className="rounded-full border border-[#fecaca] bg-[#fef2f2] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#b91c1c]">
            HARAMAQ · LOCAL
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInput}
              type="file"
              accept=".kml,application/vnd.google-earth.kml+xml,application/xml,text/xml"
              className="sr-only"
              aria-label="Selecionar arquivo KML dos vendedores"
              onChange={(event) => {
                void importFile(event.currentTarget.files?.[0])
              }}
            />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={readingFile}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#d92323] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#b91c1c] disabled:cursor-wait disabled:opacity-60"
            >
              <FileUp className="h-4 w-4" /> {readingFile ? 'Lendo no navegador…' : 'Importar KML'}
            </button>
            {result && (
              <button
                type="button"
                onClick={clearMap}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-sm font-semibold text-[#475569] transition hover:bg-[#f8fafc]"
              >
                <Trash2 className="h-4 w-4" /> Limpar camada
              </button>
            )}
          </div>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="flex items-start gap-3 rounded-xl border border-[#dbeafe] bg-[#eff6ff] p-3.5 text-[#1e3a8a]">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="text-xs leading-relaxed">
            <strong>Privacidade:</strong> o KML é lido somente em memória neste navegador;
            descrições não são exibidas nem transmitidas.{' '}
            {LOCAL_QA_MODE
              ? 'No QA local, fonte, tiles, Skip e PocketBase estão bloqueados.'
              : 'O mapa-base solicita tiles ao OpenStreetMap.'}
          </p>
        </div>
        <div className="flex items-start gap-3 rounded-xl border border-[#e2e8f0] bg-white p-3.5 text-[#475569]">
          <MapPinned className="mt-0.5 h-4 w-4 shrink-0 text-[#d92323]" />
          <p className="text-xs leading-relaxed">
            <strong className="text-[#1e293b]">Rótulos visuais:</strong> nomes no KML não são
            associados a usuários do CRM e a geometria não determina município ou distribuição.
          </p>
        </div>
        <div className="flex items-start gap-3 rounded-xl border border-[#fef3c7] bg-[#fffbeb] p-3.5 text-[#92400e]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="text-xs leading-relaxed">
            <strong>Sobreposições:</strong> sinalizações aproximadas para conferência humana; não
            alteram território nem atribuem leads.
          </p>
        </div>
      </div>

      {message && (
        <div
          role="status"
          className={`mb-4 flex items-start gap-2 rounded-lg border px-3.5 py-3 text-sm ${message.kind === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}
        >
          {message.kind === 'error' ? (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{message.text}</span>
          <button
            type="button"
            className="ml-auto rounded p-0.5 opacity-70 hover:opacity-100"
            aria-label="Fechar aviso"
            onClick={() => setMessage(null)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {result && (
        <section aria-label="Resumo da camada territorial" className="mb-4">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-[#64748b]">
            Mapa de Territórios
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: 'Vendedores (rótulos)', value: sellers.length },
              { label: 'Territórios', value: result.summary.territoriesIncluded },
              { label: 'Polígonos', value: result.summary.polygonsIncluded },
              { label: 'Conflitos entre vendedores', value: overlapPairs.length },
            ].map((metric) => (
              <div
                key={metric.label}
                className="rounded-lg border border-[#e2e8f0] bg-white px-3.5 py-3 shadow-sm"
              >
                <span className="block text-[10px] font-bold uppercase tracking-wide text-[#64748b]">
                  {metric.label}
                </span>
                <strong className="mt-1 block text-xl font-bold tabular-nums text-[#1e293b]">
                  {metric.value}
                </strong>
              </div>
            ))}
          </div>
        </section>
      )}

      {result && coverage && (
        <section
          aria-label="Cobertura territorial por UF e Brasil"
          className="mb-4 rounded-lg border border-[#e2e8f0] bg-white p-4 shadow-sm"
        >
          <h2 className="text-sm font-bold uppercase tracking-wide text-[#64748b]">
            Cobertura Comercial
          </h2>
          <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-bold text-[#1e293b]">
              Cobertura territorial (consulta por coordenada oficial do município)
            </h2>
            <p className="text-[10px] text-[#94a3b8]">
              Base: {coverage.total.toLocaleString('pt-BR')} municípios · {muniSummary?.fonte}
            </p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              {
                label: 'Cobertos (1 vendedor)',
                value: coverage.cobertos,
                tone: 'text-emerald-700',
              },
              {
                label: 'Conflitos (2+ vendedores)',
                value: coverage.conflitos,
                tone: 'text-amber-700',
              },
              { label: 'Sem cobertura', value: coverage.semCobertura, tone: 'text-[#64748b]' },
              { label: 'Total avaliado', value: coverage.total, tone: 'text-[#1e293b]' },
            ].map((metric) => (
              <div
                key={metric.label}
                className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3.5 py-3"
              >
                <span className="block text-[10px] font-bold uppercase tracking-wide text-[#64748b]">
                  {metric.label}
                </span>
                <strong className={`mt-1 block text-xl font-bold tabular-nums ${metric.tone}`}>
                  {metric.value.toLocaleString('pt-BR')}
                </strong>
              </div>
            ))}
          </div>
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-semibold text-[#475569] hover:text-[#1e293b]">
              Cobertura por UF
            </summary>
            <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-7">
              {ufCoverage.map((row) => (
                <div
                  key={row.uf}
                  className="rounded border border-[#e2e8f0] bg-white px-2 py-1.5 text-[10px] leading-tight"
                >
                  <span className="font-bold text-[#1e293b]">{row.uf}</span>
                  <span className="float-right tabular-nums text-[#64748b]">
                    {row.cobertos + row.conflitos}/{row.total}
                  </span>
                  {row.conflitos > 0 && (
                    <span className="block text-amber-700" title="Municípios com 2+ vendedores">
                      ⚠ {row.conflitos} conflito(s)
                    </span>
                  )}
                </div>
              ))}
            </div>
          </details>
          <p className="mt-3 text-xs leading-relaxed text-[#64748b]">
            <strong className="text-[#1e293b]">Sobreposição ≠ conflito:</strong>{' '}
            <strong className="text-[#1e293b]">{overlapPairs.length}</strong> é o número de{' '}
            <strong className="text-[#1e293b]">
              pares de territórios cujos polígonos se cruzam no mapa
            </strong>{' '}
            (geometria do KML; um vendedor com vários polígonos na mesma área é um único território,
            sem conflito). Já os{' '}
            <strong className="text-[#1e293b]">{coverage.conflitos.toLocaleString('pt-BR')}</strong>{' '}
            municípios em conflito são{' '}
            <strong className="text-[#1e293b]">
              municípios cuja coordenada oficial cai dentro de territórios de vendedores distintos
            </strong>{' '}
            — podem ou não estar numa área de sobreposição geométrica. Nenhuma atribuição automática
            é feita em nenhum dos casos.
          </p>
        </section>
      )}

      {result && isAdmin && (
        <section
          aria-label="Vendedores — cadastro e preferências locais"
          className="mb-4 rounded-lg border border-[#e2e8f0] bg-white p-4 shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-[#1e293b]">Vendedores</h2>
              <p className="mt-0.5 text-[11px] text-[#64748b]">
                Usuários do CRM (cadastro real) e rótulos territoriais do KML — exibidos lado a
                lado, <strong className="text-[#334155]">sem vínculo automático</strong>. Homônimos
                permanecem independentes.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDirectoryOpen((v) => !v)}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-[#e2e8f0] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#475569] transition hover:bg-[#f1f5f9]"
                aria-expanded={directoryOpen}
              >
                {directoryOpen ? 'Ocultar diretório' : `Ver diretório (${sellerDirectory.length})`}
              </button>
              <button
                type="button"
                onClick={() => navigate('/configuracoes')}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-[#d92323] px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#b91c1c]"
              >
                Cadastrar / editar vendedores
              </button>
            </div>
          </div>
          {directoryOpen && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#e2e8f0] text-[10px] uppercase tracking-wide text-[#64748b]">
                    <th className="py-2 pr-3 font-bold">Território (KML)</th>
                    <th className="py-2 pr-3 font-bold">Vendedor no CRM (sugestão)</th>
                    <th className="py-2 pr-3 font-bold">Cor local</th>
                    <th className="py-2 font-bold">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {sellerDirectory.map((row: SellerDirectoryRow) => {
                    const corAtual = customColors[row.visualGroupId]
                    return (
                      <tr key={row.visualGroupId} className="border-b border-[#f1f5f9]">
                        <td className="py-2 pr-3">
                          <span className="font-semibold text-[#1e293b]">{row.kmlLabel}</span>
                          <span className="ml-1 text-[10px] text-[#94a3b8]">
                            · {row.territoryCount}{' '}
                            {row.territoryCount === 1 ? 'território' : 'territórios'}
                          </span>
                          {row.homonimo && (
                            <span
                              className="ml-1.5 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700"
                              title="Há mais de um território ou usuário com este nome — correspondência exige revisão humana"
                            >
                              homônimo
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          {row.crmSuggestion ? (
                            <span className="text-[#334155]">
                              {row.crmSuggestion.name}
                              {row.crmSuggestion.ativo ? '' : ' · inativo'}
                            </span>
                          ) : (
                            <span className="text-[#94a3b8]">sem correspondência exata</span>
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          <label
                            className="map-commercial-color"
                            title={`Cor local de ${row.kmlLabel}`}
                          >
                            <Palette className="h-3.5 w-3.5 text-[#64748b]" />
                            <input
                              type="color"
                              value={colorForSeller(row.visualGroupId, customColors)}
                              onChange={(event) =>
                                handleColorChange(row.visualGroupId, event.currentTarget.value)
                              }
                              aria-label={`Cor local do território ${row.kmlLabel}`}
                            />
                          </label>
                        </td>
                        <td className="py-2">
                          {corAtual ? (
                            <button
                              type="button"
                              onClick={() => handleColorReset(row.visualGroupId)}
                              className="text-[11px] font-semibold text-[#475569] hover:text-[#d92323]"
                            >
                              <RotateCcw className="mr-1 inline h-3 w-3" /> Restaurar padrão
                            </button>
                          ) : (
                            <span className="text-[10px] text-[#94a3b8]">cor automática</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {sellerDirectory.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-3 text-center text-[#64748b]">
                        Nenhum território carregado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <p className="mt-2 text-[10px] leading-relaxed text-[#94a3b8]">
                <Info className="mr-1 inline h-3 w-3" /> As cores são{' '}
                <strong>preferências locais deste navegador</strong> (armazenamento local) — não são
                configurações compartilhadas nem vão ao banco. A correspondência de nomes é sugestão
                para revisão humana; nunca um vínculo automático.
              </p>
            </div>
          )}
        </section>
      )}
      <section className="map-commercial-layout" aria-label="Mapa e filtros territoriais">
        <aside className="map-commercial-sidebar rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
          {result && (
            <div
              className="border-b border-[#e2e8f0] bg-white p-4"
              aria-label="Consulta territorial por município"
            >
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#64748b]">
                Consultar município — acesso rápido
              </p>
              <form
                className="mt-2 flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault()
                  handleMunicipalityLookup()
                }}
              >
                <input
                  value={muniQuery}
                  onChange={(event) => setMuniQuery(event.currentTarget.value)}
                  placeholder="Ex.: Uberlândia, MG"
                  aria-label="Consultar responsabilidade territorial por município e UF"
                  className="h-10 min-w-0 flex-1 rounded-lg border border-[#cbd5e1] bg-white px-3 text-sm outline-none transition focus:border-[#d92323] focus:ring-2 focus:ring-red-100"
                />
                <button
                  type="submit"
                  disabled={muniBusy}
                  className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 text-xs font-semibold text-[#475569] transition hover:bg-[#f1f5f9] disabled:opacity-60"
                >
                  <LocateFixed className="h-3.5 w-3.5" /> Consultar
                </button>
              </form>
              {muniResult && !('error' in muniResult) && (
                <div
                  className="mt-3 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3 text-xs"
                  aria-live="polite"
                >
                  <p className="font-bold text-[#1e293b]">
                    {muniResult.municipality.nome} · {muniResult.municipality.uf}
                    <span className="ml-1 font-normal text-[#64748b]">
                      IBGE {muniResult.municipality.codigoIbge}
                    </span>
                  </p>
                  {muniResult.status === 'coberto' && (
                    <p className="mt-1.5 flex items-center gap-1.5 font-semibold text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Coberto por:{' '}
                      {muniResult.territories.map((t) => t.label).join(', ')}
                    </p>
                  )}
                  {muniResult.status === 'conflito' && (
                    <p className="mt-1.5 flex items-center gap-1.5 font-semibold text-amber-700">
                      <AlertTriangle className="h-3.5 w-3.5" /> Conflito —{' '}
                      {muniResult.territories.length} territórios:{' '}
                      {muniResult.territories.map((t) => t.label).join(', ')}. Requer revisão
                      humana.
                    </p>
                  )}
                  {muniResult.status === 'sem-cobertura' && (
                    <p className="mt-1.5 flex items-center gap-1.5 font-semibold text-[#64748b]">
                      <Info className="h-3.5 w-3.5" /> Sem cobertura territorial definida no KML.
                    </p>
                  )}
                </div>
              )}
              {muniResult && 'error' in muniResult && (
                <p
                  className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800"
                  aria-live="polite"
                >
                  {muniResult.error === 'ambiguo'
                    ? 'Município com mesmo nome em mais de uma UF — informe a UF (ex.: “Nome, SP”).'
                    : muniResult.error === 'fonte-indisponivel'
                      ? 'Base oficial de municípios indisponível nesta sessão (falha de rede na fonte pública). A consulta por código/nome requer essa base — tente novamente em instantes.'
                      : 'Município não encontrado na base oficial.'}
                </p>
              )}
              {muniSummary && (
                <p className="mt-2 text-[10px] leading-relaxed text-[#94a3b8]">
                  Base oficial: {muniSummary.total.toLocaleString('pt-BR')} municípios ·{' '}
                  {muniSummary.fonte}
                </p>
              )}
            </div>
          )}

          <div className="border-b border-[#e2e8f0] p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-[#1e293b]">Vendedores e filtros</h2>
                <p className="mt-0.5 text-[11px] text-[#64748b]">
                  Busca por rótulo; personalização nesta sessão.
                </p>
              </div>
              <span className="rounded-full bg-[#f1f5f9] px-2 py-1 text-[10px] font-bold text-[#475569]">
                {filteredTerritories.length}/{territories.length}
              </span>
            </div>
            <label className="relative block">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
                placeholder="Buscar vendedor…"
                aria-label="Buscar vendedores e territórios"
                className="h-10 w-full rounded-lg border border-[#cbd5e1] bg-white pl-9 pr-9 text-sm outline-none transition focus:border-[#d92323] focus:ring-2 focus:ring-red-100"
              />
              {query && (
                <button
                  type="button"
                  aria-label="Limpar busca"
                  onClick={() => setQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[#64748b] hover:bg-[#f1f5f9]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </label>
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs font-medium text-[#475569]">
              <input
                type="checkbox"
                checked={overlapsOnly}
                onChange={(event) => setOverlapsOnly(event.currentTarget.checked)}
                disabled={!overlapPairs.length}
                className="h-4 w-4 accent-[#d92323]"
              />
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> Mostrar somente sobreposições
              ({overlapPairs.length})
            </label>
          </div>

          <div className="map-commercial-seller-list p-3" aria-label="Filtros de vendedores">
            {!result && (
              <div className="rounded-lg border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-4 text-center">
                <MapPinned className="mx-auto h-6 w-6 text-[#d92323]" />
                <p className="mt-2 text-xs font-semibold text-[#334155]">
                  Carregue o KML dos vendedores
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-[#64748b]">
                  Somente a pasta oficial e os polígonos são considerados. Marcadores, pastas de
                  revendas e descrições são ignorados.
                </p>
              </div>
            )}
            {result && sellers.length === 0 && (
              <p className="p-4 text-center text-xs text-[#64748b]">Nenhum vendedor encontrado.</p>
            )}
            {sellers.map((seller) => {
              const hidden = hiddenSellerIds.has(seller.id)
              const color = colorForSeller(seller.id, customColors)
              return (
                <div
                  key={seller.id}
                  className={`map-commercial-seller-row ${hidden ? 'opacity-55' : ''}`}
                >
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={!hidden}
                      onChange={() => toggleSeller(seller.id)}
                      className="h-4 w-4 shrink-0 accent-[#d92323]"
                      aria-label={`Exibir territórios de ${seller.name}`}
                    />
                    <span
                      aria-hidden="true"
                      className="h-3 w-3 shrink-0 rounded-sm ring-1 ring-black/10"
                      style={{ backgroundColor: color }}
                    />
                    <span
                      className="min-w-0 flex-1 truncate text-xs font-semibold text-[#334155]"
                      title={seller.name}
                    >
                      {seller.name}
                    </span>
                    <span className="shrink-0 text-[10px] tabular-nums text-[#64748b]">
                      {seller.territoryCount}/{seller.polygonCount}
                    </span>
                  </label>
                  <label
                    className="map-commercial-color"
                    title={`Cor temporária de ${seller.name}`}
                  >
                    <Palette className="h-3.5 w-3.5 text-[#64748b]" />
                    <input
                      type="color"
                      value={color}
                      onChange={(event) => {
                        const selectedColor = event.currentTarget.value
                        handleColorChange(seller.id, selectedColor)
                      }}
                      aria-label={`Personalizar cor de ${seller.name}`}
                    />
                  </label>
                </div>
              )
            })}
            {sellers.length > 0 && (
              <div className="mt-3 flex items-center justify-between border-t border-[#e2e8f0] pt-3">
                <button
                  type="button"
                  className="text-[11px] font-semibold text-[#475569] hover:text-[#d92323]"
                  onClick={() => setHiddenSellerIds(new Set())}
                >
                  <Eye className="mr-1 inline h-3.5 w-3.5" /> Mostrar todos
                </button>
                <button
                  type="button"
                  className="text-[11px] font-semibold text-[#475569] hover:text-[#d92323]"
                  onClick={() => {
                    setCustomColors({})
                    clearColorPrefs()
                  }}
                >
                  <RotateCcw className="mr-1 inline h-3.5 w-3.5" /> Cores automáticas
                </button>
              </div>
            )}
          </div>

          {selectedTerritory && (
            <div className="border-t border-[#e2e8f0] bg-[#f8fafc] p-4" aria-live="polite">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#64748b]">
                    Território selecionado
                  </p>
                  <h3 className="mt-1 text-sm font-bold text-[#1e293b]">
                    {selectedTerritory.visualGroupName}
                  </h3>
                </div>
                <button
                  type="button"
                  aria-label="Fechar detalhes do território"
                  className="rounded p-1 text-[#64748b] hover:bg-white"
                  onClick={() => setSelectedTerritoryId(null)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-2 text-xs text-[#475569]">
                {selectedTerritory.polygonCount}{' '}
                {selectedTerritory.polygonCount === 1 ? 'polígono' : 'polígonos'} · identificador
                temporário {selectedTerritory.id}
              </p>
              {overlapIds.has(selectedTerritory.id) && (
                <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5" /> Sobreposição visual sinalizada para
                  revisão humana.
                </p>
              )}
            </div>
          )}
        </aside>

        <div className="min-w-0 overflow-hidden rounded-xl border border-[#d5dde5] bg-white shadow-sm">
          <div className="flex min-h-12 flex-wrap items-center justify-between gap-2 border-b border-[#e2e8f0] px-3.5 py-2.5 sm:px-4">
            <div className="flex items-center gap-2 text-xs font-bold text-[#334155]">
              <LocateFixed className="h-4 w-4 text-[#d92323]" />
              <span>Territórios comerciais</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMapFocus(null)}
                disabled={!result}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-[#e2e8f0] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#475569] transition hover:bg-[#f1f5f9] disabled:opacity-50"
                aria-label="Enquadrar todos os territórios no mapa"
              >
                <Maximize className="h-3.5 w-3.5" /> Enquadrar territórios
              </button>
              <button
                type="button"
                onClick={() =>
                  setMapFocus({
                    lat: DEFAULT_BRAZIL_CENTER[0],
                    lng: DEFAULT_BRAZIL_CENTER[1],
                    zoom: 10,
                    nonce: Date.now(),
                  })
                }
                disabled={!result}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-[#e2e8f0] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#475569] transition hover:bg-[#f1f5f9] disabled:opacity-50"
                aria-label="Expandir o mapa"
              >
                <ZoomIn className="h-3.5 w-3.5" /> Expandir mapa
              </button>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-medium text-[#64748b]">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-[#d92323]" /> vendedor
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm border border-amber-600 bg-amber-200" />{' '}
                sobreposição visual
              </span>
            </div>
          </div>
          <div
            className={`map-commercial-map${LOCAL_QA_MODE ? ' map-commercial-map--localqa' : ''}`}
            aria-label="Mapa interativo de territórios de vendedores"
          >
            <MapContainer
              center={DEFAULT_BRAZIL_CENTER}
              zoom={4}
              minZoom={3}
              maxZoom={18}
              scrollWheelZoom
              className="h-full w-full"
              zoomControl
            >
              {!LOCAL_QA_MODE && (
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>'
                  url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                  maxZoom={19}
                />
              )}
              <FitTerritories
                territories={territories}
                selected={selectedTerritory}
                focus={mapFocus}
              />
              <MuniMarker marker={muniMarker} />
              {filteredTerritories.map((territory) => (
                <TerritoryLayer
                  key={territory.id}
                  territory={territory}
                  color={colorForSeller(territory.visualGroupId, customColors)}
                  selected={territory.id === selectedTerritoryId}
                  overlaps={overlapIds.has(territory.id)}
                  onSelect={setSelectedTerritoryId}
                />
              ))}
            </MapContainer>
            {LOCAL_QA_MODE && (
              <span className="map-commercial-qa-basemap-note">
                QA local · mapa-base externo desativado
              </span>
            )}
            {result && filteredTerritories.length === 0 && (
              <div className="map-commercial-empty-layer">
                <EyeOff className="h-5 w-5" />
                <span>Nenhum território corresponde aos filtros.</span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e2e8f0] bg-[#f8fafc] px-3.5 py-2 text-[10px] text-[#64748b] sm:px-4">
            <span>
              {result
                ? `${filteredTerritories.length} territórios visíveis · ${overlapPairs.length} pares com sobreposição visual`
                : 'Aguardando importação local do KML'}
            </span>
            <span className="inline-flex items-center gap-1">
              <Info className="h-3 w-3" /> Dados temporários desta sessão
            </span>
          </div>
        </div>
      </section>

      <section
        aria-label="Gestão territorial — implementação futura"
        className="rounded-lg border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-4"
      >
        <h2 className="text-sm font-bold uppercase tracking-wide text-[#64748b]">
          Gestão Territorial
        </h2>
        <p className="mt-1.5 text-xs leading-relaxed text-[#64748b]">
          Edição de territórios, transferência de municípios entre vendedores e distribuição
          automática de leads —
          <strong className="text-[#334155]"> reservada para implementação futura</strong>, restrita
          a administradores e dependente do catálogo IBGE (L1-C) e das regras de distribuição
          (L4-C). Esta página é somente leitura.
        </p>
      </section>
    </PageContainer>
  )
}
