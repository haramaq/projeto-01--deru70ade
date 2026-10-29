// validar_lead_historico — V2 (anti-falsificação de auditoria).
// Em CREATE de lead_historico: para não-admin, força usuario_origem = auth.id (não pode
// declarar origem de terceiros) e valida usuario_destino (existe e ativo). Superuser bypass.
// Em UPDATE/DELETE: bloqueados pela regra da coleção (updateRule/deleteRule = null) — o hook
// cobre também por defesa em profundidade.
onRecordCreateRequest((e) => {
  try {
    if (e.hasSuperuserAuth()) return e.next()

    const info = e.requestInfo()
    const body = info && info.body ? info.body : {}
    const auth = e.auth
    if (!auth) return e.next()

    const atorRole = auth.get('role') || ''
    const atorAdmin = atorRole === 'admin' || atorRole === 'gestor'

    // Origem: não-admin NUNCA declara usuario_origem de terceiros
    if (!atorAdmin) {
      e.record.set('usuario_origem', auth.id)
    }

    // Destino: se presente, deve existir e estar ativo
    const destino = body.usuario_destino
    if (destino) {
      let alvo
      try {
        alvo = e.app.findRecordById('users', destino)
      } catch (err) {
        return e.json(400, {
          code: 'destino_inexistente',
          message: 'Usuário de destino não existe.',
        })
      }
      if (alvo.get('ativo') === false) {
        return e.json(400, { code: 'destino_inativo', message: 'Usuário de destino está inativo.' })
      }
    }

    // Tipo de evento: se presente, limitado ao catálogo (inclui 'movimentacao_etapa',
    // usado pelo frontend em updateEtapa)
    const tipo = body.tipo_evento
    if (tipo) {
      const validos = [
        'transferencia',
        'criacao',
        'alteracao_etapa',
        'movimentacao_etapa',
        'observacao',
        'backfill_vendedor',
      ]
      if (validos.indexOf(tipo) === -1) {
        return e.json(400, { code: 'tipo_invalido', message: 'tipo_evento não reconhecido.' })
      }
    }

    return e.next()
  } catch (err) {
    return e.json(500, { code: 'validacao_historico', message: String(err) })
  }
}, 'lead_historico')

onRecordUpdateRequest((e) => {
  try {
    if (e.hasSuperuserAuth()) return e.next()
    const atorRole = (e.auth && e.auth.get('role')) || ''
    if (atorRole === 'admin' || atorRole === 'gestor') return e.next()
    return e.json(403, {
      code: 'historico_imutavel',
      message: 'O histórico de leads não pode ser alterado.',
    })
  } catch (err) {
    return e.json(500, { code: 'validacao_historico', message: String(err) })
  }
}, 'lead_historico')
