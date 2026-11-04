/// <reference path="../pb_data/types.d.ts" />
// T2.2-T4-B — Hook qualificar_resposta_create: validação de respostas de qualificação.
// Disparo: onRecordCreateRequest de qualificacao_respostas.
//
// Validações:
// 1. lead_id existe em vendas (relation — PB valida automaticamente)
// 2. sessao_id preenchido (required — PB valida)
// 3. roteiro_versao_id existe em regras_versao com regra_chave = 'roteiro:qualificacao'
//    ou 'roteiro:qualificacao:qa'
// 4. pergunta_id existe no conteúdo JSON da versão do roteiro
// 5. origem='simulador' → APENAS origem_captura='sintetico' permitido
// 6. origem desconhecida → rejeitada
// 7. falha na consulta ao lead → rejeitada (fail-closed)
// 8. Validação cruzada: roteiro × tipo do lead (T2.2-T4-C5)
//    - lead sintético (origem_captura='sintetico') → APENAS roteiro:qualificacao:qa
//    - lead comercial (origem_captura='manual'/'captacao_automatica'/vazio) → APENAS roteiro:qualificacao
//
// Superuser bypass (padrão da plataforma).

onRecordCreateRequest((e) => {
  try {
    if (e.hasSuperuserAuth()) return e.next()
    const colecao = e.record.collection().name
    if (colecao !== 'qualificacao_respostas') return e.next()

    const rec = e.record
    const body = (e.requestInfo() && e.requestInfo().body) || {}
    const leadId = String(rec.get('lead_id') || body.lead_id || '')
    const perguntaId = String(rec.get('pergunta_id') || body.pergunta_id || '')
    const roteiroVersaoId = String(rec.get('roteiro_versao_id') || body.roteiro_versao_id || '')
    const sessaoId = String(rec.get('sessao_id') || body.sessao_id || '')
    const origem = String(rec.get('origem') || body.origem || '')

    // 1) Isolamento do simulador (fail-closed):
    // a) origem deve ser 'triagem' ou 'simulador' (rejeitar origem desconhecida)
    // b) origem='simulador' exige sessao_id prefixo 'sim_'
    // c) respostas simuladas APENAS em leads com origem_captura='sintetico'
    // d) falha na consulta ao lead → rejeitar (fail-closed)
    const origensValidas = ['triagem', 'simulador']
    if (origensValidas.indexOf(origem) === -1) {
      return e.json(400, {
        code: 'origem_desconhecida',
        message: 'Origem não reconhecida: ' + origem,
      })
    }
    if (origem === 'simulador') {
      if (sessaoId.indexOf('sim_') !== 0) {
        return e.json(400, {
          code: 'simulador_sessao_invalida',
          message: 'Respostas do simulador exigem sessao_id com prefixo sim_.',
        })
      }
      // Consultar o lead (fail-closed: falha na consulta → rejeitar)
      let leadOrigem = ''
      try {
        const lead = $app.findRecordById('vendas', leadId)
        leadOrigem = String(lead.get('origem_captura') || '')
      } catch (leadErr) {
        return e.json(500, {
          code: 'lead_consulta_falhou',
          message: 'Falha ao consultar o lead: ' + String(leadErr).slice(0, 100),
        })
      }
      // Bloquear respostas simuladas em leads não-sintéticos:
      // - origem_captura 'sintetico' = lead de teste (ÚNICO valor permitido)
      // - origem_captura vazio, 'manual', 'captacao_automatica' ou qualquer outro valor = REJEITADO
      if (leadOrigem !== 'sintetico') {
        return e.json(403, {
          code: 'simulador_lead_nao_sintetico',
          message:
            'Respostas simuladas só podem ser gravadas em leads com origem_captura=sintetico.',
        })
      }
    }

    // 2) Validar roteiro_versao_id: deve existir em regras_versao com regra_chave = 'roteiro:qualificacao'
    //    ou 'roteiro:qualificacao:qa'
    if (roteiroVersaoId) {
      let versao = null
      try {
        versao = $app.findRecordById('regras_versao', roteiroVersaoId)
      } catch (err) {
        if (/no rows/i.test(String(err))) {
          return e.json(400, {
            code: 'versao_inexistente',
            message: 'Versão do roteiro não encontrada.',
          })
        }
        throw err
      }
      const regraChave = String(versao.get('regra_chave') || '')
      if (regraChave !== 'roteiro:qualificacao' && regraChave !== 'roteiro:qualificacao:qa') {
        return e.json(400, {
          code: 'versao_roteiro_incorreta',
          message: 'A versão informada não pertence ao roteiro de qualificação.',
        })
      }
      // Validação cruzada: o tipo do lead determina qual roteiro é aceito (T2.2-T4-C5)
      // - lead sintético (origem_captura='sintetico') → APENAS roteiro:qualificacao:qa
      // - lead comercial (origem_captura='manual'/'captacao_automatica'/vazio) → APENAS roteiro:qualificacao
      let leadOrigemCaptura = ''
      try {
        const lead = $app.findRecordById('vendas', leadId)
        leadOrigemCaptura = String(lead.get('origem_captura') || '')
      } catch (leadErr) {
        return e.json(500, {
          code: 'lead_consulta_falhou',
          message: 'Falha ao consultar o lead: ' + String(leadErr).slice(0, 100),
        })
      }
      const roteiroEsperado =
        leadOrigemCaptura === 'sintetico' ? 'roteiro:qualificacao:qa' : 'roteiro:qualificacao'
      if (regraChave !== roteiroEsperado) {
        return e.json(400, {
          code: 'roteiro_incompativel_lead',
          message: 'O roteiro não corresponde ao tipo do lead. Esperado: ' + roteiroEsperado,
        })
      }
    }

    // 3) Validar pergunta_id: deve existir no conteúdo JSON da versão do roteiro
    if (roteiroVersaoId && perguntaId) {
      let versao = null
      try {
        versao = $app.findRecordById('regras_versao', roteiroVersaoId)
      } catch (_) {
        /* já validado acima */
      }
      if (versao) {
        const conteudoRaw = versao.get('conteudo')
        let conteudo = null
        try {
          // O PB retorna o campo json como objeto Goja (iterável por caracteres).
          // Converter para string e fazer parse para obter o objeto JSON original:
          conteudo = JSON.parse(String(conteudoRaw))
        } catch (_) {
          conteudo = null
        }
        if (conteudo && conteudo.perguntas) {
          const perguntas = conteudo.perguntas
          let existe = false
          for (let k = 0; k < perguntas.length; k++) {
            if (String(perguntas[k].id || '') === perguntaId) {
              existe = true
              break
            }
          }
          if (!existe) {
            return e.json(400, {
              code: 'pergunta_inexistente',
              message: 'A pergunta informada não existe no roteiro.',
            })
          }
        } else {
          return e.json(400, {
            code: 'roteiro_sem_perguntas',
            message: 'O roteiro não contém perguntas válidas.',
          })
        }
      }
    }

    return e.next()
  } catch (err) {
    return e.json(500, { code: 'erro_validacao_resposta', message: String(err).slice(0, 200) })
  }
}, 'qualificacao_respostas')
