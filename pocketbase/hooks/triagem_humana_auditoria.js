/// <reference path="../pb_data/types.d.ts" />

// triagem_humana_auditoria.js — Auditoria obrigatória server-side para triagem_humana.
// onRecordUpdateRequest: registra AUTOMATICAMENTE cada mudança de status/responsável.
//
// Comportamento:
//   1. Compara o registro ORIGINAL com o ATUALIZADO (status e responsavel).
//   2. Se houve mudança, registra em auditoria_acesso (autor, alvo, acao, antes, depois).
//   3. Se a auditoria FALHAR, BLOQUEIA a atualização (auditoria obrigatória — fail-closed).
//
// A auditoria NÃO é best-effort: uma falha no registro impede a alteração.
// Isso garante rastreabilidade integral das mudanças em triagem_humana.
//
// Não modifica hooks existentes (hook NOVO, collection triagem_humana).

onRecordUpdateRequest((e) => {
  // TODAS as atualizações são auditadas, incluindo superuser.
  // O superuser é usado pelo gateway E6.0 — suas ações DEVEM ser rastreadas.
  const original = e.record.original()
  const atual = e.record

  // Detectar mudanças de status
  const statusAntes = String(original.get('status') || '')
  const statusDepois = String(atual.get('status') || '')
  const statusMudou = statusAntes !== statusDepois

  // Detectar mudanças de responsável
  const respAntes = String(original.get('responsavel') || '')
  const respDepois = String(atual.get('responsavel') || '')
  const respMudou = respAntes !== respDepois

  // Se nada relevante mudou, prosseguir sem auditoria
  if (!statusMudou && !respMudou) return e.next()

  // Construir o registro de auditoria
  const autor = e.auth ? e.auth.id : ''
  const acao =
    statusMudou && respMudou
      ? 'triagem_humana:status_responsavel'
      : statusMudou
        ? 'triagem_humana:status'
        : 'triagem_humana:responsavel'

  const antes = JSON.stringify({
    status: statusAntes,
    responsavel: respAntes,
  })
  const depois = JSON.stringify({
    status: statusDepois,
    responsavel: respDepois,
  })

  // Registrar auditoria — OBRIGATÓRIA (fail-closed)
  try {
    const audit = new Record(e.app.findCollectionByNameOrId('auditoria_acesso'))
    audit.set('autor', autor)
    audit.set('alvo', atual.id)
    audit.set('acao', acao)
    audit.set('antes', antes)
    audit.set('depois', depois)
    e.app.save(audit)
  } catch (errAudit) {
    // Auditoria OBRIGATÓRIA: falha BLOQUEIA a atualização
    throw new BadRequestError(
      'Falha ao registrar auditoria. Alteração bloqueada para garantir rastreabilidade.',
    )
  }

  return e.next()
}, 'triagem_humana')
