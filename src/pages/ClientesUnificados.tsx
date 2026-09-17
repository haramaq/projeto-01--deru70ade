import React, { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Edit2, Eye, MapPin, Plus, Search, Trash2, UserRound, X } from 'lucide-react'
import { clienteService, revendaService, userService } from '@/services/crmService'
import type { CadastroTipo, Cliente, Revenda, User } from '@/types/crm'
import { maskCNPJ, maskPhone, validateCNPJ } from '@/lib/formatters'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'

function maskCPF(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4')
}

function documentType(value: string, tipo: CadastroTipo): 'cpf' | 'cnpj' {
  if (tipo === 'revenda') return 'cnpj'
  return value.replace(/\D/g, '').length > 11 ? 'cnpj' : 'cpf'
}

function maskDocument(value: string, tipo: CadastroTipo) {
  return tipo === 'revenda' || value.replace(/\D/g, '').length > 11
    ? maskCNPJ(value)
    : maskCPF(value)
}

type CadastroRow = { kind: 'cliente'; data: Cliente } | { kind: 'revenda'; data: Revenda }

type FormState = {
  tipo: CadastroTipo
  externalId: string
  contato: string
  razaoSocial: string
  nomeFantasia: string
  documento: string
  email: string
  telefone: string
  inscricaoEstadual: string
  pais: string
  estado: string
  cidade: string
  cep: string
  bairro: string
  rua: string
  numero: string
  responsavel: string
  observacoes: string
  status: 'autorizada' | 'pendente'
}

const emptyForm: FormState = {
  tipo: 'cliente_final',
  externalId: '',
  contato: '',
  razaoSocial: '',
  nomeFantasia: '',
  documento: '',
  email: '',
  telefone: '',
  inscricaoEstadual: '',
  pais: 'Brasil',
  estado: '',
  cidade: '',
  cep: '',
  bairro: '',
  rua: '',
  numero: '',
  responsavel: '',
  observacoes: '',
  status: 'autorizada',
}

function rowLabel(row: CadastroRow) {
  return row.kind === 'cliente'
    ? row.data.razao_social || row.data.empresa || row.data.nome
    : row.data.razao_social || row.data.nome
}

function rowCompany(row: CadastroRow) {
  return row.kind === 'cliente'
    ? row.data.nome_fantasia || row.data.empresa || 'Cliente Final'
    : row.data.nome_fantasia || 'Revenda'
}

function rowDocument(row: CadastroRow) {
  return row.data.documento || row.data.cnpj || 'Documento não informado'
}

function rowLocation(row: CadastroRow) {
  const data = row.data
  return data.cidade
    ? `${data.cidade}${data.estado ? ` - ${data.estado}` : ''}`
    : 'Localização não informada'
}

function isClienteRow(row: CadastroRow): row is { kind: 'cliente'; data: Cliente } {
  return row.kind === 'cliente'
}

export default function ClientesUnificados() {
  const { user, role, can } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [revendas, setRevendas] = useState<Revenda[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'todos' | CadastroTipo>(
    searchParams.get('tipo') === 'revenda' ? 'revenda' : 'todos',
  )
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CadastroRow | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [transferRow, setTransferRow] = useState<CadastroRow | null>(null)
  const [transferTarget, setTransferTarget] = useState('')
  const [deleteRow, setDeleteRow] = useState<CadastroRow | null>(null)

  const canCreateClient = can('clientes')
  const canCreateRevenda = role === 'admin' || user?.perm_revendas === true
  const canCreateCadastro =
    filterType === 'revenda' ? canCreateRevenda : canCreateClient || canCreateRevenda
  const canEditClient = can('clientes')
  const canEditRevenda = role === 'admin' || role === 'vendedor' || user?.perm_revendas === true
  const isAdmin = role === 'admin'
  const canEditCadastroRow = (row: CadastroRow) => {
    if (isClienteRow(row)) return canEditClient
    return (
      canEditRevenda &&
      (isAdmin ||
        row.data.responsavel === user?.id ||
        row.data.responsavel_usuario === user?.id ||
        Boolean(user?.carteira && row.data.carteira === user.carteira))
    )
  }

  const loadData = async () => {
    try {
      const [clientResult, revendaResult, targetResult] = await Promise.allSettled([
        can('clientes') ? clienteService.getAll() : Promise.resolve([]),
        can('revendas') ? revendaService.getAll() : Promise.resolve([]),
        userService.getTransferTargets(),
      ])
      if (clientResult.status === 'fulfilled') setClientes(clientResult.value)
      if (revendaResult.status === 'fulfilled') setRevendas(revendaResult.value)
      if (targetResult.status === 'fulfilled') setUsers(targetResult.value)
      if (clientResult.status === 'rejected' && revendaResult.status === 'rejected') {
        throw clientResult.reason
      }
    } catch (error) {
      console.error(error)
      toast.error('Erro ao carregar os cadastros.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  useEffect(() => {
    const tipo = searchParams.get('tipo')
    if (tipo === 'revenda' || tipo === 'cliente_final') {
      setFilterType(tipo)
    }
  }, [searchParams])

  const rows = useMemo<CadastroRow[]>(() => {
    const all: CadastroRow[] = [
      ...(filterType === 'revenda'
        ? []
        : clientes.map((data) => ({ kind: 'cliente' as const, data }))),
      ...(filterType === 'cliente_final'
        ? []
        : revendas.map((data) => ({ kind: 'revenda' as const, data }))),
    ]
    const query = search.trim().toLowerCase()
    if (!query) return all
    return all.filter((row) =>
      [rowLabel(row), rowCompany(row), rowDocument(row), rowLocation(row), row.data.email]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query),
    )
  }, [clientes, revendas, filterType, search])

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const openCreate = (
    tipo: CadastroTipo = filterType === 'revenda' ? 'revenda' : 'cliente_final',
  ) => {
    setEditing(null)
    setErrors({})
    setForm({ ...emptyForm, tipo, responsavel: user?.id || '' })
    setModalOpen(true)
  }

  const openEdit = (row: CadastroRow) => {
    const data = row.data
    setEditing(row)
    setErrors({})
    setForm({
      tipo: row.kind === 'cliente' ? data.tipo_cadastro || 'cliente_final' : 'revenda',
      externalId: data.external_id || '',
      contato: row.kind === 'cliente' ? data.nome || '' : data.contato_principal || '',
      razaoSocial: data.razao_social || data.empresa || data.nome || '',
      nomeFantasia: data.nome_fantasia || (row.kind === 'cliente' ? data.empresa || '' : ''),
      documento: data.documento || data.cnpj || '',
      email: data.email || '',
      telefone: data.telefone || '',
      inscricaoEstadual: data.inscricao_estadual || '',
      pais: data.pais || 'Brasil',
      estado: data.estado || '',
      cidade: data.cidade || '',
      cep: data.cep || '',
      bairro: data.bairro || '',
      rua: data.rua || '',
      numero: data.numero || '',
      responsavel: data.responsavel_usuario || data.responsavel || '',
      observacoes: data.observacoes || '',
      status: row.kind === 'revenda' ? data.status || 'autorizada' : 'autorizada',
    })
    setModalOpen(true)
  }

  const validate = () => {
    const next: Record<string, string> = {}
    if (!form.razaoSocial.trim()) next.razaoSocial = 'Razão social é obrigatória.'
    if (!form.pais.trim()) next.pais = 'País é obrigatório.'
    if (!form.estado.trim()) next.estado = 'Estado é obrigatório.'
    if (!form.cidade.trim()) next.cidade = 'Cidade é obrigatória.'
    if (!form.responsavel) next.responsavel = 'Selecione um responsável.'
    const digits = form.documento.replace(/\D/g, '')
    if (form.tipo === 'revenda' && digits && digits.length !== 14) {
      next.documento = 'Revenda deve usar um CNPJ com 14 dígitos.'
    }
    if (
      form.tipo === 'cliente_final' &&
      form.documento &&
      documentType(form.documento, form.tipo) === 'cnpj' &&
      !validateCNPJ(form.documento)
    ) {
      next.documento = 'CNPJ inválido.'
    }
    if (form.email && !/\S+@\S+\.\S+/.test(form.email)) next.email = 'E-mail inválido.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!validate()) return
    setSaving(true)
    const target = users.find((item) => item.id === form.responsavel)
    const docType = documentType(form.documento, form.tipo)
    try {
      if (form.tipo === 'cliente_final') {
        const payload: Partial<Cliente> = {
          tipo_cadastro: 'cliente_final',
          external_id: editing?.data.external_id || '',
          nome: form.contato.trim() || form.razaoSocial.trim(),
          empresa: form.razaoSocial.trim(),
          razao_social: form.razaoSocial.trim(),
          nome_fantasia: form.nomeFantasia.trim(),
          documento: form.documento.trim(),
          documento_tipo: docType,
          cnpj: docType === 'cnpj' ? form.documento.trim() : '',
          email: form.email.trim(),
          telefone: form.telefone.trim(),
          inscricao_estadual: form.inscricaoEstadual.trim(),
          pais: form.pais.trim(),
          estado: form.estado.trim().toUpperCase(),
          cidade: form.cidade.trim(),
          cep: form.cep.trim(),
          bairro: form.bairro.trim(),
          rua: form.rua.trim(),
          numero: form.numero.trim(),
          responsavel: target?.id || form.responsavel,
          responsavel_usuario: target?.id || form.responsavel,
          carteira: target?.carteira || user?.carteira || '',
          status: editing && isClienteRow(editing) ? editing.data.status : 'ativo',
          observacoes: form.observacoes.trim(),
        }
        if (editing && isClienteRow(editing)) {
          const updated = await clienteService.update(editing.data.id, payload)
          setClientes((current) => current.map((item) => (item.id === updated.id ? updated : item)))
        } else {
          const created = await clienteService.create(payload)
          setClientes((current) => [created, ...current])
        }
      } else {
        const payload: Partial<Revenda> = {
          tipo_cadastro: 'revenda',
          external_id: editing?.data.external_id || '',
          nome: form.razaoSocial.trim(),
          razao_social: form.razaoSocial.trim(),
          nome_fantasia: form.nomeFantasia.trim(),
          documento: form.documento.trim(),
          documento_tipo: 'cnpj',
          cnpj: form.documento.trim(),
          contato_principal: form.contato.trim(),
          email: form.email.trim(),
          telefone: form.telefone.trim(),
          inscricao_estadual: form.inscricaoEstadual.trim(),
          pais: form.pais.trim(),
          estado: form.estado.trim().toUpperCase(),
          cidade: form.cidade.trim(),
          cep: form.cep.trim(),
          bairro: form.bairro.trim(),
          rua: form.rua.trim(),
          numero: form.numero.trim(),
          responsavel: target?.id || form.responsavel,
          responsavel_usuario: target?.id || form.responsavel,
          carteira: target?.carteira || user?.carteira || '',
          status: form.status,
          observacoes: form.observacoes.trim(),
        }
        if (editing && !isClienteRow(editing)) {
          const updated = await revendaService.update(editing.data.id, payload)
          setRevendas((current) => current.map((item) => (item.id === updated.id ? updated : item)))
        } else {
          const created = await revendaService.create(payload)
          setRevendas((current) => [created, ...current])
        }
      }
      setModalOpen(false)
      toast.success(editing ? 'Cadastro atualizado.' : 'Cadastro criado.')
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar o cadastro.')
    } finally {
      setSaving(false)
    }
  }

  const openTransfer = (row: CadastroRow) => {
    setTransferRow(row)
    setTransferTarget(row.data.responsavel_usuario || row.data.responsavel || '')
    setTransferOpen(true)
  }

  const saveTransfer = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!transferRow || !transferTarget) return
    const target = users.find((item) => item.id === transferTarget)
    if (!target) return
    setSaving(true)
    try {
      if (isClienteRow(transferRow)) {
        const updated = await clienteService.transfer(transferRow.data.id, target)
        setClientes((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      } else {
        const updated = await revendaService.transfer(transferRow.data.id, target)
        setRevendas((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      }
      setTransferOpen(false)
      toast.success('Cadastro transferido para a nova carteira.')
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Não foi possível transferir o cadastro.',
      )
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!deleteRow) return
    try {
      if (isClienteRow(deleteRow)) {
        await clienteService.delete(deleteRow.data.id)
        setClientes((current) => current.filter((item) => item.id !== deleteRow.data.id))
      } else {
        await revendaService.delete(deleteRow.data.id)
        setRevendas((current) => current.filter((item) => item.id !== deleteRow.data.id))
      }
      toast.success('Cadastro removido.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível remover o cadastro.')
    } finally {
      setDeleteRow(null)
    }
  }

  const typeBadge = (row: CadastroRow) =>
    isClienteRow(row) ? (
      <Badge className="border-blue-200 bg-blue-50 text-[10px] text-blue-700 hover:bg-blue-50">
        Cliente Final
      </Badge>
    ) : (
      <Badge className="border-purple-200 bg-purple-50 text-[10px] text-purple-700 hover:bg-purple-50">
        Revenda
      </Badge>
    )

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-[#64748B]">
        Carregando cadastros...
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[1360px] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-[#1E293B] sm:text-2xl">
              Clientes
            </h1>
            <Badge variant="outline" className="text-[10px]">
              {rows.length} cadastros
            </Badge>
          </div>
          <p className="mt-1 text-xs text-[#64748B] sm:text-sm">
            Clientes finais e revendas na mesma base de cadastros.
          </p>
        </div>
        {canCreateCadastro && (
          <Button
            type="button"
            onClick={() => openCreate()}
            className="h-9 gap-2 bg-[#D92323] text-xs font-semibold text-white hover:bg-[#B91C1C]"
          >
            <Plus className="h-4 w-4" /> Novo cadastro
          </Button>
        )}
      </div>

      <div className="mb-5 grid grid-cols-1 gap-2 rounded-xl border border-[#E2E8F0] bg-white p-3 shadow-xs md:grid-cols-[1fr_190px_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por razão social, fantasia, documento ou cidade..."
            className="h-9 pl-9 text-xs"
          />
        </div>
        <Select
          value={filterType}
          onValueChange={(value) => {
            setFilterType(value as typeof filterType)
            setSearchParams(value === 'todos' ? {} : { tipo: value }, { replace: true })
          }}
        >
          <SelectTrigger className="h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            <SelectItem value="cliente_final">Cliente Final</SelectItem>
            <SelectItem value="revenda">Revenda</SelectItem>
          </SelectContent>
        </Select>
        {search && (
          <Button
            type="button"
            variant="ghost"
            className="h-9 text-xs"
            onClick={() => setSearch('')}
          >
            <X className="mr-1 h-3.5 w-3.5" /> Limpar
          </Button>
        )}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-xs md:block">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[10px] uppercase tracking-wider text-[#64748B]">
            <tr>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Razão social / fantasia</th>
              <th className="px-4 py-3">Documento</th>
              <th className="px-4 py-3">Localização</th>
              <th className="px-4 py-3">Responsável</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0]">
            {rows.map((row) => {
              const data = row.data
              const canEditRow = canEditCadastroRow(row)
              return (
                <tr key={`${row.kind}-${data.id}`} className="hover:bg-[#F8FAFC]">
                  <td className="px-4 py-3">{typeBadge(row)}</td>
                  <td className="px-4 py-3">
                    <p className="font-bold text-[#1E293B]">{rowLabel(row)}</p>
                    <p className="text-[11px] text-[#64748B]">{rowCompany(row)}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-[#475569]">
                    {rowDocument(row)}
                  </td>
                  <td className="px-4 py-3 text-[#475569]">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-[#94A3B8]" />
                      {rowLocation(row)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#475569]">
                    <span className="flex items-center gap-1">
                      <UserRound className="h-3 w-3 text-[#94A3B8]" />
                      {users.find(
                        (item) => item.id === (data.responsavel_usuario || data.responsavel),
                      )?.name || 'Não atribuído'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Link
                        to={isClienteRow(row) ? `/clientes/${data.id}` : `/revendas/${data.id}`}
                      >
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          title="Ver detalhes"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                      {canEditRow && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          title="Editar"
                          onClick={() => openEdit(row)}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {canEditRow && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          title="Transferir"
                          onClick={() => openTransfer(row)}
                        >
                          <UserRound className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {isAdmin && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-600"
                          title="Remover"
                          onClick={() => setDeleteRow(row)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
            {!rows.length && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-[#94A3B8]">
                  Nenhum cadastro encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {rows.map((row) => {
          const data = row.data
          const canEditRow = canEditCadastroRow(row)
          return (
            <div
              key={`${row.kind}-${data.id}`}
              className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-xs"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                {typeBadge(row)}
                <span className="text-[11px] text-[#64748B]">{rowLocation(row)}</span>
              </div>
              <p className="font-bold text-[#1E293B]">{rowLabel(row)}</p>
              <p className="text-xs text-[#64748B]">{rowCompany(row)}</p>
              <p className="mt-2 font-mono text-[11px] text-[#475569]">{rowDocument(row)}</p>
              <div className="mt-3 flex justify-end gap-2">
                <Link to={isClienteRow(row) ? `/clientes/${data.id}` : `/revendas/${data.id}`}>
                  <Button type="button" variant="outline" size="sm">
                    Ver detalhes
                  </Button>
                </Link>
                {canEditRow && (
                  <Button type="button" variant="outline" size="sm" onClick={() => openEdit(row)}>
                    Editar
                  </Button>
                )}
                {canEditRow && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openTransfer(row)}
                  >
                    Transferir
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar cadastro' : 'Novo cadastro'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4 text-xs">
            {!editing && (
              <div className="space-y-1">
                <Label>Tipo de cadastro *</Label>
                <Select
                  value={form.tipo}
                  onValueChange={(value) => {
                    const tipo = value as CadastroTipo
                    setField('tipo', tipo)
                    setField('documento', '')
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {canCreateClient && (
                      <SelectItem value="cliente_final">Cliente Final</SelectItem>
                    )}
                    {canCreateRevenda && <SelectItem value="revenda">Revenda</SelectItem>}
                  </SelectContent>{' '}
                </Select>
              </div>
            )}
            <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3">
              <Label>External ID</Label>
              <Input
                value={form.externalId}
                disabled
                placeholder="Preenchido futuramente pela integração"
                className="mt-1 bg-white"
              />
              <p className="mt-1 text-[11px] text-blue-700">
                Campo reservado para o outro sistema; não é preenchido manualmente.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Razão social *</Label>
                <Input
                  value={form.razaoSocial}
                  onChange={(event) => setField('razaoSocial', event.target.value)}
                />
                {errors.razaoSocial && <p className="text-red-600">{errors.razaoSocial}</p>}
              </div>
              <div className="space-y-1">
                <Label>Nome fantasia</Label>
                <Input
                  value={form.nomeFantasia}
                  onChange={(event) => setField('nomeFantasia', event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>
                  {form.tipo === 'revenda'
                    ? 'CNPJ'
                    : `Documento (${documentType(form.documento, form.tipo).toUpperCase()})`}
                </Label>
                <Input
                  value={form.documento}
                  onChange={(event) =>
                    setField('documento', maskDocument(event.target.value, form.tipo))
                  }
                  placeholder={form.tipo === 'revenda' ? '00.000.000/0000-00' : 'CPF ou CNPJ'}
                />
                {errors.documento && <p className="text-red-600">{errors.documento}</p>}
              </div>
              <div className="space-y-1">
                <Label>Inscrição estadual</Label>
                <Input
                  value={form.inscricaoEstadual}
                  onChange={(event) => setField('inscricaoEstadual', event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Telefone</Label>
                <Input
                  value={form.telefone}
                  onChange={(event) => setField('telefone', maskPhone(event.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(event) => setField('email', event.target.value)}
                />
                {errors.email && <p className="text-red-600">{errors.email}</p>}
              </div>
            </div>
            <div className="rounded-lg border border-[#E2E8F0] p-3">
              <p className="mb-3 font-semibold">Endereço</p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="space-y-1">
                  <Label>País *</Label>
                  <Input
                    value={form.pais}
                    onChange={(event) => setField('pais', event.target.value)}
                  />
                  {errors.pais && <p className="text-red-600">{errors.pais}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Estado *</Label>
                  <Input
                    maxLength={2}
                    value={form.estado}
                    onChange={(event) => setField('estado', event.target.value.toUpperCase())}
                  />
                  {errors.estado && <p className="text-red-600">{errors.estado}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Cidade *</Label>
                  <Input
                    value={form.cidade}
                    onChange={(event) => setField('cidade', event.target.value)}
                  />
                  {errors.cidade && <p className="text-red-600">{errors.cidade}</p>}
                </div>
                <div className="space-y-1">
                  <Label>CEP</Label>
                  <Input
                    value={form.cep}
                    onChange={(event) => setField('cep', event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Bairro</Label>
                  <Input
                    value={form.bairro}
                    onChange={(event) => setField('bairro', event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Rua</Label>
                  <Input
                    value={form.rua}
                    onChange={(event) => setField('rua', event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Número</Label>
                  <Input
                    value={form.numero}
                    onChange={(event) => setField('numero', event.target.value)}
                  />
                </div>
              </div>
            </div>
            {form.tipo === 'revenda' && (
              <div className="space-y-1">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) => setField('status', value as FormState['status'])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="autorizada">Autorizada</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Contato / usuário responsável *</Label>
                <Select
                  value={form.responsavel}
                  onValueChange={(value) => setField('responsavel', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name || item.email} — {item.carteira || 'Sem carteira'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.responsavel && <p className="text-red-600">{errors.responsavel}</p>}
              </div>
            </div>
            <div className="space-y-1">
              <Label>Observações</Label>
              <Textarea
                rows={3}
                value={form.observacoes}
                onChange={(event) => setField('observacoes', event.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar cadastro'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Transferir cadastro</DialogTitle>
          </DialogHeader>
          {transferRow && (
            <form onSubmit={saveTransfer} className="space-y-4">
              <p className="text-xs text-[#64748B]">
                O cadastro será transferido para a carteira do usuário escolhido.
              </p>
              <Select value={transferTarget} onValueChange={setTransferTarget}>
                <SelectTrigger>
                  <SelectValue placeholder="Usuário de destino" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name || item.email} — {item.carteira || 'Sem carteira'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setTransferOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving || !transferTarget}>
                  Confirmar transferência
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteRow)} onOpenChange={(open) => !open && setDeleteRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover cadastro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá {deleteRow ? rowLabel(deleteRow) : 'o cadastro'}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-red-600 text-white">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
