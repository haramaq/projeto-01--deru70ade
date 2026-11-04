/// <reference path="../pb_data/types.d.ts" />

// T2.1 / Etapa 3 — protecao de imutabilidade das regras versionadas.
// Guard GLOBAL: so o superusuario passa (painel, migrations, deploys).

onRecordUpdateRequest((e) => {
  if (e.hasSuperuserAuth()) return e.next()

  const r = e.record
  const orig = r.original()
  const colecao = r.collection().name

  if (colecao === 'eventos_negocio') {
    throw new ForbiddenError('eventos_negocio e append-only: alteracao proibida')
  }

  if (colecao === 'regras_versao') {
    // campos de conteudo e vigencia nunca mudam apos a criacao
    const imutaveis = [
      'regra_chave',
      'versao',
      'conteudo',
      'vigente_de',
      'hash_conteudo',
      'criado_por',
    ]
    for (let i = 0; i < imutaveis.length; i++) {
      const f = imutaveis[i]
      const a = String(orig.getString(f) || '')
      const b = String(r.getString(f) || '')
      if (a !== b) {
        throw new BadRequestError('campo imutavel: ' + f)
      }
    }
    // fechar vigencia: permitido apenas de forma irreversivel
    const ateAntes = String(orig.getString('vigente_ate') || '')
    const ateDepois = String(r.getString('vigente_ate') || '')
    if (ateAntes !== '' && ateDepois !== ateAntes) {
      throw new BadRequestError('vigencia ja fechada nao pode ser reaberta ou alterada')
    }
    // status segue um caminho so: rascunho -> vigente -> encerrada
    const ordem = { rascunho: 0, vigente: 1, encerrada: 2 }
    const sa = ordem[String(orig.getString('status') || 'rascunho')] || 0
    const sb = ordem[String(r.getString('status') || 'rascunho')] || 0
    if (sb < sa) throw new BadRequestError('status nao pode retroceder')
  }

  return e.next()
})
