// listar_alvos_transferencia — alvos de transferência de lead PRÓPRIO (decisão owner 30/10
// 09:43: vendedores podem ver nomes de vendedores/revendedores/triagem ATIVOS, exclusivamente
// para transferência). A listRule de users (0009, admin/gestor) permanece intocada — esta rota
// devolve APENAS id/name/role dos perfis autorizados ativos, sem e-mail, carteira, permissões
// ou qualquer campo sensível. A TRANSFERÊNCIA em si continua validada pelo hook
// transferencia_historico_atomico + updateRule da 0031.
routerAdd(
  'GET',
  '/backend/v1/vendedores/alvos-transferencia',
  (e) => {
    const auth = e.auth
    if (!auth) {
      return e.json(401, { code: 'nao_autenticado', message: 'Autenticação obrigatória.' })
    }
    let alvos = []
    try {
      const registros = e.app.findRecordsByFilter('users', 'ativo = true', 'name', 200, 0)
      const PERFIS_AUTORIZADOS = ['vendedor', 'revendedor', 'triagem']
      for (let i = 0; i < registros.length; i++) {
        const role = registros[i].get('role') || ''
        if (PERFIS_AUTORIZADOS.indexOf(role) === -1) continue
        alvos.push({
          id: registros[i].id,
          name: registros[i].get('name') || '',
          role: role,
        })
      }
    } catch (err) {
      return e.json(500, { code: 'erro_listagem', message: String(err).slice(0, 120) })
    }
    return e.json(200, { alvos: alvos })
  },
  $apis.requireAuth(),
)
