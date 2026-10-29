// senha_provisoria_guard.js — Guard server-side da flag senha_provisoria (Especificação Mestre C.4).
// Regra: self-update de senha_provisoria só é permitido quando a MESMA requisição também
// altera a senha (password + passwordConfirm presentes e idênticos). Caso contrário → 403.
// Superuser/admin bypass (anti-lockout, padrão T2.1). Tentativas bloqueadas são auditadas.
// NOTA JSVM: toda a lógica dentro do callback (runbook Goja).
onRecordUpdateRequest((e) => {
  try {
    if (e.hasSuperuserAuth()) return e.next()

    const info = e.requestInfo()
    const body = info && info.body ? info.body : {}
    const auth = e.auth
    if (!auth) return e.next()

    const isSelf = auth.id === e.record.id
    const alteraFlag = Object.prototype.hasOwnProperty.call(body, 'senha_provisoria')
    if (!isSelf || !alteraFlag) return e.next()

    const temSenhaNova =
      typeof body.password === 'string' &&
      body.password.length > 0 &&
      typeof body.passwordConfirm === 'string' &&
      body.passwordConfirm === body.password

    if (!temSenhaNova) {
      // auditoria da tentativa bloqueada (best-effort)
      try {
        const audit = new Record(e.app.findCollectionByNameOrId('auditoria_acesso'))
        audit.set('autor', auth.id)
        audit.set('alvo', e.record.id)
        audit.set('acao', 'senha_provisoria_bloqueada')
        audit.set('antes', JSON.stringify({ senha_provisoria: e.record.get('senha_provisoria') }))
        audit.set(
          'depois',
          JSON.stringify({ tentativa: body.senha_provisoria, comSenhaNova: false }),
        )
        e.app.save(audit)
      } catch (errAudit) {
        /* auditoria best-effort */
      }
      return e.json(403, {
        code: 'senha_provisoria_bloqueada',
        message: 'Troca de senha obrigatória antes de alterar esta flag.',
      })
    }

    // senha nova presente: força a flag a false (limpeza atômica com a troca)
    e.record.set('senha_provisoria', false)
    return e.next()
  } catch (err) {
    return e.json(500, { code: 'guard_erro', message: String(err) })
  }
}, 'users')
