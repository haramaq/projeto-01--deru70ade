// fila_triagem_atribuir — atribuição SEGURA de lead da fila pelo servidor (decisão owner
// 30/10 14:54): POST /backend/v1/triagem/atribuir { lead, vendedor }.
// Autorização: triagem/admin/gestor (vendedor e suporte → 403).
// Regras: (1) o lead deve estar SEM vendedor (fila) — exceto admin/gestor, que podem
// reatribuir; (2) o alvo deve ser vendedor/revendedor/triagem ATIVO; (3) a triagem só pode
// atribuir a SI MESMA ou a um vendedor/revendedor ativo (nunca a outro triagem);
// (4) EXCLUSIVIDADE POR TRANSAÇÃO EFETIVA: auditoria + lead + cliente dentro de
// $app.runInTransaction — o WRITE lock do SQLite serializa escritores simultâneos e a
// revalidação DENTRO da tx lê o lead já atribuído → 409 (sem TOCTOU);
// (5) IDEMPOTÊNCIA: reenvio idêntico (lead já com o destino) → 200 sem regravar;
// (6) AUDITORIA: lead_historico tipo_evento='transferencia' gravado DENTRO da tx —
// falha de auditoria faz rollback da tx inteira (lead NÃO atribuído).
routerAdd(
  'POST',
  '/backend/v1/triagem/atribuir',
  (e) => {
    const auth = e.auth
    if (!auth) {
      return e.json(401, { code: 'nao_autenticado', message: 'Autenticação obrigatória.' })
    }
    const role = auth.get('role') || ''
    if (['triagem', 'admin', 'gestor'].indexOf(role) === -1) {
      return e.json(403, { code: 'sem_perfil', message: 'Rota exclusiva da triagem.' })
    }
    const body = e.requestInfo().body || {}
    const leadId = String(body.lead || '')
    const alvoId = String(body.vendedor || '')
    const ID_RE = /^[a-z0-9]{15}$/
    if (!ID_RE.test(leadId) || !ID_RE.test(alvoId)) {
      return e.json(400, { code: 'parametros_invalidos', message: 'Lead ou vendedor inválido.' })
    }
    try {
      // Alvo: ativo e perfil autorizado.
      let alvo = null
      try {
        alvo = e.app.findRecordById('users', alvoId)
      } catch (errAlvo) {
        alvo = null
      }
      if (!alvo)
        return e.json(404, { code: 'alvo_inexistente', message: 'Usuário de destino não existe.' })
      const ativoAlvo = alvo.get('ativo')
      if (ativoAlvo === false || ativoAlvo === 0 || String(ativoAlvo) === 'false') {
        return e.json(400, { code: 'alvo_inativo', message: 'Usuário de destino está inativo.' })
      }
      const roleAlvo = alvo.get('role') || ''
      if (['vendedor', 'revendedor', 'triagem'].indexOf(roleAlvo) === -1) {
        return e.json(400, {
          code: 'alvo_nao_autorizado',
          message: 'Perfil de destino não autorizado.',
        })
      }
      // Triagem só atribui a SI MESMA ou a vendedor/revendedor (nunca a outra triagem).
      if (role === 'triagem' && roleAlvo === 'triagem' && alvoId !== auth.id) {
        return e.json(403, {
          code: 'triagem_para_triagem',
          message: 'A triagem só pode assumir o lead para si.',
        })
      }

      // Lead: leitura FRESCA — deve estar sem vendedor (exceto admin/gestor).
      let lead = null
      try {
        lead = e.app.findRecordById('vendas', leadId)
      } catch (errLead) {
        lead = null
      }
      if (!lead) return e.json(404, { code: 'lead_inexistente', message: 'Lead não encontrado.' })
      const vendedorAtual = lead.get('vendedor') || ''
      // Idempotência PRIMEIRO: reenvio idêntico (lead já com o destino) → 200 sem regravar.
      if (vendedorAtual && vendedorAtual === alvoId) {
        return e.json(200, {
          code: 'idempotente',
          message: 'Lead já está com o destino informado.',
          lead: leadId,
          vendedor: alvoId,
        })
      }
      if (vendedorAtual && role !== 'admin' && role !== 'gestor') {
        return e.json(409, {
          code: 'lead_ja_assumido',
          message: 'Lead já atribuído por outro usuário.',
        })
      }

      // EXCLUSIVIDADE POR TRANSAÇÃO EFETIVA: auditoria + lead + cliente dentro de UMA
      // transação (runInTransaction). O SQLite serializa o WRITE lock: a 2ª requisição
      // simultânea só entra DEPOIS que a 1ª commitou — e a revalidação DENTRO da tx lê o
      // lead JÁ atribuído → 409. Diferente do hook de request (V3), aqui NÃO há e.next():
      // toda a escrita é nossa, portanto a transação é efetiva e atômica de verdade.
      let resultado = null
      $app.runInTransaction((txApp) => {
        const leadTx = txApp.findRecordById('vendas', leadId)
        const vendedorTx = leadTx.get('vendedor') || ''
        // Idempotência dentro da tx (reenvio idêntico):
        if (vendedorTx === alvoId) {
          resultado = e.json(200, {
            code: 'idempotente',
            message: 'Lead já está com o destino informado.',
            lead: leadId,
            vendedor: alvoId,
          })
          return
        }
        // Concorrência: se outro usuário assumiu entre a 1ª leitura e a tx → 409.
        if (vendedorTx && role !== 'admin' && role !== 'gestor') {
          resultado = e.json(409, {
            code: 'lead_ja_assumido',
            message: 'Lead já atribuído por outro usuário.',
          })
          return
        }
        const histTx = new Record(txApp.findCollectionByNameOrId('lead_historico'))
        histTx.set('lead_id', leadId)
        const etapaTx = leadTx.get('etapa') || ''
        histTx.set('etapa_anterior', etapaTx)
        histTx.set('etapa_nova', etapaTx)
        histTx.set('responsavel', alvoId)
        histTx.set('data_hora', new Date().toISOString())
        histTx.set('tipo_evento', 'transferencia')
        histTx.set('usuario_origem', auth.id)
        histTx.set('usuario_destino', alvoId)
        histTx.set(
          'observacao',
          'Atribuição via Fila de Triagem registrada automaticamente pelo servidor.',
        )
        txApp.save(histTx)

        leadTx.set('vendedor', alvoId)
        leadTx.set('carteira', alvo.get('carteira') || '')
        txApp.save(leadTx)

        const clienteId = leadTx.get('cliente') || ''
        if (clienteId) {
          try {
            const clienteTx = txApp.findRecordById('clientes', clienteId)
            clienteTx.set('responsavel', alvoId)
            clienteTx.set('responsavel_usuario', alvoId)
            clienteTx.set('carteira', alvo.get('carteira') || '')
            txApp.save(clienteTx)
          } catch (errClienteTx) {
            // Falha do cliente NÃO desfaz a atribuição do lead (auditoria na mesma tx já
            // garante o registro); divergência fica detectável pela reconciliação.
          }
        }
        resultado = e.json(200, { code: 'atribuido', lead: leadId, vendedor: alvoId })
      })
      if (resultado) return resultado
      return e.json(500, { code: 'erro_atribuicao', message: 'Transação não produziu resultado.' })
    } catch (err) {
      return e.json(500, { code: 'erro_atribuicao', message: String(err).slice(0, 120) })
    }
  },
  $apis.requireAuth(),
)
