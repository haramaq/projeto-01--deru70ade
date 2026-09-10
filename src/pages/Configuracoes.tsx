import React, { useState, useEffect } from 'react'
import {
  Users,
  Shield,
  UserPlus,
  KeyRound,
  Edit2,
  Trash2,
  CheckCircle,
  AlertCircle,
  Lock,
} from 'lucide-react'
import { userService } from '@/services/crmService'
import type { User, UserRole } from '@/types/crm'
import { formatDateBR } from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { cn } from '@/lib/utils'

export default function Configuracoes() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  // Create User Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)

  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formRole, setFormRole] = useState<UserRole>('vendedor')
  const [submitting, setSubmitting] = useState(false)

  const loadUsers = async () => {
    try {
      const list = await userService.getAll()
      setUsers(list)
    } catch {
      toast.error('Erro ao listar usuários.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const handleOpenCreate = () => {
    setEditingUser(null)
    setFormName('')
    setFormEmail('')
    setFormPassword('')
    setFormRole('vendedor')
    setModalOpen(true)
  }

  const handleOpenEdit = (u: User) => {
    setEditingUser(u)
    setFormName(u.name || '')
    setFormEmail(u.email || '')
    setFormPassword('')
    setFormRole(u.role || 'vendedor')
    setModalOpen(true)
  }

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formEmail.trim()) {
      toast.error('E-mail é obrigatório.')
      return
    }

    setSubmitting(true)
    try {
      if (editingUser) {
        const payload: Partial<User> = {
          name: formName.trim(),
          role: formRole,
          ativo: editingUser.ativo,
        }
        const updated = await userService.update(editingUser.id, payload)
        await userService.audit({
          autor: 'sessão atual',
          alvo: editingUser.id,
          acao: 'alterar_acesso',
          antes: { role: editingUser.role, ativo: editingUser.ativo },
          depois: { role: formRole, ativo: editingUser.ativo },
        })
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
        toast.success('Usuário atualizado e auditado.')
      } else {
        if (!formPassword || formPassword.length < 8) {
          toast.error('A senha deve ter no mínimo 8 caracteres.')
          setSubmitting(false)
          return
        }
        const created = await userService.create({
          name: formName.trim(),
          email: formEmail.trim(),
          password: formPassword,
          passwordConfirm: formPassword,
          role: formRole,
        })
        setUsers((prev) => [...prev, created])
        toast.success('Usuário criado com sucesso!')
      }
      setModalOpen(false)
    } catch {
      toast.error('Erro ao salvar usuário.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteUser = async (u: User) => {
    if (u.email === 'elisandrodesousaharamaq@gmail.com') {
      toast.error('O usuário administrador principal não pode ser removido.')
      return
    }
    if (!confirm(`Deseja desativar/remover o acesso de ${u.name || u.email}?`)) return
    try {
      const updated = await userService.deactivate(u.id)
      await userService.audit({
        autor: 'sessão atual',
        alvo: u.id,
        acao: 'desativar_usuario',
        antes: { ativo: u.ativo },
        depois: { ativo: false },
      })
      setUsers((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      toast.success('Usuário desativado e auditado.')
    } catch {
      toast.error('Erro ao remover usuário.')
    }
  }

  const roleDescriptions: { role: UserRole; title: string; desc: string; color: string }[] = [
    {
      role: 'admin',
      title: 'Administrador (Admin)',
      desc: 'Acesso irrestrito a todos os módulos, relatórios gerenciais, gestão de revendas e administração de usuários.',
      color: 'border-red-300 bg-red-50 text-red-800',
    },
    {
      role: 'triagem',
      title: 'Triagem',
      desc: 'Recebe e organiza leads, sem acesso a configurações ou dados fora das regras de carteira.',
      color: 'border-amber-300 bg-amber-50 text-amber-800',
    },
    {
      role: 'vendedor',
      title: 'Vendedor Comercial',
      desc: 'Acesso ao Dashboard, Funil de Vendas (Kanban), carteira de Clientes e catálogo de Revendas credenciadas.',
      color: 'border-emerald-300 bg-emerald-50 text-emerald-800',
    },
    {
      role: 'revendedor',
      title: 'Revendedor',
      desc: 'Acesso somente à carteira autorizada para atendimento comercial.',
      color: 'border-purple-300 bg-purple-50 text-purple-800',
    },
    {
      role: 'gestor',
      title: 'Gestor',
      desc: 'Acompanha carteiras e auditoria operacional, sem administração global de sistema.',
      color: 'border-cyan-300 bg-cyan-50 text-cyan-800',
    },
    {
      role: 'suporte',
      title: 'Suporte Técnico & Pós-Venda',
      desc: 'Acesso ao Dashboard, lista de Clientes e gerenciamento completo dos chamados e tickets de suporte.',
      color: 'border-blue-300 bg-blue-50 text-blue-800',
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-4 border-[#1B4332] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-gray-500">Carregando configurações...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1B4332] tracking-tight">
            Configurações e Níveis de Acesso
          </h1>
          <p className="text-xs text-gray-500">
            Gerenciamento de papéis de usuários (RBAC) e segurança da plataforma Haramaq
          </p>
        </div>

        <Button
          onClick={handleOpenCreate}
          className="bg-[#DC2626] hover:bg-[#b91c1c] text-white font-semibold rounded-xl gap-2 shadow-sm transition-transform hover:scale-[1.02] self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          Novo Usuário
        </Button>
      </div>

      {/* Role Definitions (Read-Only) */}
      <Card className="rounded-[16px] border border-[#E5E7EB] shadow-xs">
        <CardHeader className="pb-3 border-b border-gray-100">
          <CardTitle className="text-sm font-bold text-[#1B4332] flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#40916C]" />
            Matriz de Permissões e Níveis de Acesso
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          {roleDescriptions.map((item) => (
            <div
              key={item.role}
              className="p-4 rounded-xl border border-gray-100 bg-[#F8FAF9] space-y-2"
            >
              <Badge variant="outline" className={cn('text-xs font-bold uppercase', item.color)}>
                {item.title}
              </Badge>
              <p className="text-xs text-gray-600 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="rounded-[16px] border border-[#E5E7EB] shadow-xs overflow-hidden">
        <CardHeader className="pb-3 border-b border-gray-100 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold text-[#1B4332] flex items-center gap-2">
            <Users className="w-4 h-4 text-[#1B4332]" />
            Usuários Cadastrados ({users.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAF9] border-b border-[#E5E7EB] text-gray-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Nome</th>
                  <th className="py-3 px-4">E-mail</th>
                  <th className="py-3 px-4">Papel / Nível</th>
                  <th className="py-3 px-4">Data Cadastro</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {users.map((u) => {
                  const roleBadgeStyle: Record<string, string> = {
                    admin: 'bg-red-50 text-red-700 border-red-200',
                    vendedor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    suporte: 'bg-blue-50 text-blue-700 border-blue-200',
                  }

                  return (
                    <tr
                      key={u.id}
                      className={cn(
                        'hover:bg-gray-50/70 transition-colors',
                        u.ativo === false && 'opacity-60',
                      )}
                    >
                      <td className="py-3.5 px-4 font-bold text-gray-900">
                        {u.name || 'Sem nome'}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-gray-600">{u.email}</td>
                      <td className="py-3.5 px-4">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[11px] font-semibold uppercase',
                            roleBadgeStyle[u.role || 'vendedor'],
                          )}
                        >
                          {u.role || 'vendedor'}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-gray-500">{formatDateBR(u.created)}</td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(u)}
                            className="h-8 w-8 p-0 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                            title="Editar Papel"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>

                          {u.email !== 'elisandrodesousaharamaq@gmail.com' && u.ativo !== false && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteUser(u)}
                              className="h-8 w-8 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                              title="Desativar Usuário"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal: New / Edit User */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1B4332]">
              {editingUser ? 'Editar Usuário e Papel' : 'Novo Usuário do Sistema'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveUser} className="space-y-4 pt-2 text-xs">
            <div className="space-y-1">
              <Label htmlFor="uName" className="font-semibold text-gray-700">
                Nome Completo
              </Label>
              <Input
                id="uName"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ex: Roberto Vendas"
                required
                className="h-10 text-xs rounded-xl"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="uEmail" className="font-semibold text-gray-700">
                E-mail Corporativo
              </Label>
              <Input
                id="uEmail"
                type="email"
                disabled={!!editingUser}
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="nome@haramaq.com.br"
                required
                className="h-10 text-xs rounded-xl"
              />
            </div>

            {!editingUser && (
              <div className="space-y-1">
                <Label htmlFor="uPass" className="font-semibold text-gray-700">
                  Senha Provisória (mínimo 8 caracteres)
                </Label>
                <Input
                  id="uPass"
                  type="password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="h-10 text-xs rounded-xl"
                />
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="uRole" className="font-semibold text-gray-700">
                Nível de Acesso (Papel)
              </Label>
              <Select value={formRole} onValueChange={(val) => setFormRole(val as UserRole)}>
                <SelectTrigger id="uRole" className="h-10 text-xs rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador (Acesso Geral)</SelectItem>
                  <SelectItem value="gestor">Gestor (Carteiras e auditoria)</SelectItem>
                  <SelectItem value="triagem">Triagem (Leads)</SelectItem>
                  <SelectItem value="vendedor">Vendedor (Carteira comercial)</SelectItem>
                  <SelectItem value="revendedor">Revendedor (Carteira autorizada)</SelectItem>
                  <SelectItem value="suporte">Suporte (Chamados, Clientes)</SelectItem>
                </SelectContent>
              </Select>
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
                {submitting ? 'Salvando...' : 'Salvar Usuário'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
