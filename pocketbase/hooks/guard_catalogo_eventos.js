/// <reference path="../pb_data/types.d.ts" />
// T2.1 / D-3 (emenda 04/11: 9º tipo técnico 'operacao.executada' + emenda T2.2: 2 tipos de qualificação) — catálogo FECHADO (extensível por task oficial,
// nunca por evento livre). Espelha o padrão do validar_lead_historico.
// Em CREATE de eventos_negocio: tipo fora do catálogo → 400 tipo_invalido.
// Superuser bypass (padrão da plataforma).
onRecordCreateRequest((e) => {
  try {
    if (e.hasSuperuserAuth()) return e.next()
    const body = (e.requestInfo() && e.requestInfo().body) || {}
    const tipo = body.tipo || e.record.get('tipo') || ''
    if (!tipo) return e.next()
    const validos = [
      // distribuição (DEC-06 / SPEC-2-002)
      'distribuicao_sugestao',
      'distribuicao_validacao',
      'distribuicao_atribuicao',
      // versionamento de regras (T2.1 / DEC-06)
      'regra_publicada',
      'regra_promovida',
      'regra_rebaixada',
      // integração Altforce (SPEC-2-006 / CA-2-17..20)
      'integracao_altforce_evento',
      // fila de exceções (SPEC-2-003)
      'fila_excecao',
      // T2.1 — evento técnico da operação idempotente (emenda D-3, 04/11)
      'operacao.executada',
      // T2.2 — eventos de qualificação (emenda D-3, 04/11)
      'qualificacao_resposta_corrigida',
      'qualificacao_classificada',
    ]
    if (validos.indexOf(tipo) === -1) {
      return e.json(400, {
        code: 'tipo_invalido',
        message: 'tipo de evento não reconhecido no catálogo.',
      })
    }
    return e.next()
  } catch (err) {
    return e.json(500, { code: 'validacao_catalogo', message: String(err).slice(0, 120) })
  }
}, 'eventos_negocio')
