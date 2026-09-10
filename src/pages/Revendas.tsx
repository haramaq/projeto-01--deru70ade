import React, { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus,
  Search,
  Building2,
  ShieldCheck,
  Phone,
  Mail,
  MapPin,
  X,
  ExternalLink,
  Edit2,
  Trash2,
} from 'lucide-react'
import { revendaService } from '@/services/crmService'
import type { Revenda, RevendaStatus, ProdutoModelo } from '@/types/crm'
import { maskCNPJ, maskPhone } from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'

export default function Revendas() {
  const { role } = useAuth()
  const [revendas, setRevendas] = useState<Revenda[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // Modal create/edit
  const [modalOpen, setModalOpen] = useState(false)
  const [editingRevenda, setEditingRevenda] = useState<Revenda | null>(null)

  // Form states
  const [nome, setNome] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [cidade, setCidade] = useState('')
  const [estado, setEstado] = useState('')
  const [telefone, setTelefone] = useState('')
  const [contatoPrincipal, setContatoPrincipal] = useState('')
  const [email, setEmail] = useState('')
  const [modelos, setModelos] = useState<ProdutoModelo[]>(['PROHMIX'])
  const [status, setStatus] = useState<RevendaStatus>('autorizada')
  const [observacoes, setObservacoes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const isAdmin = role === 'admin'

  const loadRevendas = async () => {
    try {
      const data = await revendaService.getAll()
      setRevendas(data)
    } catch {
      toast.error('Erro ao carregar revendas.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRevendas()
  }, [])

  const filteredRevendas = useMemo(() => {
    if (!searchTerm.trim()) return revendas
    const q = searchTerm.toLowerCase().trim()
    return revendas.filter((r) => {
      return (
        (r.nome && r.nome.toLowerCase().includes(q)) ||
        (r.cidade && r.cidade.toLowerCase().includes(q)) ||
        (r.cnpj && r.cnpj.toLowerCase().includes(q))
      )
    })
  }, [revendas, searchTerm])

  const handleOpenCreate = () => {
    setEditingRevenda(null)
    setNome('')
    setCnpj('')
    setCidade('')
    setEstado('')
    setTelefone('')
    setContatoPrincipal('')
    setEmail('')
    setModelos(['PROHMIX', 'SUPERMIX'])
    setStatus('autorizada')
    setObservacoes('')
    setModalOpen(true)
  }

  const handleOpenEdit = (r: Revenda) => {
    setEditingRevenda(r)
    setNome(r.nome || '')
    setCnpj(r.cnpj || '')
    setCidade(r.cidade || '')
    setEstado(r.estado || '')
    setTelefone(r.telefone || '')
    setContatoPrincipal(r.contato_principal || '')
    setEmail(r.email || '')
    setModelos(r.modelos || ['PROHMIX'])
    setStatus(r.status || 'autorizada')
    setObservacoes(r.observacoes || '')
    setModalOpen(true)
  }

  const toggleModelo = (mod: ProdutoModelo) => {
    setModelos((prev) => (prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod]))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) {
      toast.error('O nome da revenda é obrigatório.')
      return
    }
    if (modelos.length === 0) {
      toast.error('Selecione pelo menos um modelo comercializado.')
      return
    }

    setSubmitting(true)
    try {
      const payload: Partial<Revenda> = {
        nome: nome.trim(),
        cnpj: cnpj.trim(),
        cidade: cidade.trim(),
        estado: estado.trim().toUpperCase(),
        telefone: telefone.trim(),
        contato_principal: contatoPrincipal.trim(),
        email: email.trim(),
        modelos,
        status,
        observacoes: observacoes.trim(),
      }

      if (editingRevenda) {
        const updated = await revendaService.update(editingRevenda.id, payload)
        setRevendas((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
        toast.success('Revenda atualizada com sucesso!')
      } else {
        const created = await revendaService.create(payload)
        setRevendas((prev) => [created, ...prev])
        toast.success('Revenda cadastrada com sucesso!')
      }

      setModalOpen(false)
    } catch {
      toast.error('Erro ao salvar dados da revenda.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Deseja remover o credenciamento da revenda "${name}"?`)) return
    try {
      await revendaService.delete(id)
      setRevendas((prev) => prev.filter((r) => r.id !== id))
      toast.success('Revenda excluída com sucesso.')
    } catch {
      toast.error('Erro ao excluir revenda.')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1B4332] tracking-tight">Revendas Autorizadas</h1>
          <p className="text-xs text-gray-500">
            Rede credenciada e autorizada para comercialização e suporte de vagões misturadores
          </p>
        </div>

        {isAdmin && (
          <Button
            onClick={handleOpenCreate}
            className="bg-[#DC2626] hover:bg-[#b91c1c] text-white font-semibold rounded-xl gap-2 shadow-sm transition-transform hover:scale-[1.02] self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            Nova Revenda
          </Button>
        )}
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-[16px] border border-[#E5E7EB] shadow-xs flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Buscar por nome da revenda, cidade ou CNPJ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-10 rounded-xl border-gray-200 text-xs"
          />
        </div>
        {searchTerm && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSearchTerm('')}
            className="text-xs text-gray-500 hover:text-red-600 gap-1"
          >
            <X className="w-3.5 h-3.5" />
            Limpar
          </Button>
        )}
      </div>

      {/* Grid of Reseller Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredRevendas.map((rev) => (
          <div
            key={rev.id}
            className="bg-white rounded-[16px] border border-[#E5E7EB] p-5 shadow-xs hover:shadow-md hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between"
          >
            <div>
              {/* Header: Name, Shield Icon, Badge */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-[#40916C] shrink-0" />
                    <h3 className="font-bold text-sm text-[#1B4332] line-clamp-1">{rev.nome}</h3>
                  </div>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
                    {rev.cidade ? `${rev.cidade} - ${rev.estado || ''}` : 'Região não informada'}
                  </p>
                </div>

                <Badge
                  variant="secondary"
                  className={
                    rev.status === 'autorizada'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] font-semibold'
                      : 'bg-amber-100 text-amber-800 border-amber-200 text-[10px] font-semibold'
                  }
                >
                  {rev.status === 'autorizada' ? 'Autorizada' : 'Pendente'}
                </Badge>
              </div>

              {/* Models Handled (chips) */}
              <div className="space-y-1.5 mb-4">
                <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400">
                  Modelos Comercializados:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {(rev.modelos || []).map((m) => (
                    <Badge
                      key={m}
                      variant="outline"
                      className={
                        m === 'SUPERMIX'
                          ? 'border-red-200 bg-red-50 text-[#DC2626] font-bold text-[10px]'
                          : 'border-emerald-200 bg-emerald-50 text-[#1B4332] font-bold text-[10px]'
                      }
                    >
                      {m}
                    </Badge>
                  ))}
                  {(!rev.modelos || rev.modelos.length === 0) && (
                    <span className="text-xs text-gray-400">Nenhum modelo cadastrado</span>
                  )}
                </div>
              </div>

              {/* Contact Info */}
              <div className="text-xs text-gray-600 space-y-1.5 py-3 border-t border-gray-100">
                {rev.contato_principal && (
                  <p className="font-medium text-gray-800 truncate">
                    Contato: <span className="font-normal">{rev.contato_principal}</span>
                  </p>
                )}
                {rev.telefone && (
                  <p className="flex items-center gap-1.5 text-gray-600">
                    <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span>{rev.telefone}</span>
                  </p>
                )}
                {rev.email && (
                  <p className="flex items-center gap-1.5 text-gray-600 truncate">
                    <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span className="truncate">{rev.email}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
              <Link
                to={`/revendas/${rev.id}`}
                className="text-xs font-semibold text-[#1B4332] hover:text-[#DC2626] flex items-center gap-1"
              >
                Ver desempenho <ExternalLink className="w-3 h-3" />
              </Link>

              {isAdmin && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenEdit(rev)}
                    className="h-8 w-8 p-0 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                    title="Editar Revenda"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(rev.id, rev.nome)}
                    className="h-8 w-8 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    title="Excluir Revenda"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}

        {filteredRevendas.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-400 text-xs">
            Nenhuma revenda cadastrada com os filtros aplicados.
          </div>
        )}
      </div>

      {/* Modal: New / Edit Reseller */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-xl rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#1B4332]">
              {editingRevenda ? 'Editar Revenda Autorizada' : 'Nova Revenda Autorizada'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 pt-2 text-xs">
            <div className="space-y-1">
              <Label htmlFor="rNome" className="font-semibold text-gray-700">
                Nome da Revenda / Razão Social *
              </Label>
              <Input
                id="rNome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Revenda Centro-Oeste Máquinas"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="rCnpj" className="font-semibold text-gray-700">
                  CNPJ
                </Label>
                <Input
                  id="rCnpj"
                  value={cnpj}
                  onChange={(e) => setCnpj(maskCNPJ(e.target.value))}
                  placeholder="00.000.000/0000-00"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="rTelefone" className="font-semibold text-gray-700">
                  Telefone Principal
                </Label>
                <Input
                  id="rTelefone"
                  value={telefone}
                  onChange={(e) => setTelefone(maskPhone(e.target.value))}
                  placeholder="(62) 3210-9800"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="rCidade" className="font-semibold text-gray-700">
                  Cidade Sede
                </Label>
                <Input
                  id="rCidade"
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                  placeholder="Ex: Goiânia"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="rEstado" className="font-semibold text-gray-700">
                  UF
                </Label>
                <Input
                  id="rEstado"
                  maxLength={2}
                  value={estado}
                  onChange={(e) => setEstado(e.target.value.toUpperCase())}
                  placeholder="GO"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="rContato" className="font-semibold text-gray-700">
                  Contato Comercial Principal
                </Label>
                <Input
                  id="rContato"
                  value={contatoPrincipal}
                  onChange={(e) => setContatoPrincipal(e.target.value)}
                  placeholder="Ex: Claudio Peixoto"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="rEmail" className="font-semibold text-gray-700">
                  E-mail Comercial
                </Label>
                <Input
                  id="rEmail"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="comercial@revenda.com.br"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div className="space-y-2">
                <Label className="font-semibold text-gray-700 block">
                  Modelos Comercializados *
                </Label>
                <div className="flex items-center gap-4 pt-1">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="modProhmix"
                      checked={modelos.includes('PROHMIX')}
                      onCheckedChange={() => toggleModelo('PROHMIX')}
                    />
                    <Label htmlFor="modProhmix" className="text-xs font-semibold cursor-pointer">
                      PROHMIX
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="modSupermix"
                      checked={modelos.includes('SUPERMIX')}
                      onCheckedChange={() => toggleModelo('SUPERMIX')}
                    />
                    <Label htmlFor="modSupermix" className="text-xs font-semibold cursor-pointer">
                      SUPERMIX
                    </Label>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="rStatus" className="font-semibold text-gray-700">
                  Status de Credenciamento
                </Label>
                <Select value={status} onValueChange={(val) => setStatus(val as RevendaStatus)}>
                  <SelectTrigger id="rStatus" className="h-10 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="autorizada">Autorizada</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="rObs" className="font-semibold text-gray-700">
                Observações de Cobertura e Contrato
              </Label>
              <Textarea
                id="rObs"
                rows={3}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Ex: Cobre todo o estado de Goiás, DF e sul de Tocantins..."
                className="text-xs"
              />
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                className="rounded-xl text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-[#DC2626] hover:bg-[#b91c1c] text-white rounded-xl text-xs font-semibold px-5"
              >
                {submitting ? 'Salvando...' : 'Salvar Revenda'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
