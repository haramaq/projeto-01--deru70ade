// fila_triagem — fila de leads SEM responsável p/ a triagem (decisão owner 30/10 14:41):
// leads sem vendedor ficam acessíveis por esta rota server-side (autorização específica,
// sem abrir regra geral de vendas). Devolve id/número/etapa/cliente (nome via leitura
// server-side) dos leads com vendedor vazio. A ATRIBUIÇÃO é feita pela rota
// /backend/v1/triagem/atribuir (fila_triagem_atribuir) — esta rota é SÓ de consulta.
// Nota de implantação (30/10): a migration 0035 (isolamento da triagem) foi ADIADA pelo
// preflight — na produção 0.0.76 a fila ainda não existe no frontend publicado; aplicar a
// 0035 agora deixaria a triagem sem visibilidade dos leads não atribuídos. A 0035 entra
// junto com o publish do novo frontend. Até lá esta rota é redundante porém inofensiva.
routerAdd(
  'GET',
  '/backend/v1/triagem/fila',
  (e) => {
    const auth = e.auth
    if (!auth) {
      return e.json(401, { code: 'nao_autenticado', message: 'Autenticação obrigatória.' })
    }
    const role = auth.get('role') || ''
    // Autorização específica: triagem (papel principal da fila) + admin/gestor (supervisão).
    if (['triagem', 'admin', 'gestor'].indexOf(role) === -1) {
      return e.json(403, { code: 'sem_perfil', message: 'Rota exclusiva da triagem.' })
    }
    try {
      const registros = e.app.findRecordsByFilter('vendas', 'vendedor = ""', '-created', 200, 0)
      const itens = []
      for (let i = 0; i < registros.length; i++) {
        const r = registros[i]
        let clienteNome = ''
        try {
          const c = e.app.findRecordById('clientes', r.get('cliente') || '')
          clienteNome = c.get('nome') || ''
        } catch (errC) {
          clienteNome = ''
        }
        itens.push({
          id: r.id,
          numero_lead: r.get('numero_lead') || '',
          etapa: r.get('etapa') || '',
          origem_lead: r.get('origem_lead') || '',
          cliente_nome: clienteNome,
          created: r.get('created') || '',
        })
      }
      return e.json(200, { itens: itens, total: itens.length })
    } catch (err) {
      return e.json(500, { code: 'erro_fila', message: String(err).slice(0, 120) })
    }
  },
  $apis.requireAuth(),
)
