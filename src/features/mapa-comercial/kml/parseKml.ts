export interface KmlPolygon {
  readonly id: string
  /** [longitude, latitude][]; inner rings, when present, follow the outer ring. */
  readonly rings: readonly (readonly [number, number][])[]
}

export interface KmlTerritory {
  readonly id: string
  /** Placemark name is a temporary visual label only, never a CRM identity. */
  readonly name: string
  readonly visualGroupId: string
  readonly visualGroupName: string
  readonly polygons: readonly KmlPolygon[]
  readonly polygonCount: number
}

export interface KmlImportSummary {
  readonly vendorFolderName: string
  readonly placemarksInVendorFolder: number
  readonly territoriesIncluded: number
  readonly polygonsIncluded: number
  readonly nonTerritorialPlacemarksExcluded: number
  readonly placemarksWithoutNameIgnored: number
  readonly invalidPolygonsSkipped: number
  readonly placemarksOutsideVendorFolderIgnored: number
}

export type KmlParseResult =
  | {
      readonly ok: true
      readonly territories: readonly KmlTerritory[]
      readonly summary: KmlImportSummary
    }
  | {
      readonly ok: false
      readonly error:
        | 'XML_INVALID'
        | 'VENDOR_FOLDER_NOT_FOUND'
        | 'VENDOR_FOLDER_AMBIGUOUS'
        | 'NO_VALID_POLYGONS'
    }

export const MAX_KML_CHARACTERS = 20_000_000
const DOCUMENT_NAME = 'vendedores'
const VENDOR_FOLDER_NAME = 'regiao vendedores haramaq'

function normalizeLabel(value: string): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim()
    .replace(/\s+/g, ' ')
}

function isElement(node: Node): node is Element {
  return node.nodeType === 1
}

function localName(node: Node): string {
  const element = node as Element
  return (element.localName || element.tagName || '').split(':').at(-1)?.toLowerCase() ?? ''
}

function childElements(node: Node): Element[] {
  return Array.from(node.childNodes ?? []).filter(isElement)
}

function directChildren(node: Node, wantedName: string): Element[] {
  return childElements(node).filter((child) => localName(child) === wantedName.toLowerCase())
}

function descendantsByName(node: Node, wantedName: string): Element[] {
  const results: Element[] = []
  for (const child of childElements(node)) {
    if (localName(child) === wantedName.toLowerCase()) results.push(child)
    results.push(...descendantsByName(child, wantedName))
  }
  return results
}

function directText(node: Node, childName: string): string {
  return directChildren(node, childName)[0]?.textContent?.trim() ?? ''
}

function isRevendaFolder(name: string): boolean {
  return normalizeLabel(name).includes('revenda')
}

function collectVendorPlacemarks(folder: Element): Element[] {
  const placemarks: Element[] = []
  const visit = (parent: Element) => {
    for (const child of childElements(parent)) {
      const name = localName(child)
      if (name === 'placemark') placemarks.push(child)
      else if (name === 'folder' && !isRevendaFolder(directText(child, 'name'))) visit(child)
    }
  }
  visit(folder)
  return placemarks
}

function samePoint(a: readonly number[], b: readonly number[]): boolean {
  return Math.abs(a[0] - b[0]) <= 1e-10 && Math.abs(a[1] - b[1]) <= 1e-10
}

function signedArea(points: readonly (readonly [number, number])[]): number {
  let sum = 0
  for (let index = 0; index < points.length - 1; index += 1) {
    sum += points[index][0] * points[index + 1][1] - points[index + 1][0] * points[index][1]
  }
  return sum / 2
}

function orientation(a: readonly number[], b: readonly number[], c: readonly number[]): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
}

function onSegment(a: readonly number[], b: readonly number[], point: readonly number[]): boolean {
  return (
    point[0] >= Math.min(a[0], b[0]) - 1e-10 &&
    point[0] <= Math.max(a[0], b[0]) + 1e-10 &&
    point[1] >= Math.min(a[1], b[1]) - 1e-10 &&
    point[1] <= Math.max(a[1], b[1]) + 1e-10
  )
}

function segmentsIntersect(
  a: readonly number[],
  b: readonly number[],
  c: readonly number[],
  d: readonly number[],
): boolean {
  const o1 = orientation(a, b, c)
  const o2 = orientation(a, b, d)
  const o3 = orientation(c, d, a)
  const o4 = orientation(c, d, b)
  if (
    ((o1 > 1e-10 && o2 < -1e-10) || (o1 < -1e-10 && o2 > 1e-10)) &&
    ((o3 > 1e-10 && o4 < -1e-10) || (o3 < -1e-10 && o4 > 1e-10))
  )
    return true
  if (Math.abs(o1) <= 1e-10 && onSegment(a, b, c)) return true
  if (Math.abs(o2) <= 1e-10 && onSegment(a, b, d)) return true
  if (Math.abs(o3) <= 1e-10 && onSegment(c, d, a)) return true
  if (Math.abs(o4) <= 1e-10 && onSegment(c, d, b)) return true
  return false
}

function hasSelfIntersection(points: readonly (readonly [number, number])[]): boolean {
  const edgeCount = points.length - 1
  for (let first = 0; first < edgeCount; first += 1) {
    for (let second = first + 1; second < edgeCount; second += 1) {
      if (second === first + 1 || (first === 0 && second === edgeCount - 1)) continue
      if (segmentsIntersect(points[first], points[first + 1], points[second], points[second + 1]))
        return true
    }
  }
  return false
}

function parseRing(coordinatesText: string): [number, number][] | null {
  const tuples = String(coordinatesText ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  const points: [number, number][] = []
  for (const tuple of tuples) {
    const fields = tuple.split(',')
    const longitude = Number(fields[0])
    const latitude = Number(fields[1])
    if (
      !Number.isFinite(longitude) ||
      !Number.isFinite(latitude) ||
      Math.abs(longitude) > 180 ||
      Math.abs(latitude) > 90
    )
      return null
    points.push([longitude, latitude])
  }
  if (points.length < 3) return null
  if (!samePoint(points[0], points[points.length - 1])) points.push([...points[0]])
  if (
    new Set(points.slice(0, -1).map(([longitude, latitude]) => `${longitude},${latitude}`)).size < 3
  )
    return null
  if (Math.abs(signedArea(points)) < 1e-12 || hasSelfIntersection(points)) return null
  return points
}

function parsePolygon(polygon: Element): KmlPolygon | null {
  const outerBoundary = descendantsByName(polygon, 'outerBoundaryIs')[0]
  const outerCoordinates = outerBoundary && descendantsByName(outerBoundary, 'coordinates')[0]
  const outerRing = outerCoordinates ? parseRing(outerCoordinates.textContent ?? '') : null
  if (!outerRing) return null

  const rings: [number, number][][] = [outerRing]
  for (const innerBoundary of directChildren(polygon, 'innerBoundaryIs')) {
    const innerCoordinates = descendantsByName(innerBoundary, 'coordinates')[0]
    const innerRing = innerCoordinates ? parseRing(innerCoordinates.textContent ?? '') : null
    if (!innerRing) return null
    rings.push(innerRing)
  }
  return { id: '', rings }
}

function parseVendorDocument(document: Document): KmlParseResult {
  const vendorDocuments = descendantsByName(document, 'Document').filter(
    (candidate) => normalizeLabel(directText(candidate, 'name')) === DOCUMENT_NAME,
  )
  if (vendorDocuments.length !== 1) return { ok: false, error: 'VENDOR_FOLDER_NOT_FOUND' }

  const vendorFolders = directChildren(vendorDocuments[0], 'Folder').filter(
    (folder) => normalizeLabel(directText(folder, 'name')) === VENDOR_FOLDER_NAME,
  )
  if (vendorFolders.length === 0) return { ok: false, error: 'VENDOR_FOLDER_NOT_FOUND' }
  if (vendorFolders.length !== 1) return { ok: false, error: 'VENDOR_FOLDER_AMBIGUOUS' }

  const allDocumentPlacemarks = descendantsByName(vendorDocuments[0], 'Placemark')
  const placemarks = collectVendorPlacemarks(vendorFolders[0])
  const allowedPlacemarks = new Set(placemarks)
  const territories: KmlTerritory[] = []
  const visualGroups = new Map<string, { id: string; name: string }>()
  let invalidPolygonsSkipped = 0
  let nonTerritorialPlacemarksExcluded = 0
  let placemarksWithoutNameIgnored = 0
  let polygonsIncluded = 0

  placemarks.forEach((placemark, placemarkIndex) => {
    const polygonNodes = descendantsByName(placemark, 'Polygon')
    const polygons: KmlPolygon[] = []
    polygonNodes.forEach((polygonNode) => {
      const polygon = parsePolygon(polygonNode)
      if (!polygon) {
        invalidPolygonsSkipped += 1
        return
      }
      polygons.push({
        ...polygon,
        id: `kml-feature-${placemarkIndex + 1}-polygon-${polygons.length + 1}`,
      })
    })
    if (polygons.length === 0) {
      if (polygonNodes.length === 0) nonTerritorialPlacemarksExcluded += 1
      return
    }

    const name = directText(placemark, 'name')
    if (!name) {
      placemarksWithoutNameIgnored += 1
      return
    }
    const normalizedName = normalizeLabel(name)
    let group = visualGroups.get(normalizedName)
    if (!group) {
      group = { id: `kml-seller-${visualGroups.size + 1}`, name }
      visualGroups.set(normalizedName, group)
    }
    territories.push({
      id: `kml-territory-${placemarkIndex + 1}`,
      name,
      visualGroupId: group.id,
      visualGroupName: group.name,
      polygons,
      polygonCount: polygons.length,
    })
    polygonsIncluded += polygons.length
  })

  if (territories.length === 0) return { ok: false, error: 'NO_VALID_POLYGONS' }
  return {
    ok: true,
    territories,
    summary: {
      vendorFolderName: directText(vendorFolders[0], 'name'),
      placemarksInVendorFolder: placemarks.length,
      territoriesIncluded: territories.length,
      polygonsIncluded,
      nonTerritorialPlacemarksExcluded,
      placemarksWithoutNameIgnored,
      invalidPolygonsSkipped,
      placemarksOutsideVendorFolderIgnored: allDocumentPlacemarks.filter(
        (placemark) => !allowedPlacemarks.has(placemark),
      ).length,
    },
  }
}

/** Parses only the official vendor folder in memory. Description content is never returned or displayed. */
export function parseKmlVendorTerritories(xml: string): KmlParseResult {
  if (
    typeof xml !== 'string' ||
    !xml.trim() ||
    xml.length > MAX_KML_CHARACTERS ||
    /<!DOCTYPE/i.test(xml)
  ) {
    return { ok: false, error: 'XML_INVALID' }
  }
  try {
    const document = new DOMParser().parseFromString(xml, 'application/xml')
    if (!document.documentElement || document.getElementsByTagName('parsererror').length > 0) {
      return { ok: false, error: 'XML_INVALID' }
    }
    return parseVendorDocument(document)
  } catch {
    return { ok: false, error: 'XML_INVALID' }
  }
}
