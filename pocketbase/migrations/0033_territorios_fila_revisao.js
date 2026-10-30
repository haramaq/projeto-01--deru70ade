// 0033 — Territórios comerciais internos HARAMAQ + fila de revisão (decisão owner 30/10:
// NÃO usar IBGE; distribuição por DDI/DDD + cidade/UF informada pelo cliente).
// Estrutura relacional interna: cidades_atendidas (cadastro aprovado, UNIQUE cidade_norm+uf)
// → territorio_cidades (cidade → região) → territorio_regioes (região → vendedor, vigência).
// Normalização (regra 7): NFD, sem acentos, minúsculo, espaços colapsados — cidade/UF
// originais preservadas no cadastro. Sem correspondência aproximada (regra 8).
// NÃO altera users, vendas (exceto origem_captura aditivo), RBAC, hooks. 0027 fora.
migrate(
  (app) => {
    // ---- cidades_atendidas: cadastro interno aprovado de cidades/UF ----
    try {
      app.findCollectionByNameOrId('cidades_atendidas')
    } catch (_) {
      const cid = new Collection({
        name: 'cidades_atendidas',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.role = 'admin'",
        updateRule: "@request.auth.role = 'admin'",
        deleteRule: "@request.auth.role = 'admin'",
      })
      cid.fields.add(new Field({ name: 'cidade', type: 'text', required: true, max: 120 }))
      cid.fields.add(
        new Field({ name: 'cidade_normalizada', type: 'text', required: true, max: 120 }),
      )
      cid.fields.add(new Field({ name: 'uf', type: 'text', required: true, min: 2, max: 2 }))
      cid.fields.add(new Field({ name: 'ativo', type: 'bool', required: false }))
      cid.fields.add(new Field({ name: 'observacao', type: 'text', required: false, max: 500 }))
      cid.addIndex('idx_cidades_atendidas_lookup', true, 'cidade_normalizada, uf', '')
      app.save(cid)
    }

    // ---- territorio_regioes: região comercial → vendedor ----
    try {
      app.findCollectionByNameOrId('territorio_regioes')
    } catch (_) {
      const reg = new Collection({
        name: 'territorio_regioes',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.role = 'admin'",
        updateRule: "@request.auth.role = 'admin'",
        deleteRule: "@request.auth.role = 'admin'",
      })
      reg.fields.add(new Field({ name: 'nome', type: 'text', required: true, max: 120 }))
      reg.fields.add(
        new Field({
          name: 'vendedor_id',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
          cascadeDelete: false,
        }),
      )
      reg.fields.add(new Field({ name: 'ativo', type: 'bool', required: false }))
      reg.fields.add(new Field({ name: 'vigente_de', type: 'date', required: false }))
      reg.fields.add(new Field({ name: 'vigente_ate', type: 'date', required: false }))
      reg.addIndex('idx_territorio_regioes_vendedor', false, 'vendedor_id, ativo', '')
      app.save(reg)
    }

    // ---- territorio_cidades: cidade aprovada → região ----
    try {
      app.findCollectionByNameOrId('territorio_cidades')
    } catch (_) {
      const tcIdRef = app.findCollectionByNameOrId('territorio_regioes').id
      const cidIdRef = app.findCollectionByNameOrId('cidades_atendidas').id
      const tc = new Collection({
        name: 'territorio_cidades',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.role = 'admin'",
        updateRule: "@request.auth.role = 'admin'",
        deleteRule: "@request.auth.role = 'admin'",
      })
      tc.fields.add(
        new Field({
          name: 'regiao_id',
          type: 'relation',
          required: true,
          collectionId: tcIdRef,
          maxSelect: 1,
          cascadeDelete: false,
        }),
      )
      tc.fields.add(
        new Field({
          name: 'cidade_id',
          type: 'relation',
          required: true,
          collectionId: cidIdRef,
          maxSelect: 1,
          cascadeDelete: false,
        }),
      )
      tc.addIndex('idx_territorio_cidades_cidade', false, 'cidade_id', '')
      app.save(tc)
    }

    // ---- fila_revisao: exceções do motor (motivo, candidatos, decisão) ----
    try {
      app.findCollectionByNameOrId('fila_revisao')
    } catch (_) {
      const vendasIdRef = app.findCollectionByNameOrId('vendas').id
      const fr = new Collection({
        name: 'fila_revisao',
        type: 'base',
        listRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'triagem')",
        viewRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'triagem')",
        createRule: null,
        updateRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')",
        deleteRule: null,
      })
      fr.fields.add(
        new Field({
          name: 'lead_id',
          type: 'relation',
          required: true,
          collectionId: vendasIdRef,
          maxSelect: 1,
          cascadeDelete: false,
        }),
      )
      fr.fields.add(new Field({ name: 'motivo', type: 'text', required: true, max: 60 }))
      fr.fields.add(new Field({ name: 'detalhe', type: 'text', required: false, max: 1000 }))
      fr.fields.add(
        new Field({ name: 'candidatos', type: 'json', required: false, maxSize: 100000 }),
      )
      fr.fields.add(
        new Field({
          name: 'status',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['pendente', 'resolvida', 'descartada'],
        }),
      )
      fr.fields.add(
        new Field({
          name: 'decidido_por',
          type: 'relation',
          required: false,
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
          cascadeDelete: false,
        }),
      )
      fr.fields.add(new Field({ name: 'decisao', type: 'text', required: false, max: 500 }))
      fr.fields.add(new Field({ name: 'decidido_em', type: 'date', required: false }))
      fr.addIndex('idx_fila_revisao_status', false, 'status, motivo', '')
      fr.addIndex('idx_fila_revisao_lead', false, 'lead_id', '')
      app.save(fr)
    }

    // ---- vendas.origem_captura: separa criação manual de captação automática ----
    try {
      const vendas = app.findCollectionByNameOrId('vendas')
      let temCampo = false
      for (let i = 0; i < vendas.fields.length; i++) {
        if (vendas.fields[i].name === 'origem_captura') {
          temCampo = true
          break
        }
      }
      if (!temCampo) {
        vendas.fields.add(
          new Field({
            name: 'origem_captura',
            type: 'select',
            required: false,
            maxSelect: 1,
            values: ['manual', 'captacao_automatica'],
          }),
        )
        app.save(vendas)
      }
    } catch (_) {}
  },
  (app) => {
    const remover = function (nome) {
      try {
        const c = app.findCollectionByNameOrId(nome)
        app.delete(c)
      } catch (_) {}
    }
    remover('fila_revisao')
    remover('territorio_cidades')
    remover('territorio_regioes')
    remover('cidades_atendidas')
    try {
      const vendas = app.findCollectionByNameOrId('vendas')
      const campos = []
      for (let i = 0; i < vendas.fields.length; i++) {
        if (vendas.fields[i].name !== 'origem_captura') campos.push(vendas.fields[i])
      }
      vendas.fields = campos
      app.save(vendas)
    } catch (_) {}
  },
)
