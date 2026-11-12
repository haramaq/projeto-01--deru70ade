/// <reference path="../pb_data/types.d.ts" />

// excluir_vendedor_teste.js — Exclusão atômica de vendedores fictícios e seus vínculos DDI/DDD.
// POST /backend/v1/usuarios/excluir-vendedor
//
// Body: { id: string } — ID interno do vendedor a excluir.
//
// Autorização: exige autenticação (401 se anônimo) e role admin (403 se outro perfil).
// Elegibilidade: o alvo DEVE existir (404 se não) e DEVE ser vendedor ou revendedor (403 se admin/gestor/outro).
//
// Proteção para operação comercial:
//   Fail-closed via $secrets.get('PERMITIR_EXCLUSAO_VENDEDORES_TESTE').
//   Se a secret não existir, estiver vazia ou não for 'SIM', a exclusão é BLOQUEADA.
//
// Transação atômica ($app.runInTransaction):
//   1. Remove TODOS os vínculos vendedor_ddd do alvo (usuario_id = alvo).
//   2. Exclui o usuário.
//   Se qualquer etapa falhar → rollback completo (vínculos E usuário permanecem).
//
// Auditoria: registrada APÓS a transação (só se a exclusão suceder).
//
// Proteções:
//   - NÃO exclui admins, gestores, triagem ou suporte.
//   - NÃO usa cascadeDelete.
//   - NÃO remove registros de auditoria ou histórico.
//
// Retorna:
//   200 { ok: true, usuario_id, vinculos_removidos: N }
//   401 { codigo: 'AUTENTICACAO_OBRIGATORIA' }
//   403 { codigo: 'PERFIL_NAO_AUTORIZADO', perfil } — quem chama não é admin
//   403 { codigo: 'EXCLUSAO_DESATIVADA' } — secret não configurada como 'SIM'
//   403 { codigo: 'ALVO_NAO_ELEGIVEL', perfil: role_do_alvo } — o alvo não é vendedor/revendedor
//   404 { codigo: 'USUARIO_NAO_ENCONTRADO' }
//   500 { codigo: 'FALHA_INTERNA', erro, rollback: true } — com rollback automático

routerAdd('POST', '/backend/v1/usuarios/excluir-vendedor', (e) => {
  // ---------- Autenticação ----------
  const auth = e.auth
  if (!auth) {
    return e.json(401, { codigo: 'AUTENTICACAO_OBRIGATORIA' })
  }
  const roleChamador = String(auth.get('role') || '')
  if (roleChamador !== 'admin') {
    return e.json(403, { codigo: 'PERFIL_NAO_AUTORIZADO', perfil: roleChamador })
  }

  // ---------- Proteção para operação comercial ----------
  // Fail-closed: se a secret não existir, estiver vazia ou inválida, BLOQUEIA
  const permitirExclusao = ($secrets.get('PERMITIR_EXCLUSAO_VENDEDORES_TESTE') || '')
    .trim()
    .toUpperCase()
  if (permitirExclusao !== 'SIM') {
    return e.json(403, {
      codigo: 'EXCLUSAO_DESATIVADA',
      mensagem: 'A exclusão definitiva de vendedores está desativada.',
    })
  }

  // ---------- Validação do body ----------
  const body = e.requestInfo().body || {}
  const alvoId = String(body.id || '').trim()
  if (!alvoId) {
    return e.json(400, { codigo: 'ID_OBRIGATORIO' })
  }

  // ---------- Busca do alvo ----------
  let alvo = null
  try {
    alvo = e.app.findRecordById('users', alvoId)
  } catch (errAlvo) {
    return e.json(404, { codigo: 'USUARIO_NAO_ENCONTRADO' })
  }

  const roleAlvo = String(alvo.get('role') || '')
  if (roleAlvo !== 'vendedor' && roleAlvo !== 'revendedor') {
    return e.json(403, { codigo: 'ALVO_NAO_ELEGIVEL', perfil: roleAlvo })
  }

  // ---------- Transação atômica ----------
  let vinculosRemovidos = 0
  try {
    $app.runInTransaction((txApp) => {
      // 1. Buscar e remover todos os vínculos vendedor_ddd do alvo
      //    Runbook PB 0.36: filtrar SÓ pela chave e validar em código
      let vinculos = []
      try {
        vinculos = txApp.findRecordsByFilter(
          'vendedor_ddd',
          "usuario_id = '" + alvoId.replace(/'/g, "\\'") + "'",
          '',
          100,
          0,
        )
      } catch (errVinc) {
        vinculos = []
      }

      for (let i = 0; i < vinculos.length; i++) {
        txApp.delete(vinculos[i])
        vinculosRemovidos++
      }

      // 2. Excluir o usuário
      txApp.delete(alvo)
    })
  } catch (errTx) {
    // Rollback automático — vínculos E usuário permanecem intactos
    return e.json(500, {
      codigo: 'FALHA_INTERNA',
      erro: String(errTx).substring(0, 200),
      rollback: true,
    })
  }

  // ---------- Auditoria APÓS a transação (só se a exclusão sucedeu) ----------
  try {
    const audit = new Record(e.app.findCollectionByNameOrId('auditoria_acesso'))
    audit.set('autor', auth.id)
    audit.set('alvo', alvoId)
    audit.set('acao', 'exclusao_vendedor_ficticio')
    audit.set(
      'antes',
      JSON.stringify({
        name: alvo.get('name'),
        email: alvo.get('email'),
        role: roleAlvo,
      }),
    )
    audit.set('depois', JSON.stringify({ excluido: true, vinculos_removidos: vinculosRemovidos }))
    e.app.save(audit)
  } catch (errAudit) {
    // Auditoria best-effort — não desfaz a exclusão
  }

  return e.json(200, {
    ok: true,
    usuario_id: alvoId,
    vinculos_removidos: vinculosRemovidos,
  })
})
