import type { KmlTerritory } from '../kml/parseKml.ts'

export interface SellerSummary {
  readonly id: string
  readonly name: string
  readonly territoryCount: number
  readonly polygonCount: number
}

export interface TerritoryOverlapPair {
  readonly firstId: string
  readonly firstSellerId: string
  readonly firstSellerName: string
  readonly secondId: string
  readonly secondSellerId: string
  readonly secondSellerName: string
}

const SELLER_COLORS = [
  '#c62828',
  '#1565c0',
  '#00695c',
  '#6a1b9a',
  '#ef6c00',
  '#2e7d32',
  '#ad1457',
  '#00838f',
  '#4527a0',
  '#9e6d00',
  '#37474f',
  '#558b2f',
  '#0277bd',
  '#d84315',
  '#283593',
  '#00796b',
] as const

export function normalizeMapSearch(value: string): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim()
    .replace(/\s+/g, ' ')
}

export function buildSellerSummaries(territories: readonly KmlTerritory[]): SellerSummary[] {
  const sellers = new Map<string, SellerSummary>()
  for (const territory of territories) {
    const current = sellers.get(territory.visualGroupId)
    sellers.set(territory.visualGroupId, {
      id: territory.visualGroupId,
      name: territory.visualGroupName,
      territoryCount: (current?.territoryCount ?? 0) + 1,
      polygonCount: (current?.polygonCount ?? 0) + territory.polygonCount,
    })
  }
  return [...sellers.values()].sort((first, second) =>
    first.name.localeCompare(second.name, 'pt-BR'),
  )
}

export function filterTerritories(
  territories: readonly KmlTerritory[],
  query: string,
  hiddenSellerIds: ReadonlySet<string>,
  overlapsOnly: boolean,
  overlappingTerritoryIds: ReadonlySet<string>,
): KmlTerritory[] {
  const normalizedQuery = normalizeMapSearch(query)
  return territories.filter((territory) => {
    if (hiddenSellerIds.has(territory.visualGroupId)) return false
    if (
      normalizedQuery &&
      !normalizeMapSearch(`${territory.visualGroupName} ${territory.name}`).includes(
        normalizedQuery,
      )
    )
      return false
    if (overlapsOnly && !overlappingTerritoryIds.has(territory.id)) return false
    return true
  })
}

export function colorForSeller(
  sellerId: string,
  customColors: Readonly<Record<string, string>> = {},
): string {
  const custom = customColors[sellerId]
  if (custom && /^#[0-9a-f]{6}$/i.test(custom)) return custom.toLowerCase()
  let hash = 2166136261
  for (let index = 0; index < sellerId.length; index += 1) {
    hash ^= sellerId.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return SELLER_COLORS[(hash >>> 0) % SELLER_COLORS.length]
}

function pointOnSegment(
  point: readonly number[],
  first: readonly number[],
  second: readonly number[],
): boolean {
  const cross =
    (second[0] - first[0]) * (point[1] - first[1]) - (second[1] - first[1]) * (point[0] - first[0])
  if (Math.abs(cross) > 1e-10) return false
  return (
    point[0] >= Math.min(first[0], second[0]) - 1e-10 &&
    point[0] <= Math.max(first[0], second[0]) + 1e-10 &&
    point[1] >= Math.min(first[1], second[1]) - 1e-10 &&
    point[1] <= Math.max(first[1], second[1]) + 1e-10
  )
}

function pointStrictlyInside(
  point: readonly number[],
  ring: readonly (readonly [number, number])[],
): boolean {
  let inside = false
  for (let current = 0, previous = ring.length - 1; current < ring.length; previous = current++) {
    const first = ring[previous]
    const second = ring[current]
    if (pointOnSegment(point, first, second)) return false
    const crosses =
      first[1] > point[1] !== second[1] > point[1] &&
      point[0] <
        ((second[0] - first[0]) * (point[1] - first[1])) / (second[1] - first[1]) + first[0]
    if (crosses) inside = !inside
  }
  return inside
}

function segmentsProperlyCross(
  firstA: readonly number[],
  firstB: readonly number[],
  secondA: readonly number[],
  secondB: readonly number[],
): boolean {
  const cross = (a: readonly number[], b: readonly number[], c: readonly number[]) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
  const firstSecondA = cross(firstA, firstB, secondA)
  const firstSecondB = cross(firstA, firstB, secondB)
  const secondFirstA = cross(secondA, secondB, firstA)
  const secondFirstB = cross(secondA, secondB, firstB)
  return (
    ((firstSecondA > 1e-10 && firstSecondB < -1e-10) ||
      (firstSecondA < -1e-10 && firstSecondB > 1e-10)) &&
    ((secondFirstA > 1e-10 && secondFirstB < -1e-10) ||
      (secondFirstA < -1e-10 && secondFirstB > 1e-10))
  )
}

function ringsEquivalent(
  first: readonly (readonly [number, number])[],
  second: readonly (readonly [number, number])[],
): boolean {
  if (first.length !== second.length) return false
  const secondPoints = new Set(second.map(([longitude, latitude]) => `${longitude},${latitude}`))
  return first.every(([longitude, latitude]) => secondPoints.has(`${longitude},${latitude}`))
}

function hasPositiveAreaIntersection(
  first: readonly (readonly [number, number])[],
  second: readonly (readonly [number, number])[],
): boolean {
  if (ringsEquivalent(first, second)) return true
  for (let firstIndex = 0; firstIndex < first.length - 1; firstIndex += 1) {
    for (let secondIndex = 0; secondIndex < second.length - 1; secondIndex += 1) {
      if (
        segmentsProperlyCross(
          first[firstIndex],
          first[firstIndex + 1],
          second[secondIndex],
          second[secondIndex + 1],
        )
      )
        return true
    }
  }
  return (
    first.slice(0, -1).some((point) => pointStrictlyInside(point, second)) ||
    second.slice(0, -1).some((point) => pointStrictlyInside(point, first))
  )
}

/** Approximate visual alert in lon/lat coordinates; never used to assign a municipality or seller. */
export function findTerritoryOverlapPairs(
  territories: readonly KmlTerritory[],
): TerritoryOverlapPair[] {
  const pairs: TerritoryOverlapPair[] = []
  for (let firstIndex = 0; firstIndex < territories.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < territories.length; secondIndex += 1) {
      const first = territories[firstIndex]
      const second = territories[secondIndex]
      if (first.visualGroupId === second.visualGroupId) continue
      const overlaps = first.polygons.some((firstPolygon) =>
        second.polygons.some((secondPolygon) =>
          hasPositiveAreaIntersection(firstPolygon.rings[0] ?? [], secondPolygon.rings[0] ?? []),
        ),
      )
      if (overlaps)
        pairs.push({
          firstId: first.id,
          firstSellerId: first.visualGroupId,
          firstSellerName: first.visualGroupName,
          secondId: second.id,
          secondSellerId: second.visualGroupId,
          secondSellerName: second.visualGroupName,
        })
    }
  }
  return pairs
}

export function overlapTerritoryIds(pairs: readonly TerritoryOverlapPair[]): Set<string> {
  return new Set(pairs.flatMap((pair) => [pair.firstId, pair.secondId]))
}
