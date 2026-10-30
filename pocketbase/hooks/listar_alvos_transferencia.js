// listar_alvos_transferencia — alvos de transferência de lead PRÓPRIO (decisão owner 30/10
// 09:43: vendedores podem ver nomes de vendedores/revendedores/triagem ATIVOS, exclusivamente
// para transferência). A listRule de users (0009, admin/gestor) permanece intocada — esta rota
// devolve APENAS id/name/role dos perfis autorizados ativos, sem e-mail, carteira, permissões
// ou qualquer campo sensível. A TRANSFERÊNCIA em si continua validada pelo hook
// transferencia_historico_atomico + updateRule da 0031.
//
// Modo resolução de nomes (30/10, histórico de atividades — correção de segurança):
// ?ids=a,b,c&lead=<leadId> devolve { nomes: { id: nome } } SOMENTE para IDs que são
// participantes de transferência (usuario_destino/responsavel) DO lead informado, e somente
// se o chamador pode consultar esse lead (matriz idêntica à listRule de vendas/0031).
// Perfis resolvidos: vendedor/revendedor/triagem (ativos OU inativos — nome não é sensível).
// IDs fora das transferências do lead NÃO são resolvidos (sem enumeração arbitrária).
// Sem ?ids=: comportamento original (lista de ativos para o dropdown de transferência).
routerAdd(
  'GET',
  '/backend/v1/vendedores/alvos-transferencia',
  (e) => {
    const auth = e.auth
    if (!auth) {
      return e.json(401, { code: 'nao_autenticado', message: 'Autenticação obrigatória.' })
    }
    const PERFIS_AUTORIZADOS = ['vendedor', 'revendedor', 'triagem']
    const ID_RE = /^[a-z0-9]{15}$/
    try {
      const q = e.requestInfo().query || {}
      const idsParam = q.ids ? String(q.ids) : ''
      if (idsParam) {
        const leadId = q.lead ? String(q.lead) : ''
        if (!ID_RE.test(leadId)) {
          return e.json(400, { code: 'lead_invalido', message: 'Lead inválido.' })
        }
        // Acesso ao lead — matriz da listRule de vendas (0031):
        let lead = null
        try {
          lead = e.app.findRecordById('vendas', leadId)
        } catch (errLead) {
          lead = null
        }
        if (!lead) {
          return e.json(404, { code: 'lead_inexistente', message: 'Lead não encontrado.' })
        }
        const role = auth.get('role') || ''
        const consultaGeral =
          ['admin', 'gestor', 'triagem', 'suporte'].indexOf(role) !== -1 ||
          auth.get('perm_leads') === true
        if (!consultaGeral && ['vendedor', 'revendedor'].indexOf(role) === -1) {
          return e.json(403, { code: 'sem_perfil', message: 'Perfil sem acesso a leads.' })
        }
        const ETAPAS_RESTRITAS = ['pecas_pos_vendas', 'financeiro_fiscal', 'fornecedores']
        const etapaLiberada =
          ['admin', 'triagem', 'suporte'].indexOf(role) !== -1 ||
          ETAPAS_RESTRITAS.indexOf(lead.get('etapa') || '') === -1
        const donoVendedor =
          ['admin', 'gestor', 'suporte', 'triagem'].indexOf(role) !== -1 ||
          lead.get('vendedor') === auth.id
        if (!etapaLiberada || !donoVendedor) {
          return e.json(403, { code: 'sem_acesso_lead', message: 'Sem acesso a este lead.' })
        }
        // Participantes de transferência DESTE lead (fonte: lead_historico server-side):
        const eventos = e.app.findRecordsByFilter(
          'lead_historico',
          "lead_id = {:lead} && tipo_evento = 'transferencia'",
          '',
          200,
          0,
          { lead: leadId },
        )
        const participantes = {}
        for (let i = 0; i < eventos.length; i++) {
          const d = eventos[i].get('usuario_destino') || eventos[i].get('responsavel') || ''
          if (d) participantes[d] = true
        }
        const ids = idsParam
          .split(',')
          .map(function (x) {
            return x.trim()
          })
          .filter(function (x) {
            return ID_RE.test(x)
          })
          .slice(0, 50)
        const nomes = {}
        for (let i = 0; i < ids.length; i++) {
          if (!participantes[ids[i]]) continue
          try {
            const u = e.app.findRecordById('users', ids[i])
            if (PERFIS_AUTORIZADOS.indexOf(u.get('role') || '') === -1) continue
            nomes[ids[i]] = u.get('name') || ''
          } catch (errId) {
            // ID inexistente: não entra no mapa (frontend mostra fallback).
          }
        }
        return e.json(200, { nomes: nomes })
      }
      let alvos = []
      const registros = e.app.findRecordsByFilter('users', 'ativo = true', 'name', 200, 0)
      for (let i = 0; i < registros.length; i++) {
        const role = registros[i].get('role') || ''
        if (PERFIS_AUTORIZADOS.indexOf(role) === -1) continue
        alvos.push({
          id: registros[i].id,
          name: registros[i].get('name') || '',
          role: role,
        })
      }
      return e.json(200, { alvos: alvos })
    } catch (err) {
      return e.json(500, { code: 'erro_listagem', message: String(err).slice(0, 120) })
    }
  },
  $apis.requireAuth(),
)
