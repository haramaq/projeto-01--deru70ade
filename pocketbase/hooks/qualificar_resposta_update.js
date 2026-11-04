/// <reference path="../pb_data/types.d.ts" />
// T2.2-T4-B — Hook qualificar_resposta_update: campos imutáveis + auditoria atômica.
// Disparo: onRecordUpdateRequest de qualificacao_respostas.
//
// Validações:
// 1. Campos imutáveis (lead_id, pergunta_id, roteiro_versao_id, sessao_id) não alterados
// 2. Auditoria ATÔMICA (fail-closed): se o evento falhar, a correção também falha
//
// Superuser bypass (padrão da plataforma).

onRecordUpdateRequest((e) => {
  try {
    if (e.hasSuperuserAuth()) return e.next()
    const colecaoUp = e.record.collection().name
    if (colecaoUp !== 'qualificacao_respostas') return e.next()

    const rec = e.record
    const orig = rec.original()

    // 1) Campos imutáveis: lead_id, pergunta_id, roteiro_versao_id, sessao_id
    const imutaveis = ['lead_id', 'pergunta_id', 'roteiro_versao_id', 'sessao_id']
    for (let i = 0; i < imutaveis.length; i++) {
      const f = imutaveis[i]
      const antes = String(orig.get(f) || '')
      const depois = String(rec.get(f) || '')
      if (antes !== depois) {
        return e.json(400, {
          code: 'campo_imutavel',
          message: 'Campo imutável não pode ser alterado: ' + f,
        })
      }
    }

    // 2) Auditoria ATÔMICA (fail-closed): se o evento falhar, a correção também falha.
    const respostaAnterior = String(orig.get('resposta') || '')
    const respostaNova = String(rec.get('resposta') || '')
    if (respostaAnterior !== respostaNova) {
      const sessaoId = String(rec.get('sessao_id') || '')
      const leadId = String(rec.get('lead_id') || '')
      const roteiroVersaoId = String(rec.get('roteiro_versao_id') || '')
      const perguntaId = String(rec.get('pergunta_id') || '')

      let seq = 1
      try {
        const ult = $app.findRecordsByFilter(
          'eventos_negocio',
          'correlation_id = {:c}',
          '-sequencia',
          1,
          0,
          { c: sessaoId },
        )
        if (ult && ult.length) seq = (ult[0].getInt('sequencia') || 0) + 1
      } catch (seqErr) {
        return e.json(500, {
          code: 'auditoria_falhou',
          message: 'Falha ao buscar sequência: ' + String(seqErr).slice(0, 100),
        })
      }

      const ev = new Record($app.findCollectionByNameOrId('eventos_negocio'))
      ev.set('event_id', $security.randomString(24))
      ev.set('correlation_id', sessaoId)
      ev.set('tipo', 'qualificacao_resposta_corrigida')
      ev.set('agregado', 'qualificacao_respostas')
      ev.set('agregado_id', rec.id)
      ev.set('origem', 'sistema')
      ev.set('payload', {
        lead_id: leadId,
        pergunta_id: perguntaId,
        roteiro_versao_id: roteiroVersaoId,
        corrigida: true,
      })
      ev.set('ocorrido_em', new Date().toISOString())
      ev.set('sequencia', seq)
      // SEM try/catch: se o save falhar (ex: guard rejeita), a exceção propaga
      // e o PB faz rollback da correção (mesma requisição HTTP).
      $app.save(ev)
    }

    return e.next()
  } catch (err) {
    // Relançar a exceção: o PB faz rollback do update quando o hook lança
    // uma exceção não capturada. Isso garante que a correção NÃO persista
    // sem o evento de auditoria (atomicidade fail-closed).
    throw err
  }
}, 'qualificacao_respostas')
