// trocar_senha_propria — rota server-side restrita (Anel 2, Especificação Mestre C.4).
// POST /backend/v1/usuarios/trocar-senha-propria
// Body: { oldPassword, newPassword, passwordConfirm }
// Regras: exige auth; só o PRÓPRIO registro (e.auth.id); exige oldPassword correto;
// NUNCA toca role/ativo/permissoes/carteira/external_id_altforce (lista negra explícita);
// limpa senha_provisoria na mesma transação; audita sucesso e falhas.
routerAdd(
  'POST',
  '/backend/v1/usuarios/trocar-senha-propria',
  (e) => {
    const info = e.requestInfo()
    const body = info && info.body ? info.body : {}
    const auth = e.auth
    if (!auth) return e.json(401, { code: 'nao_autenticado', message: 'Autenticação obrigatória.' })

    const oldPassword = typeof body.oldPassword === 'string' ? body.oldPassword : ''
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : ''
    const passwordConfirm = typeof body.passwordConfirm === 'string' ? body.passwordConfirm : ''

    if (!oldPassword || !newPassword) {
      return e.json(400, {
        code: 'campos_obrigatorios',
        message: 'oldPassword e newPassword são obrigatórios.',
      })
    }
    if (newPassword !== passwordConfirm) {
      return e.json(400, {
        code: 'confirmacao_divergente',
        message: 'newPassword e passwordConfirm divergem.',
      })
    }
    if (newPassword.length < 8) {
      return e.json(400, {
        code: 'senha_fraca',
        message: 'A nova senha deve ter ao menos 8 caracteres.',
      })
    }

    // Busca o registro pelo auth atual (fonte de verdade do servidor)
    let record
    try {
      record = e.app.findRecordById('users', auth.id)
    } catch (err) {
      return e.json(404, { code: 'usuario_nao_encontrado', message: 'Registro não encontrado.' })
    }

    // Valida a senha antiga contra o hash armazenado
    let senhaAntigaOk = false
    try {
      senhaAntigaOk = record.validatePassword(oldPassword)
    } catch (err) {
      senhaAntigaOk = false
    }
    if (!senhaAntigaOk) {
      try {
        const audit = new Record(e.app.findCollectionByNameOrId('auditoria_acesso'))
        audit.set('autor', auth.id)
        audit.set('alvo', auth.id)
        audit.set('acao', 'troca_senha_propria_falha')
        audit.set('antes', JSON.stringify({ motivo: 'oldPassword_invalida' }))
        audit.set('depois', JSON.stringify({}))
        e.app.save(audit)
      } catch (errAudit) {}
      return e.json(403, { code: 'senha_atual_invalida', message: 'A senha atual não confere.' })
    }

    // Lista negra: campos administrativos NUNCA alterados por esta rota
    const PROIBIDOS = [
      'role',
      'ativo',
      'permissoes',
      'carteira',
      'external_id_altforce',
      'perm_dashboard',
      'perm_leads',
      'perm_clientes',
      'perm_revendas',
      'perm_suporte',
      'perm_relatorios',
      'perm_configuracoes',
      'verified',
      'email',
      'emailVisibility',
    ]
    for (let i = 0; i < PROIBIDOS.length; i++) {
      if (Object.prototype.hasOwnProperty.call(body, PROIBIDOS[i])) {
        return e.json(403, {
          code: 'campo_proibido',
          message: 'Campo administrativo não alterável por esta rota: ' + PROIBIDOS[i],
        })
      }
    }

    // Troca restrita: apenas password (+ limpeza da flag na mesma transação)
    record.setPassword(newPassword)
    record.set('senha_provisoria', false)
    try {
      e.app.save(record)
    } catch (errSave) {
      return e.json(400, { code: 'validacao', message: String(errSave) })
    }

    try {
      const audit = new Record(e.app.findCollectionByNameOrId('auditoria_acesso'))
      audit.set('autor', auth.id)
      audit.set('alvo', auth.id)
      audit.set('acao', 'troca_senha_propria')
      audit.set('antes', JSON.stringify({ senha_provisoria: true }))
      audit.set('depois', JSON.stringify({ senha_provisoria: false }))
      e.app.save(audit)
    } catch (errAudit) {}

    return e.json(200, { ok: true })
  },
  $apis.requireAuth(),
)
