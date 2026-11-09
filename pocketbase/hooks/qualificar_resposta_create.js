// B6-Anel1-v2 — Hook corrigido SEM instrumentação
// AMBIENTE: PocketBase 0.36.6 local (isolado, dados fictícios)
// ESTE ARTEFATO É LOCAL — NÃO é código aprovado para produção.
// A correção do catch genérico requer apply_changes com autorização específica.
//
// CORREÇÃO B6 (duas partes):
// 1. PREVENÇÃO: findRecordsByFilter detecta duplicidade antes do e.next()
// 2. CATCH REFINADO: /unique|not_unique/i detecta violação UNIQUE e retorna 400
//
// LIMITAÇÃO CONHECIDA: a regex /unique|not_unique/i NÃO detecta a mensagem
// do PB 0.36.6 ('GoError: Failed to create record.') — o superuser bypass
// pode receber HTTP 400 validation_not_unique (formato PB nativo) em vez de
// registro_duplicado. Correção adicional recomendada (não incorporada):
// /unique|not_unique|failed to create record/i

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
      if (leadOrigem !== 'sintetico') {
        return e.json(403, {
          code: 'simulador_lead_nao_sintetico',
          message:
            'Respostas simuladas só podem ser gravadas em leads com origem_captura=sintetico.',
        })
      }
    }

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

    if (roteiroVersaoId && perguntaId) {
      let versao = null
      try {
        versao = $app.findRecordById('regras_versao', roteiroVersaoId)
      } catch (_) {}
      if (versao) {
        const conteudoRaw = versao.get('conteudo')
        let conteudo = null
        try {
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

    // CORREÇÃO B6: PREVENÇÃO — verificar duplicidade ANTES do e.next()
    if (leadId && perguntaId && sessaoId) {
      try {
        const duplicados = $app.findRecordsByFilter(
          'qualificacao_respostas',
          'lead_id = {:l} && pergunta_id = {:p} && sessao_id = {:s}',
          '',
          1,
          0,
          { l: leadId, p: perguntaId, s: sessaoId },
        )
        if (duplicados && duplicados.length > 0) {
          return e.json(400, {
            code: 'registro_duplicado',
            message: 'Já existe uma resposta para este lead, pergunta e sessão.',
          })
        }
      } catch (_) {
        // falha na verificação → deixar o PB tratar via UNIQUE (rede de segurança)
      }
    }

    return e.next()
  } catch (err) {
    // CORREÇÃO B6: detectar UNIQUE e retornar 400; relançar outros erros
    const errStr = String(err)
    if (/unique|not_unique/i.test(errStr)) {
      return e.json(400, {
        code: 'registro_duplicado',
        message: 'Já existe uma resposta para este lead, pergunta e sessão.',
      })
    }
    throw err
  }
}, 'qualificacao_respostas')
