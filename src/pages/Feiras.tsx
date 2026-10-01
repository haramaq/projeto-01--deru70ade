import '../lib/pdfjs-compat'
import React, { useEffect, useMemo, useState } from 'react'
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
// Vite inlines this worker so Skip Cloud does not need to serve an .mjs asset
// with a JavaScript MIME type for PDF.js to import it as a module.
// @ts-expect-error Vite worker query is provided by vite/client at build time.
import PdfWorker from '../lib/pdf-worker?worker&inline'
import { createWorker } from 'tesseract.js'

GlobalWorkerOptions.workerPort = new PdfWorker()
import {
  BarChart3,
  CalendarDays,
  ChevronRight,
  FileText,
  LineChart,
  Pencil,
  PieChart as PieIcon,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  TrendingUp,
  Upload,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Line,
  LineChart as RechartsLineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { toast } from 'sonner'
import {
  feiraService,
  FEIRA_COST_CATEGORIES,
  FEIRA_COST_LABELS,
  FEIRA_RESULT_LABELS,
  FEIRA_STATUS_LABELS,
} from '@/services/feiraService'
import type {
  Feira,
  FeiraArquivo,
  FeiraArquivoTipo,
  FeiraCusto,
  FeiraCustoCategoria,
  FeiraLeituraStatus,
  FeiraResultado,
  FeiraResultadoTipo,
} from '@/types/crm'
import { formatCurrencyBRL, formatDateBR } from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const CHART_COLORS = [
  '#D92323',
  '#1B4332',
  '#2563EB',
  '#7C3AED',
  '#0F766E',
  '#EA580C',
  '#CA8A04',
  '#64748B',
]

const emptyFeira = {
  nome: '',
  edicao: '',
  cidade: '',
  estado: '',
  local: '',
  organizador: '',
  data_inicio: '',
  data_fim: '',
  ano: String(new Date().getFullYear()),
  status: 'planejada' as Feira['status'],
  descricao: '',
  observacoes: '',
}

const emptyCusto = {
  categoria: 'outros' as FeiraCustoCategoria,
  descricao: '',
  fornecedor: '',
  data_custo: '',
  valor_realizado: '',
  observacoes: '',
}

const emptyResultado = {
  cliente: '',
  produto: '',
  quantidade: '1',
  valor_venda: '',
  data_resultado: '',
  tipo_resultado: 'venda_realizada' as FeiraResultadoTipo,
  observacoes: '',
  numero_pedido: '',
  pedido_arquivo: undefined as File | undefined,
  pedido_nome_arquivo: '',
  pedido_texto_extraido: '',
  pedido_leitura_status: 'manual' as const,
}

type PedidoForm = typeof emptyResultado

type PedidoLeituraStatus = NonNullable<FeiraResultado['pedido_leitura_status']>

function dateOnly(value?: string) {
  return value ? value.slice(0, 10) : ''
}

function money(value: string | number | undefined) {
  const parsed = typeof value === 'number' ? value : Number(String(value || '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}

function percent(value: number, total: number) {
  return total > 0 ? `${((value / total) * 100).toFixed(1)}%` : '0,0%'
}

function parseMoney(value: string) {
  const cleaned = value
    .trim()
    .replace(/R\$\s?/gi, '')
    .replace(/\./g, '')
    .replace(',', '.')
  const parsed = Number(cleaned.replace(/[^\d.-]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeCategory(value: string): FeiraCustoCategoria {
  const normalized = value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (normalized.includes('terreno') || normalized.includes('locacao')) return 'locacao_terreno'
  if (normalized.includes('estande') || normalized.includes('estrutura')) return 'estrutura_estande'
  if (normalized.includes('aliment')) return 'alimentacao'
  if (normalized.includes('bebid')) return 'bebida'
  if (normalized.includes('hosped')) return 'hospedagem'
  if (
    normalized.includes('desloc') ||
    normalized.includes('viagem') ||
    normalized.includes('transporte')
  )
    return 'deslocamento'
  if (normalized.includes('maquina') || normalized.includes('logistica'))
    return 'logistica_maquinas'
  if (normalized.includes('comercial') || normalized.includes('equipe'))
    return 'relatorios_equipe_comercial'
  return 'outros'
}

function parseRowsFromText(text: string) {
  const trimmed = text.trim()
  if (!trimmed)
    return [] as Array<{ categoria: FeiraCustoCategoria; descricao: string; valor: number }>

  try {
    const json = JSON.parse(trimmed) as unknown
    const rows = Array.isArray(json)
      ? json
      : typeof json === 'object' && json !== null
        ? (json as { custos?: unknown[]; itens?: unknown[] }).custos ||
          (json as { itens?: unknown[] }).itens ||
          []
        : []
    if (Array.isArray(rows)) {
      return rows
        .map((row) => {
          const item = row as Record<string, unknown>
          const category = String(item.categoria || item.tipo || item.category || 'outros')
          const value = item.valor ?? item.valor_realizado ?? item.total ?? item.amount ?? 0
          return {
            categoria: normalizeCategory(category),
            descricao: String(item.descricao || item.item || item.nome || category),
            valor: typeof value === 'number' ? value : parseMoney(String(value)),
          }
        })
        .filter((item) => item.valor > 0)
    }
  } catch {
    // Continue with CSV/text parsing.
  }

  const lines = trimmed.split(/\r?\n/).filter(Boolean)
  if (!lines.length) return []
  const delimiter = lines[0].includes(';') ? ';' : ','
  const first = lines[0].toLowerCase()
  const hasHeader = /(categoria|tipo|descricao|item|valor|custo|amount)/.test(first)
  const dataLines = hasHeader ? lines.slice(1) : lines
  const header = hasHeader ? first.split(delimiter).map((item) => item.trim()) : []
  const valueIndex = header.findIndex((item) => /(valor|custo|total|amount)/.test(item))
  const categoryIndex = header.findIndex((item) => /(categoria|tipo|category)/.test(item))
  const descriptionIndex = header.findIndex((item) =>
    /(descricao|descrição|item|nome|description)/.test(item),
  )

  return dataLines
    .map((line) => {
      const parts = line.split(delimiter).map((item) => item.trim().replace(/^"|"$/g, ''))
      const fallbackValue = parts.find((item) => /R\$|\d+[,.]\d{2}/.test(item)) || ''
      const rawValue = valueIndex >= 0 ? parts[valueIndex] : fallbackValue
      const rawCategory = categoryIndex >= 0 ? parts[categoryIndex] : parts[0] || 'outros'
      const rawDescription =
        descriptionIndex >= 0 ? parts[descriptionIndex] : parts[0] || rawCategory
      return {
        categoria: normalizeCategory(rawCategory),
        descricao: rawDescription || rawCategory,
        valor: parseMoney(rawValue),
      }
    })
    .filter((item) => item.valor > 0)
}

async function readTextFile(file: File) {
  try {
    return await file.text()
  } catch {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(reader.error || new Error('Não foi possível ler o arquivo.'))
      reader.readAsText(file)
    })
  }
}

function parsePedidoMoney(value: string) {
  const normalized = value
    .replace(/R\$\s?/gi, '')
    .replace(/\s/g, '')
    .replace(/\.(?=\d{3}(?:,|$))/g, '')
    .replace(',', '.')
  const parsed = Number(normalized.replace(/[^\d.-]/g, ''))
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0
}

function toInputDate(value: string) {
  const match = value.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/)
  if (!match) return ''
  const year = match[3].length === 2 ? `20${match[3]}` : match[3]
  return `${year}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`
}

function findPedidoLabel(text: string, labels: string[]) {
  const pattern = new RegExp(`(?:${labels.join('|')})\\s*[:#-]\\s*([^\\n\\r]+)`, 'i')
  return text.match(pattern)?.[1]?.trim() || ''
}

function parsePedidoText(text: string) {
  const normalized = text
    .replace(/\uFEFF/g, '')
    .replace(/\r/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const result: Partial<
    Pick<
      FeiraResultado,
      | 'cliente'
      | 'produto'
      | 'quantidade'
      | 'valor_venda'
      | 'data_resultado'
      | 'tipo_resultado'
      | 'observacoes'
      | 'numero_pedido'
    >
  > = {}

  const numeroPedido =
    normalized.match(/pedido\s*n[ºo°]?\s*[:#-]?\s*(\d{1,10})/i)?.[1] ||
    normalized.match(/pedido\s*[:#]\s*(\d{1,10})/i)?.[1] ||
    ''
  const comprador =
    normalized.match(
      /comprador\s*(?:nome|fantasia)?\s*[:#-]?\s*([A-Za-zÀ-ÿ0-9][^|]*?)(?=\s*(?:nome fantasia|fantasia|endere|cnpj|inscri|telefone|email|e-mail|produtos?|modelo|quantidade|valor|data|prazo|frete|m[ée]todo|subtotal|total)\b|,\s*\d{5}|\s*\d{5}\s*-)/i,
    )?.[1] ||
    findPedidoLabel(text.replace(/\r/g, '').trim(), [
      'comprador',
      'cliente',
      'razão social',
      'razao social',
    ])
  const produto =
    // Nome do produto precede "Preço unitário" (formato Haramaq); captura o
    // trecho entre o fim do bloco de descrição e o preço, evitando a descrição.
    normalized.match(/(?:^|\s)([A-ZÀ-Ý][^:]{2,80}?)\s+Preço unitário:/i)?.[1] ||
    normalized.match(
      /(?:nome do produto|produtos?|equipamento)\s*[:#-]?\s*(.+?)(?=\s+(?:preço|preco)\s+unit[aá]rio\b|\s+(?:valor unit|quantidade|modelo|acessórios?|acessorios?)\b|\sR\$)/i,
    )?.[1] ||
    normalized.match(
      /modelo\s*[:#-]?\s*([A-Za-zÀ-ÿ0-9][^|]*?)(?=\s*(?:auto|descarga|balança|balança|ano|marca|ncm|quantidade|valor)\b|$)/i,
    )?.[1] ||
    ''
  const quantityMatch =
    normalized.match(/quantidade\s*[:#-]?\s*(\d{1,4})/i)?.[1] ||
    normalized.match(/(?:qtd|qtde)\.?\s*[:#-]?\s*(\d{1,4})/i)?.[1] ||
    ''
  const totalMatch =
    normalized.match(/total\s*[:#-]?\s*R\$\s*([\d.]+(?:,\d{1,2})?)/i)?.[1] ||
    normalized.match(/subtotal\s*[:#-]?\s*R\$\s*([\d.]+(?:,\d{1,2})?)/i)?.[1] ||
    normalized.match(/valor total\s*[:#-]?\s*R\$\s*([\d.]+(?:,\d{1,2})?)/i)?.[1] ||
    ''
  const dateMatch =
    normalized.match(/criado em\s*[:#-]?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i)?.[1] ||
    normalized.match(/data do pedido\s*[:#-]?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i)?.[1] ||
    normalized.match(/data\s*[:#-]\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i)?.[1] ||
    ''

  if (comprador) result.cliente = comprador.replace(/\s+/g, ' ').trim()
  if (produto) result.produto = produto.replace(/\s+/g, ' ').trim()
  if (numeroPedido) result.numero_pedido = numeroPedido
  if (quantityMatch) result.quantidade = Number(quantityMatch) || 0
  if (totalMatch) result.valor_venda = parsePedidoMoney(`R$ ${totalMatch}`)
  if (dateMatch) result.data_resultado = toInputDate(dateMatch)
  if (/proposta|orçamento|orcamento|cotação|cotacao/i.test(normalized)) {
    result.tipo_resultado = 'proposta'
  } else if (/lead|interesse|contato/i.test(normalized)) {
    result.tipo_resultado = 'lead_gerado'
  } else if (/pedido|venda|faturamento|nota fiscal/i.test(normalized)) {
    result.tipo_resultado = 'venda_realizada'
  }
  if (normalized)
    result.observacoes = `Leitura automática do pedido. Revise os dados antes de salvar.`
  return result
}

async function readPdfFile(file: File, onProgress: (message: string) => void) {
  const buffer = await file.arrayBuffer()
  const pdf = await getDocument({ data: new Uint8Array(buffer) }).promise
  const pages: string[] = []
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    pages.push(
      content.items
        .map((item) => ('str' in item ? item.str : ''))
        .filter(Boolean)
        .join(' '),
    )
  }
  const extractedText = pages.join('\n').trim()
  if (extractedText.length >= 40) return extractedText

  onProgress('PDF sem texto selecionável. Aplicando OCR nas páginas...')
  const worker = await createWorker('por', 1, {
    logger: (event) => {
      if (event.status)
        onProgress(`OCR do PDF: ${event.status} ${Math.round((event.progress || 0) * 100)}%`)
    },
  })
  try {
    const ocrPages: string[] = []
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber)
      const viewport = page.getViewport({ scale: 2 })
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      const context = canvas.getContext('2d')
      if (!context) continue
      await page.render({ canvasContext: context, viewport }).promise
      const image = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
      if (!image) continue
      const result = await worker.recognize(image)
      if (result.data.text) ocrPages.push(result.data.text)
      canvas.width = 1
      canvas.height = 1
    }
    return [extractedText, ...ocrPages].filter(Boolean).join('\n').trim()
  } finally {
    await worker.terminate()
  }
}

async function readImageFile(file: File, onProgress: (message: string) => void) {
  const worker = await createWorker('por', 1, {
    logger: (event) => {
      if (event.status) onProgress(`${event.status} ${Math.round((event.progress || 0) * 100)}%`)
    },
  })
  try {
    const result = await worker.recognize(file)
    return result.data.text || ''
  } finally {
    await worker.terminate()
  }
}

async function readPedidoFile(file: File, onProgress: (message: string) => void) {
  const extension = file.name.split('.').pop()?.toLowerCase() || ''
  if (file.type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp'].includes(extension)) {
    onProgress('Lendo imagem do pedido...')
    return readImageFile(file, onProgress)
  }
  if (extension === 'pdf' || file.type === 'application/pdf') {
    onProgress('Extraindo texto do PDF...')
    return readPdfFile(file, onProgress)
  }
  if (['txt', 'csv', 'json'].includes(extension) || file.type.startsWith('text/')) {
    onProgress('Lendo arquivo de texto...')
    return readTextFile(file)
  }
  return ''
}

function statusClass(status: Feira['status']) {
  if (status === 'concluida') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (status === 'em_andamento') return 'bg-blue-50 text-blue-700 border-blue-200'
  if (status === 'cancelada') return 'bg-red-50 text-red-700 border-red-200'
  return 'bg-amber-50 text-amber-700 border-amber-200'
}

function readClass(status: FeiraLeituraStatus) {
  if (status === 'processado') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (status === 'erro') return 'bg-red-50 text-red-700 border-red-200'
  return 'bg-amber-50 text-amber-700 border-amber-200'
}

export default function Feiras() {
  const [feiras, setFeiras] = useState<Feira[]>([])
  const [custos, setCustos] = useState<FeiraCusto[]>([])
  const [resultados, setResultados] = useState<FeiraResultado[]>([])
  const [arquivos, setArquivos] = useState<FeiraArquivo[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [selectedFeiraId, setSelectedFeiraId] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [filterCostCategory, setFilterCostCategory] = useState('todas')
  const [filterResultType, setFilterResultType] = useState('todos')

  const [feiraDialog, setFeiraDialog] = useState(false)
  const [editingFeira, setEditingFeira] = useState<Feira | null>(null)
  const [feiraForm, setFeiraForm] = useState(emptyFeira)
  const [deleteFeira, setDeleteFeira] = useState<Feira | null>(null)

  const [custoDialog, setCustoDialog] = useState(false)
  const [editingCusto, setEditingCusto] = useState<FeiraCusto | null>(null)
  const [custoForm, setCustoForm] = useState(emptyCusto)
  const [deleteCusto, setDeleteCusto] = useState<FeiraCusto | null>(null)
  const [custoAnexo, setCustoAnexo] = useState<File | null>(null)
  const [custoAnexoNome, setCustoAnexoNome] = useState('')
  const [custoReading, setCustoReading] = useState(false)
  const [custoReadingMessage, setCustoReadingMessage] = useState('')

  const [resultadoDialog, setResultadoDialog] = useState(false)
  const [editingResultado, setEditingResultado] = useState<FeiraResultado | null>(null)
  const [resultadoForm, setResultadoForm] = useState<PedidoForm>(emptyResultado)
  const [deleteResultado, setDeleteResultado] = useState<FeiraResultado | null>(null)
  const [pedidoDialog, setPedidoDialog] = useState(false)
  const [pedidoFile, setPedidoFile] = useState<File | null>(null)
  const [pedidoReading, setPedidoReading] = useState(false)
  const [pedidoReadingMessage, setPedidoReadingMessage] = useState('')
  const [pedidoReviewReady, setPedidoReviewReady] = useState(false)

  const [arquivoDialog, setArquivoDialog] = useState(false)
  const [arquivoTipo, setArquivoTipo] = useState<FeiraArquivoTipo>('relatorio')
  const [arquivoFile, setArquivoFile] = useState<File | null>(null)
  const [arquivoReading, setArquivoReading] = useState(false)
  const [deleteArquivo, setDeleteArquivo] = useState<FeiraArquivo | null>(null)

  const loadAll = async () => {
    setLoading(true)
    try {
      const [fairList, costList, resultList, fileList] = await Promise.all([
        feiraService.getAll(),
        feiraService.getCustos(),
        feiraService.getResultados(),
        feiraService.getArquivos(),
      ])
      setFeiras(fairList)
      setCustos(costList)
      setResultados(resultList)
      setArquivos(fileList)
      setSelectedFeiraId((current) =>
        current && fairList.some((item) => item.id === current) ? current : '',
      )
    } catch (error) {
      console.error(error)
      toast.error('Não foi possível carregar o módulo de Feiras.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAll()
  }, [])

  const visibleFeiras = useMemo(() => {
    return feiras.filter((feira) => {
      if (selectedFeiraId && feira.id !== selectedFeiraId) return false
      const end = dateOnly(feira.data_fim || feira.data_inicio)
      const start = dateOnly(feira.data_inicio || feira.data_fim)
      if (filterFrom && end && end < filterFrom) return false
      if (filterTo && start && start > filterTo) return false
      return true
    })
  }, [feiras, selectedFeiraId, filterFrom, filterTo])

  const dashboardFeiras = useMemo(() => {
    if (!selectedFeiraId) {
      return feiras.filter((feira) => {
        const end = dateOnly(feira.data_fim || feira.data_inicio)
        const start = dateOnly(feira.data_inicio || feira.data_fim)
        return (
          (!filterFrom || !end || end >= filterFrom) && (!filterTo || !start || start <= filterTo)
        )
      })
    }
    return visibleFeiras
  }, [feiras, visibleFeiras, selectedFeiraId, filterFrom, filterTo])

  const dashboardFeiraIds = useMemo(
    () => new Set(dashboardFeiras.map((feira) => feira.id)),
    [dashboardFeiras],
  )
  const filteredCustos = useMemo(
    () =>
      custos.filter(
        (custo) =>
          dashboardFeiraIds.has(custo.feira) &&
          (filterCostCategory === 'todas' || custo.categoria === filterCostCategory),
      ),
    [custos, dashboardFeiraIds, filterCostCategory],
  )
  const filteredResultados = useMemo(
    () =>
      resultados.filter(
        (resultado) =>
          dashboardFeiraIds.has(resultado.feira) &&
          (filterResultType === 'todos' || resultado.tipo_resultado === filterResultType),
      ),
    [resultados, dashboardFeiraIds, filterResultType],
  )

  const totalEstimated = filteredCustos.reduce((sum, item) => sum + (item.valor_estimado || 0), 0)
  const totalRealized = filteredCustos.reduce((sum, item) => sum + (item.valor_realizado || 0), 0)
  const totalSales = filteredResultados
    .filter((item) => item.tipo_resultado === 'venda_realizada')
    .reduce((sum, item) => sum + (item.valor_venda || 0), 0)
  const totalProposals = filteredResultados
    .filter((item) => item.tipo_resultado === 'proposta')
    .reduce((sum, item) => sum + (item.valor_venda || 0), 0)
  const totalLeads = filteredResultados
    .filter((item) => item.tipo_resultado === 'lead_gerado')
    .reduce((sum, item) => sum + (item.quantidade || 0), 0)
  const roi = totalRealized > 0 ? ((totalSales - totalRealized) / totalRealized) * 100 : 0

  const costByCategory = useMemo(() => {
    const map = new Map<FeiraCustoCategoria, { estimated: number; realized: number }>()
    filteredCustos.forEach((item) => {
      const current = map.get(item.categoria) || { estimated: 0, realized: 0 }
      current.estimated += item.valor_estimado || 0
      current.realized += item.valor_realizado || 0
      map.set(item.categoria, current)
    })
    return FEIRA_COST_CATEGORIES.map((categoria) => ({
      categoria,
      nome: FEIRA_COST_LABELS[categoria],
      estimated: map.get(categoria)?.estimated || 0,
      realized: map.get(categoria)?.realized || 0,
    })).filter((item) => item.estimated || item.realized)
  }, [filteredCustos])

  const fairMetrics = useMemo(() => {
    const annualRealizedByYear = new Map<number, number>()
    custos.forEach((item) => {
      const year = feiras.find((feira) => feira.id === item.feira)?.ano
      if (year) {
        annualRealizedByYear.set(
          year,
          (annualRealizedByYear.get(year) || 0) + (item.valor_realizado || 0),
        )
      }
    })
    return dashboardFeiras
      .map((feira) => {
        const fairCosts = custos.filter((item) => item.feira === feira.id)
        const fairResults = resultados.filter((item) => item.feira === feira.id)
        const estimated = fairCosts.reduce((sum, item) => sum + (item.valor_estimado || 0), 0)
        const realized = fairCosts.reduce((sum, item) => sum + (item.valor_realizado || 0), 0)
        const sales = fairResults
          .filter((item) => item.tipo_resultado === 'venda_realizada')
          .reduce((sum, item) => sum + (item.valor_venda || 0), 0)
        const proposals = fairResults
          .filter((item) => item.tipo_resultado === 'proposta')
          .reduce((sum, item) => sum + (item.valor_venda || 0), 0)
        const leads = fairResults
          .filter((item) => item.tipo_resultado === 'lead_gerado')
          .reduce((sum, item) => sum + (item.quantidade || 0), 0)
        return {
          feira,
          estimated,
          realized,
          sales,
          proposals,
          leads,
          result: sales - realized,
          roi: realized > 0 ? ((sales - realized) / realized) * 100 : 0,
          annualPercent:
            (annualRealizedByYear.get(feira.ano) || 0) > 0
              ? (realized / (annualRealizedByYear.get(feira.ano) || 0)) * 100
              : 0,
        }
      })
      .sort((a, b) => b.result - a.result)
  }, [dashboardFeiras, custos, resultados, feiras])

  const categoryPercentages = useMemo(
    () =>
      costByCategory.map((item) => ({
        ...item,
        eventPercent: percent(item.realized, totalRealized),
      })),
    [costByCategory, totalRealized],
  )

  const comparisonData = useMemo(
    () =>
      fairMetrics.map((item) => ({
        name: item.feira.edicao ? `${item.feira.nome} — ${item.feira.edicao}` : item.feira.nome,
        estimado: item.estimated,
        realizado: item.realized,
      })),
    [fairMetrics],
  )

  const openNewFeira = () => {
    setEditingFeira(null)
    setFeiraForm(emptyFeira)
    setFeiraDialog(true)
  }

  const openEditFeira = (feira: Feira) => {
    setEditingFeira(feira)
    setFeiraForm({
      nome: feira.nome,
      edicao: feira.edicao || '',
      cidade: feira.cidade || '',
      estado: feira.estado || '',
      local: feira.local || '',
      organizador: feira.organizador || '',
      data_inicio: dateOnly(feira.data_inicio),
      data_fim: dateOnly(feira.data_fim),
      ano: String(feira.ano || new Date().getFullYear()),
      status: feira.status,
      descricao: feira.descricao || '',
      observacoes: feira.observacoes || '',
    })
    setFeiraDialog(true)
  }

  const saveFeira = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!feiraForm.nome.trim()) return toast.error('Informe o nome da feira ou evento.')
    setSaving(true)
    try {
      const payload = { ...feiraForm, ano: Number(feiraForm.ano) || new Date().getFullYear() }
      const saved = editingFeira
        ? await feiraService.update(editingFeira.id, payload)
        : await feiraService.create(payload)
      setFeiras((current) =>
        editingFeira
          ? current.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...current],
      )
      setSelectedFeiraId(saved.id)
      setFeiraDialog(false)
      toast.success(editingFeira ? 'Feira atualizada.' : 'Feira cadastrada.')
    } catch (error) {
      console.error(error)
      toast.error('Não foi possível salvar a feira.')
    } finally {
      setSaving(false)
    }
  }

  const confirmDeleteFeira = async () => {
    if (!deleteFeira) return
    try {
      await feiraService.delete(deleteFeira.id)
      setFeiras((current) => current.filter((item) => item.id !== deleteFeira.id))
      setCustos((current) => current.filter((item) => item.feira !== deleteFeira.id))
      setResultados((current) => current.filter((item) => item.feira !== deleteFeira.id))
      setArquivos((current) => current.filter((item) => item.feira !== deleteFeira.id))
      if (selectedFeiraId === deleteFeira.id) setSelectedFeiraId('')
      toast.success('Feira removida.')
    } catch (error) {
      console.error(error)
      toast.error('Não foi possível remover a feira.')
    } finally {
      setDeleteFeira(null)
    }
  }

  const applyCustoAnexoRead = async (file: File) => {
    setCustoAnexo(file)
    setCustoAnexoNome(file.name)
    setCustoReading(true)
    setCustoReadingMessage('')
    try {
      const text = await readPedidoFile(file, setCustoReadingMessage)
      const normalized = text
        .replace(/\uFEFF/g, '')
        .replace(/\r/g, '')
        .replace(/\s+/g, ' ')
        .trim()
      const nextForm: Partial<typeof emptyCusto> = {}

      // Valor: prioriza rótulos de custo/total; cai para o primeiro R$ do texto.
      const valorRotulado =
        normalized.match(
          /(?:valor\s*(?:total|pago)?|total\s*(?:da\s*nota|do\s*custo)?|total|custo)\s*[:#-]?\s*R\$\s*([\d.]+(?:,\d{1,2})?)/i,
        )?.[1] || ''
      const primeiroR$ = normalized.match(/R\$\s*([\d.]+(?:,\d{1,2})?)/)?.[1] || ''
      const valor = valorRotulado || primeiroR$
      if (valor) nextForm.valor_realizado = String(parsePedidoMoney(`R$ ${valor}`))

      // Fornecedor: rótulos comuns de nota/recibo.
      const fornecedor =
        normalized.match(
          /(?:fornecedor|raz[ãa]o social|emitente|prestador|empresa)\s*[:#-]?\s*([A-Za-zÀ-ÿ0-9][^|]*?)(?=\s*(?:cnpj|endere|telefone|email|e-mail|data|valor|n[ºo°]|nf|nota)\b|,\s*\d{5})/i,
        )?.[1] || findPedidoLabel(text, ['fornecedor', 'razão social', 'razao social', 'emitente'])
      if (fornecedor) nextForm.fornecedor = fornecedor.replace(/\s+/g, ' ').trim()

      // Data: rótulos comuns; cai para a primeira data dd/mm/aaaa do texto.
      const dataRotulada = normalized.match(
        /(?:data\s*(?:da\s*emiss[ãa]o|do\s*custo|emiss[ãa]o)?|emiss[ãa]o)\s*[:#-]?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
      )?.[1]
      const dataPrimeira = normalized.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/)?.[1]
      const data = dataRotulada || dataPrimeira
      if (data) nextForm.data_custo = toInputDate(data)

      // Categoria: deduz a partir de palavras-chave do texto.
      const categoriaMap: Array<[RegExp, FeiraCustoCategoria]> = [
        [/aliment|refei|lanche|restaurante/i, 'alimentacao'],
        [/bebida|caf[eé]/i, 'bebida'],
        [/hosped|hotel|pousada|di[áa]ria/i, 'hospedagem'],
        [/desloc|combust|passagem|ped[áa]gio|uber|t[áa]xi|frete/i, 'deslocamento'],
        [/estande|montagem|tenda|estrutura/i, 'estrutura_estande'],
        [/loca[çc][ãa]o|aluguel|terreno/i, 'locacao_terreno'],
        [/log[íi]stica|m[áa]quina|transporte\s*de\s*m[áa]/i, 'logistica_maquinas'],
        [/relat[óo]rio/i, 'relatorios_equipe_comercial'],
      ]
      for (const [pattern, categoria] of categoriaMap) {
        if (pattern.test(normalized)) {
          nextForm.categoria = categoria
          break
        }
      }

      // Descrição: usa o nome do arquivo como sugestão editável.
      if (file.name) nextForm.descricao = file.name.replace(/\.[^.]+$/, '')

      const preenchidos = Object.keys(nextForm).length
      setCustoForm((current) => ({ ...current, ...nextForm }))
      toast.success(
        preenchidos
          ? `Anexo lido. ${preenchidos} campo(s) preenchido(s) para revisão.`
          : 'Anexo recebido. Revise os campos manualmente.',
      )
    } catch (error) {
      console.error(error)
      const message = error instanceof Error ? error.message : 'erro desconhecido'
      toast.error(`Não foi possível ler o anexo (${message}). Preencha os campos manualmente.`)
    } finally {
      setCustoReading(false)
      setCustoReadingMessage('')
    }
  }

  const handleCustoAnexoPaste = async (event: React.ClipboardEvent<HTMLDivElement>) => {
    const image = Array.from(event.clipboardData.items).find((item) =>
      item.type.startsWith('image/'),
    )
    if (!image) return
    event.preventDefault()
    const file = image.getAsFile()
    if (file)
      await applyCustoAnexoRead(
        new File([file], `anexo-custo-colado-${Date.now()}.png`, { type: file.type }),
      )
  }

  const openNewCusto = () => {
    if (!selectedFeiraId) return toast.info('Selecione uma feira antes de adicionar um custo.')
    setEditingCusto(null)
    setCustoForm(emptyCusto)
    setCustoAnexo(null)
    setCustoAnexoNome('')
    setCustoDialog(true)
  }

  const openEditCusto = (custo: FeiraCusto) => {
    setEditingCusto(custo)
    setCustoForm({
      categoria: custo.categoria,
      descricao: custo.descricao || '',
      fornecedor: custo.fornecedor || '',
      data_custo: dateOnly(custo.data_custo),
      valor_realizado: String(custo.valor_realizado || ''),
      observacoes: custo.observacoes || '',
    })
    setCustoAnexo(null)
    setCustoAnexoNome(custo.observacoes?.match(/Anexo: (.+)$/)?.[1] || '')
    setCustoDialog(true)
  }

  const saveCusto = async (event: React.FormEvent) => {
    event.preventDefault()
    const feiraId = editingCusto?.feira || selectedFeiraId
    if (!feiraId) return toast.error('Selecione uma feira.')
    setSaving(true)
    try {
      const observacoesComAnexo = custoAnexo
        ? `${custoForm.observacoes ? `${custoForm.observacoes}\n` : ''}Anexo: ${custoAnexoNome}`
        : custoForm.observacoes
      const payload = {
        feira: feiraId,
        ...custoForm,
        observacoes: observacoesComAnexo,
        // O custo estimado por categoria foi removido da UI; o único estimado
        // é o "Custo estimado total da feira". Ao editar, preserva o valor já
        // gravado para não alterar totais existentes (ex.: Expointer 2026).
        valor_estimado: editingCusto ? editingCusto.valor_estimado || 0 : 0,
        valor_realizado: money(custoForm.valor_realizado),
      }
      const saved = editingCusto
        ? await feiraService.updateCusto(editingCusto.id, payload)
        : await feiraService.createCusto(payload)
      setCustos((current) =>
        editingCusto
          ? current.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...current],
      )
      setCustoDialog(false)
      toast.success(editingCusto ? 'Custo atualizado.' : 'Custo registrado.')
    } catch (error) {
      console.error(error)
      toast.error('Não foi possível salvar o custo.')
    } finally {
      setSaving(false)
    }
  }

  const confirmDeleteCusto = async () => {
    if (!deleteCusto) return
    try {
      await feiraService.deleteCusto(deleteCusto.id)
      setCustos((current) => current.filter((item) => item.id !== deleteCusto.id))
      toast.success('Custo removido.')
    } catch (error) {
      console.error(error)
      toast.error('Não foi possível remover o custo.')
    } finally {
      setDeleteCusto(null)
    }
  }

  const [totalEstimatedInput, setTotalEstimatedInput] = useState('')
  const [savingTotalEstimated, setSavingTotalEstimated] = useState(false)

  useEffect(() => {
    const current = feiras.find((feira) => feira.id === selectedFeiraId)
    if (!current) {
      setTotalEstimatedInput('')
      return
    }
    const fairCosts = custos.filter((item) => item.feira === current.id)
    const total = fairCosts.reduce((sum, item) => sum + (item.valor_estimado || 0), 0)
    setTotalEstimatedInput(total ? String(total) : '')
  }, [selectedFeiraId, custos, feiras])

  const saveTotalEstimated = async () => {
    const current = feiras.find((feira) => feira.id === selectedFeiraId)
    if (!current) return toast.info('Selecione uma feira antes de salvar o custo estimado.')
    setSavingTotalEstimated(true)
    try {
      const target = money(totalEstimatedInput)
      const fairCosts = custos.filter((item) => item.feira === current.id)
      const currentTotal = fairCosts.reduce((sum, item) => sum + (item.valor_estimado || 0), 0)
      const diff = target - currentTotal
      if (diff === 0) {
        toast.info('Nenhuma alteração no custo estimado.')
        return
      }
      const othersTotal = fairCosts
        .filter((item) => item.categoria !== 'outros')
        .reduce((sum, item) => sum + (item.valor_estimado || 0), 0)
      const others = fairCosts.filter((item) => item.categoria === 'outros')
      const desiredOthers = target - othersTotal
      if (desiredOthers < 0) {
        toast.error(
          'O custo estimado total é menor que a soma dos custos já lançados por categoria. Ajuste os lançamentos individuais.',
        )
        return
      }
      if (others.length) {
        const primary = others[0]
        await feiraService.updateCusto(primary.id, { valor_estimado: desiredOthers })
        setCustos((current) =>
          current.map((item) =>
            item.id === primary.id ? { ...item, valor_estimado: desiredOthers } : item,
          ),
        )
      } else {
        const created = await feiraService.createCusto({
          feira: current.id,
          categoria: 'outros',
          descricao: 'Custo estimado total da feira',
          valor_estimado: desiredOthers,
          valor_realizado: 0,
        })
        setCustos((current) => [created, ...current])
      }
      toast.success('Custo estimado total salvo.')
    } catch (error) {
      console.error(error)
      toast.error('Não foi possível salvar o custo estimado total.')
    } finally {
      setSavingTotalEstimated(false)
    }
  }

  const openNewResultado = () => {
    if (!selectedFeiraId) return toast.info('Selecione uma feira antes de adicionar um resultado.')
    setEditingResultado(null)
    setResultadoForm(emptyResultado)
    setResultadoDialog(true)
  }

  const openPedidoDialog = () => {
    if (!selectedFeiraId) return toast.info('Selecione uma feira antes de importar um pedido.')
    setPedidoFile(null)
    setPedidoReviewReady(false)
    setPedidoReadingMessage('')
    setPedidoDialog(true)
  }

  const applyPedidoRead = async (file: File) => {
    setPedidoFile(file)
    setPedidoReading(true)
    setPedidoReviewReady(false)
    try {
      const text = await readPedidoFile(file, setPedidoReadingMessage)
      const parsed = parsePedidoText(text)
      const importedForm: PedidoForm = {
        ...emptyResultado,
        ...parsed,
        pedido_arquivo: file,
        pedido_nome_arquivo: file.name,
        pedido_texto_extraido: text.slice(0, 100000),
        pedido_leitura_status: Object.keys(parsed).length ? 'processado' : 'revisao_manual',
      }
      setResultadoForm(importedForm)
      setEditingResultado(null)
      setPedidoReviewReady(true)
      setPedidoDialog(false)
      setResultadoDialog(true)
      toast.success(
        Object.keys(parsed).length
          ? 'Pedido lido. Revise os campos antes de salvar.'
          : 'Arquivo recebido. Preencha ou revise os campos manualmente.',
      )
    } catch (error) {
      console.error(error)
      const message = error instanceof Error ? error.message : 'erro desconhecido'
      setResultadoForm((current) => ({
        ...current,
        pedido_arquivo: file,
        pedido_nome_arquivo: file.name,
        pedido_texto_extraido: `Falha na leitura automática: ${message}`,
        pedido_leitura_status: 'erro',
      }))
      setPedidoReviewReady(true)
      setPedidoDialog(false)
      setResultadoDialog(true)
      toast.error('Não foi possível ler automaticamente o pedido. Revise os campos manualmente.')
    } finally {
      setPedidoReading(false)
      setPedidoReadingMessage('')
    }
  }

  const handlePedidoPaste = async (event: React.ClipboardEvent<HTMLDivElement>) => {
    const image = Array.from(event.clipboardData.items).find((item) =>
      item.type.startsWith('image/'),
    )
    if (!image) return
    event.preventDefault()
    const file = image.getAsFile()
    if (file)
      await applyPedidoRead(
        new File([file], `pedido-colado-${Date.now()}.png`, { type: file.type }),
      )
  }

  const openEditResultado = (resultado: FeiraResultado) => {
    setEditingResultado(resultado)
    setResultadoForm({
      cliente: resultado.cliente || '',
      produto: resultado.produto || '',
      quantidade: String(resultado.quantidade || 0),
      valor_venda: String(resultado.valor_venda || ''),
      data_resultado: dateOnly(resultado.data_resultado),
      tipo_resultado: resultado.tipo_resultado,
      observacoes: resultado.observacoes || '',
      numero_pedido: resultado.numero_pedido || '',
      pedido_arquivo: undefined,
      pedido_nome_arquivo: resultado.pedido_nome_arquivo || '',
      pedido_texto_extraido: resultado.pedido_texto_extraido || '',
      pedido_leitura_status: resultado.pedido_leitura_status || 'manual',
    })
    setResultadoDialog(true)
  }

  const saveResultado = async (event: React.FormEvent) => {
    event.preventDefault()
    const feiraId = editingResultado?.feira || selectedFeiraId
    if (!feiraId) return toast.error('Selecione uma feira.')
    setSaving(true)
    try {
      const payload = {
        feira: feiraId,
        ...resultadoForm,
        quantidade: money(resultadoForm.quantidade),
        valor_venda: money(resultadoForm.valor_venda),
        pedido_leitura_status: resultadoForm.pedido_arquivo
          ? resultadoForm.pedido_leitura_status || 'revisao_manual'
          : resultadoForm.pedido_leitura_status || 'manual',
      }
      const saved = editingResultado
        ? await feiraService.updateResultado(editingResultado.id, payload)
        : await feiraService.createResultado(payload)
      setResultados((current) =>
        editingResultado
          ? current.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...current],
      )
      setResultadoDialog(false)
      toast.success(editingResultado ? 'Resultado atualizado.' : 'Resultado registrado.')
    } catch (error) {
      console.error(error)
      toast.error('Não foi possível salvar o resultado.')
    } finally {
      setSaving(false)
    }
  }

  const confirmDeleteResultado = async () => {
    if (!deleteResultado) return
    try {
      await feiraService.deleteResultado(deleteResultado.id)
      setResultados((current) => current.filter((item) => item.id !== deleteResultado.id))
      toast.success('Resultado removido.')
    } catch (error) {
      console.error(error)
      toast.error('Não foi possível remover o resultado.')
    } finally {
      setDeleteResultado(null)
    }
  }

  const handleFileImport = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selectedFeiraId || !arquivoFile) return toast.error('Selecione uma feira e um arquivo.')
    setArquivoReading(true)
    try {
      const extension = arquivoFile.name.split('.').pop()?.toLowerCase() || ''
      const textual =
        ['txt', 'csv', 'json'].includes(extension) || arquivoFile.type.startsWith('text/')
      let text = ''
      let items: Array<{ categoria: FeiraCustoCategoria; descricao: string; valor: number }> = []
      let status: FeiraLeituraStatus = 'revisao_manual'
      let note =
        'Formato recebido. A leitura automática não identificou um formato textual estruturado; revise e lance os custos manualmente.'
      if (textual) {
        text = await readTextFile(arquivoFile)
        items = parseRowsFromText(text)
        if (items.length) {
          status = 'processado'
          note = `${items.length} custo(s) identificado(s) automaticamente e lançado(s) como realizado.`
        } else {
          status = 'revisao_manual'
          note = 'Arquivo lido, mas nenhum valor de custo foi identificado com segurança.'
        }
      } else {
        note =
          'PDF, imagem ou planilha recebidos para conferência. A leitura automática segura nesta versão está disponível para TXT, CSV e JSON.'
      }
      const total = items.reduce((sum, item) => sum + item.valor, 0)
      const fileRecord = await feiraService.createArquivo({
        feira: selectedFeiraId,
        arquivo: arquivoFile,
        nome_arquivo: arquivoFile.name,
        tipo_arquivo: arquivoTipo,
        leitura_status: status,
        texto_extraido: text.slice(0, 100000),
        dados_extraidos: { itens: items },
        total_custo_extraido: total,
        custos_importados: items.length,
        observacoes: note,
      })
      setArquivos((current) => [fileRecord, ...current])
      if (items.length) {
        const created = await Promise.all(
          items.map((item) =>
            feiraService.createCusto({
              feira: selectedFeiraId,
              categoria: item.categoria,
              descricao: `Importado de ${arquivoFile.name}: ${item.descricao}`,
              valor_estimado: 0,
              valor_realizado: item.valor,
              data_custo: new Date().toISOString(),
            }),
          ),
        )
        setCustos((current) => [...created, ...current])
      }
      setArquivoDialog(false)
      setArquivoFile(null)
      toast.success(
        status === 'processado'
          ? `${items.length} custo(s) importado(s) automaticamente.`
          : 'Arquivo importado para revisão manual.',
      )
    } catch (error) {
      console.error(error)
      toast.error('Não foi possível importar o arquivo.')
    } finally {
      setArquivoReading(false)
    }
  }

  const confirmDeleteArquivo = async () => {
    if (!deleteArquivo) return
    try {
      await feiraService.deleteArquivo(deleteArquivo.id)
      setArquivos((current) => current.filter((item) => item.id !== deleteArquivo.id))
      toast.success('Arquivo removido.')
    } catch (error) {
      console.error(error)
      toast.error('Não foi possível remover o arquivo.')
    } finally {
      setDeleteArquivo(null)
    }
  }

  const selectedFeira = feiras.find((feira) => feira.id === selectedFeiraId)
  const selectedCosts = custos.filter((item) => item.feira === selectedFeiraId)
  const selectedResults = resultados.filter((item) => item.feira === selectedFeiraId)
  const selectedFiles = arquivos.filter((item) => item.feira === selectedFeiraId)
  const selectedRealized = selectedCosts.reduce((sum, item) => sum + (item.valor_realizado || 0), 0)
  const selectedEstimated = selectedCosts.reduce((sum, item) => sum + (item.valor_estimado || 0), 0)
  const selectedSales = selectedResults
    .filter((item) => item.tipo_resultado === 'venda_realizada')
    .reduce((sum, item) => sum + (item.valor_venda || 0), 0)

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-[#D92323] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-6 px-4 py-5 sm:px-6 md:py-6 lg:px-8">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-[#1E293B] sm:text-2xl">
              Feiras e Eventos
            </h1>
            <Badge
              variant="outline"
              className="border-[#FCA5A5] bg-[#FEE2E2] text-[10px] text-[#B91C1C]"
            >
              Administração
            </Badge>
          </div>
          <p className="mt-1 text-xs text-[#64748B] sm:text-sm">
            Custos, resultados e retorno das participações da Haramaq no agronegócio.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void loadAll()} className="h-9 gap-2 text-xs">
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar
          </Button>
          <Button
            onClick={openNewFeira}
            className="h-9 gap-2 bg-[#D92323] text-xs text-white hover:bg-[#B91C1C]"
          >
            <Plus className="h-4 w-4" /> Nova feira/evento
          </Button>
        </div>
      </div>

      <Card className="rounded-xl border border-[#E2E8F0] bg-white shadow-xs">
        <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1 lg:col-span-1">
            <Label className="text-[11px]">Feira/evento</Label>
            <Select
              value={selectedFeiraId || 'todas'}
              onValueChange={(value) => setSelectedFeiraId(value === 'todas' ? '' : value)}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Todas as feiras" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as feiras</SelectItem>
                {feiras.map((feira) => (
                  <SelectItem key={feira.id} value={feira.id}>
                    {feira.nome}
                    {feira.edicao ? ` — ${feira.edicao}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">Período inicial</Label>
            <Input
              type="date"
              value={filterFrom}
              onChange={(event) => setFilterFrom(event.target.value)}
              className="h-9 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">Período final</Label>
            <Input
              type="date"
              value={filterTo}
              onChange={(event) => setFilterTo(event.target.value)}
              className="h-9 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">Tipo de custo</Label>
            <Select value={filterCostCategory} onValueChange={setFilterCostCategory}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todos os custos</SelectItem>
                {FEIRA_COST_CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category}>
                    {FEIRA_COST_LABELS[category]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">Tipo de resultado</Label>
            <Select value={filterResultType} onValueChange={setFilterResultType}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os resultados</SelectItem>
                {Object.entries(FEIRA_RESULT_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {[
          ['Feiras no painel', String(dashboardFeiras.length), 'Participações filtradas'],
          ['Custo estimado', formatCurrencyBRL(totalEstimated), 'Planejamento aprovado'],
          [
            'Custo realizado',
            formatCurrencyBRL(totalRealized),
            `${percent(totalRealized, totalEstimated)} do estimado`,
          ],
          [
            'Vendas realizadas',
            formatCurrencyBRL(totalSales),
            `${filteredResultados.filter((item) => item.tipo_resultado === 'venda_realizada').length} registro(s)`,
          ],
          [
            'Resultado líquido',
            formatCurrencyBRL(totalSales - totalRealized),
            'Vendas menos custos',
          ],
          [
            'ROI do painel',
            `${roi.toFixed(1)}%`,
            `${totalProposals > 0 ? formatCurrencyBRL(totalProposals) : 'Sem propostas'} · ${totalLeads} lead(s)`,
          ],
        ].map(([label, value, helper]) => (
          <Card key={label} className="rounded-xl border border-[#E2E8F0] bg-white shadow-xs">
            <CardContent className="p-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                {label}
              </span>
              <p className="mt-1 text-xl font-black text-[#1E293B]">{value}</p>
              <p className="mt-1 text-[10px] text-[#64748B]">{helper}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="rounded-xl border border-[#E2E8F0] bg-white shadow-xs">
          <CardHeader className="border-b border-[#F1F5F9] pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <BarChart3 className="h-4 w-4 text-[#D92323]" /> Estimado x realizado por feira
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="h-72">
              {comparisonData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonData} margin={{ bottom: 80, left: 10, right: 10 }}>
                    <XAxis
                      dataKey="name"
                      angle={-28}
                      textAnchor="end"
                      interval={0}
                      height={90}
                      fontSize={10}
                    />
                    <YAxis
                      tickFormatter={(value) => `R$ ${(Number(value) / 1000).toFixed(0)}k`}
                      fontSize={10}
                    />
                    <Tooltip formatter={(value) => formatCurrencyBRL(Number(value))} />
                    <Legend />
                    <Bar dataKey="estimado" name="Estimado" fill="#94A3B8" radius={[4, 4, 0, 0]} />
                    <Bar
                      dataKey="realizado"
                      name="Realizado"
                      fill="#D92323"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-[#94A3B8]">
                  Cadastre feiras para comparar custos.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border border-[#E2E8F0] bg-white shadow-xs">
          <CardHeader className="border-b border-[#F1F5F9] pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <PieIcon className="h-4 w-4 text-[#1B4332]" /> Composição dos custos realizados
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="h-72">
              {categoryPercentages.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryPercentages}
                      dataKey="realized"
                      nameKey="nome"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={3}
                    >
                      {categoryPercentages.map((item, index) => (
                        <Cell
                          key={item.categoria}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrencyBRL(Number(value))} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-[#94A3B8]">
                  Registre custos realizados para visualizar a composição.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border border-[#E2E8F0] bg-white shadow-xs">
          <CardHeader className="border-b border-[#F1F5F9] pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <LineChart className="h-4 w-4 text-[#2563EB]" /> Comparação entre feiras/edições
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="h-72">
              {fairMetrics.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsLineChart
                    data={fairMetrics.map((item) => ({
                      name: item.feira.edicao
                        ? `${item.feira.nome} — ${item.feira.edicao}`
                        : item.feira.nome,
                      vendas: item.sales,
                      resultado: item.result,
                    }))}
                    margin={{ bottom: 65, left: 10, right: 10 }}
                  >
                    <XAxis
                      dataKey="name"
                      angle={-28}
                      textAnchor="end"
                      interval={0}
                      height={78}
                      fontSize={10}
                    />
                    <YAxis
                      tickFormatter={(value) => `R$ ${(Number(value) / 1000).toFixed(0)}k`}
                      fontSize={10}
                    />
                    <Tooltip formatter={(value) => formatCurrencyBRL(Number(value))} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="vendas"
                      name="Vendas"
                      stroke="#1B4332"
                      strokeWidth={3}
                    />
                    <Line
                      type="monotone"
                      dataKey="resultado"
                      name="Resultado líquido"
                      stroke="#D92323"
                      strokeWidth={3}
                    />
                  </RechartsLineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-[#94A3B8]">
                  Cadastre resultados para comparar edições.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border border-[#E2E8F0] bg-white shadow-xs">
          <CardHeader className="border-b border-[#F1F5F9] pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <TrendingUp className="h-4 w-4 text-[#0F766E]" /> Ranking por resultado
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-3">
              {fairMetrics.length ? (
                fairMetrics.slice(0, 8).map((item, index) => (
                  <div
                    key={item.feira.id}
                    className="flex items-center gap-3 rounded-lg border border-[#F1F5F9] p-3"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FEE2E2] text-xs font-black text-[#D92323]">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-[#1E293B]">
                        {item.feira.nome}
                        {item.feira.edicao ? ` — ${item.feira.edicao}` : ''}
                      </p>
                      <p className="text-[10px] text-[#64748B]">
                        {formatCurrencyBRL(item.sales)} em vendas · ROI {item.roi.toFixed(1)}%
                      </p>
                    </div>
                    <strong
                      className={
                        item.result >= 0 ? 'text-xs text-emerald-700' : 'text-xs text-red-700'
                      }
                    >
                      {formatCurrencyBRL(item.result)}
                    </strong>
                  </div>
                ))
              ) : (
                <p className="py-12 text-center text-xs text-[#94A3B8]">
                  O ranking aparecerá após o cadastro das feiras.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-xs">
        <CardHeader className="flex flex-col justify-between gap-3 border-b border-[#F1F5F9] pb-3 sm:flex-row sm:items-center">
          <div>
            <CardTitle className="text-sm">Feiras cadastradas</CardTitle>
            <p className="mt-1 text-[11px] text-[#64748B]">
              Percentual de cada feira sobre o total anual de custos aparece no ranking.
            </p>
          </div>
          <Button
            onClick={openNewFeira}
            className="h-8 gap-1.5 bg-[#D92323] text-xs text-white hover:bg-[#B91C1C]"
          >
            <Plus className="h-3.5 w-3.5" /> Adicionar feira
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-xs">
              <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[10px] uppercase tracking-wider text-[#64748B]">
                <tr>
                  <th className="px-4 py-3">Feira / edição</th>
                  <th className="px-4 py-3">Período</th>
                  <th className="px-4 py-3">Local</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Estimado</th>
                  <th className="px-4 py-3">Realizado</th>
                  <th className="px-4 py-3">Vendas</th>
                  <th className="px-4 py-3">% ano</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {feiras.map((feira) => {
                  const item = fairMetrics.find((metric) => metric.feira.id === feira.id) || {
                    estimated: 0,
                    realized: 0,
                    sales: 0,
                    annualPercent: 0,
                    result: 0,
                  }
                  return (
                    <tr
                      key={feira.id}
                      className={
                        selectedFeiraId === feira.id ? 'bg-[#FFF7F7]' : 'hover:bg-[#F8FAFC]'
                      }
                    >
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setSelectedFeiraId(feira.id)}
                          className="text-left"
                        >
                          <p className="font-bold text-[#1E293B]">{feira.nome}</p>
                          <p className="text-[10px] text-[#64748B]">
                            {feira.edicao || 'Edição não informada'} · {feira.ano}
                          </p>
                        </button>
                      </td>
                      <td className="px-4 py-3 text-[#475569]">
                        {formatDateBR(feira.data_inicio)} — {formatDateBR(feira.data_fim)}
                      </td>
                      <td className="px-4 py-3 text-[#475569]">
                        {feira.cidade || '—'}
                        {feira.estado ? ` - ${feira.estado}` : ''}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${statusClass(feira.status)}`}
                        >
                          {FEIRA_STATUS_LABELS[feira.status]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {formatCurrencyBRL(item.estimated)}
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {formatCurrencyBRL(item.realized)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#1B4332]">
                        {formatCurrencyBRL(item.sales)}
                      </td>
                      <td className="px-4 py-3 text-[#475569]">{item.annualPercent.toFixed(1)}%</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedFeiraId(feira.id)}
                            title="Ver detalhes"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditFeira(feira)}
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteFeira(feira)}
                            title="Remover"
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {!feiras.length && (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-sm text-[#94A3B8]">
                      Nenhuma feira cadastrada. Adicione a primeira participação.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {selectedFeira && (
        <Card className="rounded-xl border border-[#E2E8F0] bg-white shadow-xs">
          <CardHeader className="flex flex-col justify-between gap-3 border-b border-[#F1F5F9] pb-3 lg:flex-row lg:items-start">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm">
                <CalendarDays className="h-4 w-4 text-[#D92323]" /> {selectedFeira.nome}
                {selectedFeira.edicao ? ` — ${selectedFeira.edicao}` : ''}
              </CardTitle>
              <p className="mt-1 text-[11px] text-[#64748B]">
                Custo realizado: {formatCurrencyBRL(selectedRealized)} · Estimado:{' '}
                {formatCurrencyBRL(selectedEstimated)} · Vendas: {formatCurrencyBRL(selectedSales)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={openNewCusto} variant="outline" className="h-8 gap-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" /> Custo
              </Button>
              <Button onClick={openNewResultado} variant="outline" className="h-8 gap-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" /> Resultado
              </Button>
              <Button
                onClick={() => setArquivoDialog(true)}
                variant="outline"
                className="h-8 gap-1.5 text-xs"
              >
                <Upload className="h-3.5 w-3.5" /> Importar arquivo
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 p-4">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 xl:col-span-2">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-[#64748B]">
                    Custo estimado total da feira
                  </h3>
                  <Button
                    onClick={() => void saveTotalEstimated()}
                    disabled={savingTotalEstimated}
                    className="h-8 gap-1.5 bg-[#D92323] text-xs text-white hover:bg-[#B91C1C]"
                  >
                    <Save className="h-3.5 w-3.5" />{' '}
                    {savingTotalEstimated ? 'Salvando...' : 'Salvar custo estimado'}
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-md border border-[#E2E8F0] bg-white p-2">
                    <p className="text-[11px] font-semibold text-[#1E293B]">Custo estimado total</p>
                    <div className="mt-1.5">
                      <Label className="text-[10px] text-[#64748B]">Estimado (R$)</Label>
                      <Input
                        value={totalEstimatedInput}
                        onChange={(event) => setTotalEstimatedInput(event.target.value)}
                        placeholder="R$ 0,00"
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-[#64748B]">
                    Custos e estimativas
                  </h3>
                  <span className="text-[10px] text-[#64748B]">% do evento</span>
                </div>
                <div className="overflow-x-auto rounded-lg border border-[#E2E8F0]">
                  <table className="w-full min-w-[680px] text-xs">
                    <thead className="bg-[#F8FAFC] text-[10px] uppercase text-[#64748B]">
                      <tr>
                        <th className="px-3 py-2 text-left">Categoria</th>
                        <th className="px-3 py-2 text-left">Descrição</th>
                        <th className="px-3 py-2 text-right">Realizado</th>
                        <th className="px-3 py-2 text-right">%</th>
                        <th className="px-3 py-2 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {selectedCosts.map((item) => (
                        <tr key={item.id}>
                          <td className="px-3 py-2">{FEIRA_COST_LABELS[item.categoria]}</td>
                          <td className="px-3 py-2 text-[#64748B]">{item.descricao || '—'}</td>
                          <td className="px-3 py-2 text-right font-semibold">
                            {formatCurrencyBRL(item.valor_realizado)}
                          </td>
                          <td className="px-3 py-2 text-right text-[#64748B]">
                            {percent(item.valor_realizado, selectedRealized)}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex justify-end">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditCusto(item)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteCusto(item)}
                                className="text-red-600"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!selectedCosts.length && (
                        <tr>
                          <td colSpan={6} className="px-3 py-8 text-center text-xs text-[#94A3B8]">
                            Nenhum custo registrado.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-wide text-[#64748B]">
                      Resultados comerciais
                    </h3>
                    <span className="text-[10px] text-[#64748B]">Vendas e oportunidades</span>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      variant="outline"
                      className="h-8 gap-1.5 text-[11px]"
                      onClick={openPedidoDialog}
                    >
                      <Upload className="h-3.5 w-3.5" /> Importar pedido
                    </Button>
                    <Button
                      variant="outline"
                      className="h-8 gap-1.5 text-[11px]"
                      onClick={openNewResultado}
                    >
                      <Plus className="h-3.5 w-3.5" /> Registrar manualmente
                    </Button>
                  </div>
                </div>
                <div className="overflow-x-auto rounded-lg border border-[#E2E8F0]">
                  <table className="w-full min-w-[620px] text-xs">
                    <thead className="bg-[#F8FAFC] text-[10px] uppercase text-[#64748B]">
                      <tr>
                        <th className="px-3 py-2 text-left">Tipo</th>
                        <th className="px-3 py-2 text-left">Cliente / produto</th>
                        <th className="px-3 py-2 text-right">Qtd.</th>
                        <th className="px-3 py-2 text-right">Valor</th>
                        <th className="px-3 py-2 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {selectedResults.map((item) => (
                        <tr key={item.id}>
                          <td className="px-3 py-2">{FEIRA_RESULT_LABELS[item.tipo_resultado]}</td>
                          <td className="px-3 py-2 text-[#64748B]">
                            {item.cliente || '—'}
                            {item.numero_pedido ? ` · Pedido Nº ${item.numero_pedido}` : ''}
                            {item.produto ? ` · ${item.produto}` : ''}
                          </td>
                          <td className="px-3 py-2 text-right">{item.quantidade || 0}</td>
                          <td className="px-3 py-2 text-right font-semibold">
                            {formatCurrencyBRL(item.valor_venda)}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex justify-end">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditResultado(item)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteResultado(item)}
                                className="text-red-600"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!selectedResults.length && (
                        <tr>
                          <td colSpan={5} className="px-3 py-8 text-center text-xs text-[#94A3B8]">
                            Nenhum resultado registrado.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wide text-[#64748B]">
                  Arquivos importados
                </h3>
                <span className="text-[10px] text-[#64748B]">
                  Relatórios, comprovantes e notas fiscais
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {selectedFiles.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 rounded-lg border border-[#E2E8F0] p-3"
                  >
                    <FileText className="mt-0.5 h-4 w-4 text-[#D92323]" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-[#1E293B]">
                        {item.nome_arquivo}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${readClass(item.leitura_status)}`}
                        >
                          {item.leitura_status === 'processado'
                            ? 'Processado'
                            : item.leitura_status === 'revisao_manual'
                              ? 'Revisão manual'
                              : 'Erro'}
                        </Badge>
                        <span className="text-[10px] text-[#64748B]">
                          {item.custos_importados || 0} custo(s) ·{' '}
                          {formatCurrencyBRL(item.total_custo_extraido || 0)}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] text-[#64748B]">
                        {item.observacoes || 'Sem observações.'}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteArquivo(item)}
                      className="text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                {!selectedFiles.length && (
                  <div className="rounded-lg border border-dashed border-[#CBD5E1] p-6 text-center text-xs text-[#94A3B8] md:col-span-2">
                    Nenhum arquivo importado para esta feira.
                  </div>
                )}
              </div>
            </div>
            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-[#64748B]">
                Percentuais de custos do evento
              </h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {categoryPercentages.map((item) => (
                  <div key={item.categoria} className="rounded-lg bg-[#F8FAFC] p-3">
                    <p className="text-[10px] text-[#64748B]">{item.nome}</p>
                    <p className="mt-1 text-sm font-black text-[#1E293B]">{item.eventPercent}</p>
                    <p className="text-[10px] text-[#64748B]">{formatCurrencyBRL(item.realized)}</p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={feiraDialog} onOpenChange={setFeiraDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingFeira ? 'Editar feira/evento' : 'Nova feira/evento'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveFeira} className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label>Nome da feira/evento *</Label>
              <Input
                value={feiraForm.nome}
                onChange={(event) =>
                  setFeiraForm((current) => ({ ...current, nome: event.target.value }))
                }
                placeholder="Ex.: Expointer"
              />
            </div>
            <div className="space-y-1">
              <Label>Edição</Label>
              <Input
                value={feiraForm.edicao}
                onChange={(event) =>
                  setFeiraForm((current) => ({ ...current, edicao: event.target.value }))
                }
                placeholder="Ex.: 2026"
              />
            </div>
            <div className="space-y-1">
              <Label>Organizador</Label>
              <Input
                value={feiraForm.organizador}
                onChange={(event) =>
                  setFeiraForm((current) => ({ ...current, organizador: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Cidade</Label>
              <Input
                value={feiraForm.cidade}
                onChange={(event) =>
                  setFeiraForm((current) => ({ ...current, cidade: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>UF</Label>
              <Input
                maxLength={2}
                value={feiraForm.estado}
                onChange={(event) =>
                  setFeiraForm((current) => ({
                    ...current,
                    estado: event.target.value.toUpperCase(),
                  }))
                }
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Local</Label>
              <Input
                value={feiraForm.local}
                onChange={(event) =>
                  setFeiraForm((current) => ({ ...current, local: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Data inicial</Label>
              <Input
                type="date"
                value={feiraForm.data_inicio}
                onChange={(event) =>
                  setFeiraForm((current) => ({ ...current, data_inicio: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Data final</Label>
              <Input
                type="date"
                value={feiraForm.data_fim}
                onChange={(event) =>
                  setFeiraForm((current) => ({ ...current, data_fim: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Ano</Label>
              <Input
                type="number"
                min={2000}
                max={2200}
                value={feiraForm.ano}
                onChange={(event) =>
                  setFeiraForm((current) => ({ ...current, ano: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select
                value={feiraForm.status}
                onValueChange={(value) =>
                  setFeiraForm((current) => ({ ...current, status: value as Feira['status'] }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FEIRA_STATUS_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Descrição</Label>
              <Textarea
                value={feiraForm.descricao}
                onChange={(event) =>
                  setFeiraForm((current) => ({ ...current, descricao: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Observações</Label>
              <Textarea
                value={feiraForm.observacoes}
                onChange={(event) =>
                  setFeiraForm({ ...feiraForm, observacoes: event.target.value })
                }
              />
            </div>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setFeiraDialog(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="gap-2 bg-[#D92323] text-white hover:bg-[#B91C1C]"
              >
                <Save className="h-4 w-4" /> {saving ? 'Salvando...' : 'Salvar feira'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={custoDialog} onOpenChange={setCustoDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingCusto ? 'Editar custo' : 'Registrar custo'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-xs">
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-[11px] text-blue-900">
              Envie a nota, comprovante ou print, ou cole um print com Ctrl+V. A leitura automática
              preenche os campos para revisão antes de salvar.
            </div>
            <div
              className="rounded-lg border-2 border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-4 text-center outline-none focus:border-[#D92323]"
              tabIndex={0}
              onPaste={(event) => void handleCustoAnexoPaste(event)}
            >
              <Upload className="mx-auto h-6 w-6 text-[#D92323]" />
              <p className="mt-1.5 font-semibold text-[#1E293B]">Cole o print do custo aqui</p>
              <p className="mt-1 text-[11px] text-[#64748B]">Use Ctrl+V após copiar a imagem.</p>
            </div>
            <div className="space-y-1">
              <Label>Anexo (nota, comprovante ou print)</Label>
              <Input
                type="file"
                accept=".txt,.csv,.json,.pdf,.jpg,.jpeg,.png,.webp"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void applyCustoAnexoRead(file)
                }}
              />
              {custoAnexoNome && (
                <p className="text-[11px] text-[#64748B]">Anexo: {custoAnexoNome}</p>
              )}
            </div>
            {custoReading && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-900">
                {custoReadingMessage || 'Lendo anexo...'}
              </div>
            )}
          </div>
          <form onSubmit={saveCusto} className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Categoria *</Label>
              <Select
                value={custoForm.categoria}
                onValueChange={(value) =>
                  setCustoForm({ ...custoForm, categoria: value as FeiraCustoCategoria })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FEIRA_COST_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {FEIRA_COST_LABELS[category]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Data do custo</Label>
              <Input
                type="date"
                value={custoForm.data_custo}
                onChange={(event) => setCustoForm({ ...custoForm, data_custo: event.target.value })}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Descrição</Label>
              <Input
                value={custoForm.descricao}
                onChange={(event) => setCustoForm({ ...custoForm, descricao: event.target.value })}
                placeholder="Ex.: montagem, diária, nota fiscal..."
              />
            </div>
            <div className="space-y-1">
              <Label>Fornecedor</Label>
              <Input
                value={custoForm.fornecedor}
                onChange={(event) => setCustoForm({ ...custoForm, fornecedor: event.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Custo realizado (R$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={custoForm.valor_realizado}
                onChange={(event) =>
                  setCustoForm({ ...custoForm, valor_realizado: event.target.value })
                }
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Observações</Label>
              <Textarea
                value={custoForm.observacoes}
                onChange={(event) =>
                  setCustoForm({ ...custoForm, observacoes: event.target.value })
                }
              />
            </div>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setCustoDialog(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="gap-2 bg-[#D92323] text-white hover:bg-[#B91C1C]"
              >
                <Save className="h-4 w-4" /> Salvar custo
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={pedidoDialog} onOpenChange={setPedidoDialog}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Importar pedido para resultado comercial</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-xs">
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-[11px] text-blue-900">
              Envie o arquivo do pedido ou cole um print nesta área. A leitura é automática e os
              campos serão abertos para revisão antes de gravar.
            </div>
            <div
              className="rounded-lg border-2 border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-6 text-center outline-none focus:border-[#D92323]"
              tabIndex={0}
              onPaste={(event) => void handlePedidoPaste(event)}
            >
              <Upload className="mx-auto h-7 w-7 text-[#D92323]" />
              <p className="mt-2 font-semibold text-[#1E293B]">Cole o print do pedido aqui</p>
              <p className="mt-1 text-[11px] text-[#64748B]">Use Ctrl+V após copiar a imagem.</p>
            </div>
            <div className="space-y-1">
              <Label>Arquivo do pedido</Label>
              <Input
                type="file"
                accept=".txt,.csv,.json,.pdf,.jpg,.jpeg,.png,.webp"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void applyPedidoRead(file)
                }}
              />
              <p className="text-[10px] text-[#64748B]">
                Formatos aceitos: TXT, CSV, JSON, PDF, JPG, PNG e WEBP. O arquivo será anexado ao
                resultado após a revisão.
              </p>
            </div>
            {pedidoReading && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-900">
                {pedidoReadingMessage || 'Lendo pedido...'}
              </div>
            )}
            {pedidoFile && !pedidoReading && !pedidoReviewReady && (
              <p className="text-[11px] text-[#64748B]">Arquivo selecionado: {pedidoFile.name}</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPedidoDialog(false)}>
                Cancelar
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={resultadoDialog} onOpenChange={setResultadoDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingResultado ? 'Editar resultado' : 'Registrar resultado comercial'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={saveResultado} className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Tipo de resultado *</Label>
              <Select
                value={resultadoForm.tipo_resultado}
                onValueChange={(value) =>
                  setResultadoForm((current) => ({
                    ...current,
                    tipo_resultado: value as FeiraResultadoTipo,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FEIRA_RESULT_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Data</Label>
              <Input
                type="date"
                value={resultadoForm.data_resultado}
                onChange={(event) =>
                  setResultadoForm((current) => ({
                    ...current,
                    data_resultado: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Comprador (cliente)</Label>
              <Input
                value={resultadoForm.cliente}
                onChange={(event) =>
                  setResultadoForm((current) => ({ ...current, cliente: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Número do pedido</Label>
              <Input
                value={resultadoForm.numero_pedido}
                onChange={(event) =>
                  setResultadoForm((current) => ({ ...current, numero_pedido: event.target.value }))
                }
                placeholder="Ex.: 1755"
              />
            </div>
            <div className="space-y-1">
              <Label>Produto / equipamento</Label>
              <Input
                value={resultadoForm.produto}
                onChange={(event) =>
                  setResultadoForm((current) => ({ ...current, produto: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Quantidade</Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={resultadoForm.quantidade}
                onChange={(event) =>
                  setResultadoForm((current) => ({ ...current, quantidade: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={resultadoForm.valor_venda}
                onChange={(event) =>
                  setResultadoForm((current) => ({ ...current, valor_venda: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Observações</Label>
              <Textarea
                value={resultadoForm.observacoes}
                onChange={(event) =>
                  setResultadoForm((current) => ({ ...current, observacoes: event.target.value }))
                }
              />
              {resultadoForm.pedido_texto_extraido && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-900 sm:col-span-2">
                  <p className="font-semibold">Leitura automática para revisão</p>
                  <p className="mt-1">
                    {resultadoForm.pedido_nome_arquivo || 'Pedido recebido'} · revise os campos
                    acima antes de salvar.
                  </p>
                  <details className="mt-2">
                    <summary className="cursor-pointer font-medium">Ver texto extraído</summary>
                    <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-white/70 p-2 text-[10px]">
                      {resultadoForm.pedido_texto_extraido}
                    </pre>
                  </details>
                </div>
              )}
            </div>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setResultadoDialog(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="gap-2 bg-[#D92323] text-white hover:bg-[#B91C1C]"
              >
                <Save className="h-4 w-4" /> Salvar resultado
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={arquivoDialog} onOpenChange={setArquivoDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Importar relatório, comprovante ou nota fiscal</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleFileImport} className="space-y-4 text-xs">
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-[11px] text-blue-800">
              A leitura automática identifica custos em arquivos TXT, CSV e JSON. PDFs, imagens e
              planilhas ficam registrados para revisão manual quando não houver extração segura.
            </div>
            <div className="space-y-1">
              <Label>Tipo de arquivo</Label>
              <Select
                value={arquivoTipo}
                onValueChange={(value) => setArquivoTipo(value as FeiraArquivoTipo)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="relatorio">Relatório</SelectItem>
                  <SelectItem value="comprovante">Comprovante</SelectItem>
                  <SelectItem value="nota_fiscal">Nota fiscal</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Arquivo *</Label>
              <Input
                type="file"
                accept=".txt,.csv,.json,.pdf,.xlsx,.xls,.jpg,.jpeg,.png"
                onChange={(event) => setArquivoFile(event.target.files?.[0] || null)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setArquivoDialog(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={arquivoReading || !arquivoFile}
                className="gap-2 bg-[#D92323] text-white hover:bg-[#B91C1C]"
              >
                <Upload className="h-4 w-4" />{' '}
                {arquivoReading ? 'Lendo arquivo...' : 'Importar arquivo'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {[
        [
          'feira',
          deleteFeira,
          setDeleteFeira,
          confirmDeleteFeira,
          'Remover feira?',
          'A feira, seus custos, resultados e arquivos vinculados serão removidos.',
        ],
        [
          'custo',
          deleteCusto,
          setDeleteCusto,
          confirmDeleteCusto,
          'Remover custo?',
          'Este custo será removido do evento e dos indicadores.',
        ],
        [
          'resultado',
          deleteResultado,
          setDeleteResultado,
          confirmDeleteResultado,
          'Remover resultado?',
          'Este resultado será removido dos indicadores de vendas.',
        ],
        [
          'arquivo',
          deleteArquivo,
          setDeleteArquivo,
          confirmDeleteArquivo,
          'Remover arquivo?',
          'O arquivo e o registro de leitura serão removidos.',
        ],
      ].map(([key, item, setter, action, title, description]) => (
        <AlertDialog
          key={key}
          open={Boolean(item)}
          onOpenChange={(open) => !open && (setter as (value: null) => void)(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{title as string}</AlertDialogTitle>
              <AlertDialogDescription>{description as string}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => void (action as () => Promise<void>)()}
                className="bg-[#D92323] hover:bg-[#B91C1C]"
              >
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ))}
    </div>
  )
}
