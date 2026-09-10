migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const clientesCol = app.findCollectionByNameOrId('clientes')
    const revendasCol = app.findCollectionByNameOrId('revendas')
    const vendasCol = app.findCollectionByNameOrId('vendas')
    const ticketsCol = app.findCollectionByNameOrId('tickets')

    // 1. Admin user check/update
    let adminId = ''
    try {
      const adminUser = app.findAuthRecordByEmail(
        '_pb_users_auth_',
        'elisandrodesousaharamaq@gmail.com',
      )
      adminUser.set('role', 'admin')
      adminUser.setVerified(true)
      app.save(adminUser)
      adminId = adminUser.id
    } catch (_) {
      const record = new Record(usersCol)
      record.setEmail('elisandrodesousaharamaq@gmail.com')
      record.setPassword('Skip@Pass')
      record.setVerified(true)
      record.set('name', 'Elisandro de Sousa')
      record.set('role', 'admin')
      app.save(record)
      adminId = record.id
    }

    // 2. Sample Clientes (4 clients: "Construtora Andrade Jr.", "Concretar Mix Serviços", "Araxá Concretos", "Betume Engenharia")
    const clientData = [
      {
        nome: 'Carlos Eduardo Andrade',
        empresa: 'Construtora Andrade Jr.',
        cnpj: '12.345.678/0001-90',
        email: 'contato@andradejr.com.br',
        telefone: '(11) 98765-4321',
        cidade: 'São Paulo',
        estado: 'SP',
        status: 'ativo',
        observacoes: 'Interesse prioritário na linha SUPERMIX para obras de infraestrutura pesada.',
      },
      {
        nome: 'Marcos Vinicius Rezende',
        empresa: 'Concretar Mix Serviços',
        cnpj: '23.456.789/0001-01',
        email: 'compras@concretarmix.com.br',
        telefone: '(31) 97654-3210',
        cidade: 'Belo Horizonte',
        estado: 'MG',
        status: 'ativo',
        observacoes: 'Renovação de frota de vagões misturadores prevista para o próximo trimestre.',
      },
      {
        nome: 'Fernanda Araxá Lima',
        empresa: 'Araxá Concretos',
        cnpj: '34.567.890/0001-12',
        email: 'fernanda@araxaconcretos.ind.br',
        telefone: '(41) 99123-4567',
        cidade: 'Curitiba',
        estado: 'PR',
        status: 'ativo',
        observacoes: 'Cliente histórico Haramaq com alto volume de concreto usinado.',
      },
      {
        nome: 'Roberto Siqueira Guimarães',
        empresa: 'Betume Engenharia',
        cnpj: '45.678.901/0001-23',
        email: 'diretoria@betumeeng.com.br',
        telefone: '(62) 98234-5678',
        cidade: 'Goiânia',
        estado: 'GO',
        status: 'ativo',
        observacoes: 'Prospecção recente na feira agroindustrial de Goiás.',
      },
    ]

    const clientRecords = {}
    for (const c of clientData) {
      try {
        const existing = app.findFirstRecordByData('clientes', 'cnpj', c.cnpj)
        clientRecords[c.empresa] = existing.id
      } catch (_) {
        const rec = new Record(clientesCol)
        rec.set('nome', c.nome)
        rec.set('empresa', c.empresa)
        rec.set('cnpj', c.cnpj)
        rec.set('email', c.email)
        rec.set('telefone', c.telefone)
        rec.set('cidade', c.cidade)
        rec.set('estado', c.estado)
        rec.set('status', c.status)
        rec.set('observacoes', c.observacoes)
        app.save(rec)
        clientRecords[c.empresa] = rec.id
      }
    }

    // 3. Resellers (2 revendas: "Revenda Centro-Oeste" — Goiânia/GO, "Máquinas do Vale" — São José dos Campos/SP)
    const resellerData = [
      {
        nome: 'Revenda Centro-Oeste Máquinas',
        cnpj: '56.789.012/0001-34',
        cidade: 'Goiânia',
        estado: 'GO',
        telefone: '(62) 3210-9800',
        contato_principal: 'Claudio Peixoto',
        email: 'comercial@revendacentroeste.com.br',
        modelos: ['PROHMIX', 'SUPERMIX'],
        status: 'autorizada',
        observacoes: 'Principal revenda credenciada para todo o estado de Goiás e DF.',
      },
      {
        nome: 'Máquinas do Vale Equipamentos',
        cnpj: '67.890.123/0001-45',
        cidade: 'São José dos Campos',
        estado: 'SP',
        telefone: '(12) 3901-2244',
        contato_principal: 'Renata Albuquerque',
        email: 'contato@maquinasdovale.com.br',
        modelos: ['PROHMIX'],
        status: 'autorizada',
        observacoes:
          'Atendimento especializado na região do Vale do Paraíba e Litoral Norte paulista.',
      },
    ]

    for (const r of resellerData) {
      try {
        app.findFirstRecordByData('revendas', 'cnpj', r.cnpj)
      } catch (_) {
        const rec = new Record(revendasCol)
        rec.set('nome', r.nome)
        rec.set('cnpj', r.cnpj)
        rec.set('cidade', r.cidade)
        rec.set('estado', r.estado)
        rec.set('telefone', r.telefone)
        rec.set('contato_principal', r.contato_principal)
        rec.set('email', r.email)
        rec.set('modelos', r.modelos)
        rec.set('status', r.status)
        rec.set('observacoes', r.observacoes)
        app.save(rec)
      }
    }

    // 4. Deals (5 deals spread across the 4 funnel stages, values R$ 280.000 to R$ 640.000, products PROHMIX/SUPERMIX)
    const dealsData = [
      {
        clienteKey: 'Construtora Andrade Jr.',
        produto: 'SUPERMIX',
        valor: 640000,
        etapa: 'fechamento',
        probabilidade: 90,
        data_prevista_fechamento: '2025-04-15',
        proxima_acao: 'Emitir minuta contratual e termo de entrega técnica.',
      },
      {
        clienteKey: 'Concretar Mix Serviços',
        produto: 'SUPERMIX',
        valor: 580000,
        etapa: 'negociacao',
        probabilidade: 75,
        data_prevista_fechamento: '2025-04-30',
        proxima_acao: 'Alinhamento da forma de parcelamento via FINAME/BNDES.',
      },
      {
        clienteKey: 'Araxá Concretos',
        produto: 'PROHMIX',
        valor: 340000,
        etapa: 'orcamento',
        probabilidade: 50,
        data_prevista_fechamento: '2025-05-10',
        proxima_acao: 'Apresentar proposta revisada com kit opcional de lubrificação automática.',
      },
      {
        clienteKey: 'Betume Engenharia',
        produto: 'PROHMIX',
        valor: 280000,
        etapa: 'prospeccao',
        probabilidade: 25,
        data_prevista_fechamento: '2025-05-25',
        proxima_acao: 'Agendar visita técnica para demonstração da lâmina helicoidal.',
      },
      {
        clienteKey: 'Construtora Andrade Jr.',
        produto: 'PROHMIX',
        valor: 310000,
        etapa: 'orcamento',
        probabilidade: 60,
        data_prevista_fechamento: '2025-05-18',
        proxima_acao: 'Enviar ficha técnica do sistema hidráulico e prazo de garantia.',
      },
    ]

    for (const d of dealsData) {
      const cId = clientRecords[d.clienteKey]
      if (!cId) continue
      try {
        // Check duplicate
        const filter =
          "cliente = '" + cId + "' && valor = " + d.valor + " && produto = '" + d.produto + "'"
        const existing = app.findRecordsByFilter('vendas', filter, '', 1, 0)
        if (existing.length > 0) continue
      } catch (_) {}

      const rec = new Record(vendasCol)
      rec.set('cliente', cId)
      rec.set('produto', d.produto)
      rec.set('valor', d.valor)
      rec.set('etapa', d.etapa)
      rec.set('probabilidade', d.probabilidade)
      rec.set('data_prevista_fechamento', d.data_prevista_fechamento)
      rec.set('vendedor', adminId)
      rec.set('proxima_acao', d.proxima_acao)
      app.save(rec)
    }

    // 5. Support tickets (2 tickets referencing sample clients)
    const ticketsData = [
      {
        clienteKey: 'Construtora Andrade Jr.',
        assunto: 'Calibração do sensor de pressão hidráulico',
        descricao:
          'Cliente reportou variação no manômetro de pressão durante descarga contínua no SUPERMIX.',
        prioridade: 'alta',
        status: 'aberto',
        respostas: [
          {
            autor: 'Suporte Técnico Haramaq',
            data: '2025-03-20T10:30:00Z',
            mensagem: 'Recebido chamado. Enviando guia de purga e aferição de válvula de alívio.',
          },
        ],
      },
      {
        clienteKey: 'Concretar Mix Serviços',
        assunto: 'Dúvida sobre substituição de lâminas de desgaste',
        descricao:
          'Solicitação de cronograma preventivo para troca dos segmentos de hélice após 2.000m³.',
        prioridade: 'media',
        status: 'finalizado',
        respostas: [
          {
            autor: 'Suporte Técnico Haramaq',
            data: '2025-03-18T14:15:00Z',
            mensagem:
              'Manual de manutenção e boletim técnico BT-04 enviados para o e-mail cadastrado.',
          },
          {
            autor: 'Cliente',
            data: '2025-03-18T16:00:00Z',
            mensagem: 'Recebido com sucesso, dúvidas sanadas. Obrigado!',
          },
        ],
      },
    ]

    for (const t of ticketsData) {
      const cId = clientRecords[t.clienteKey]
      if (!cId) continue
      try {
        const filter = "cliente = '" + cId + "' && assunto = '" + t.assunto + "'"
        const existing = app.findRecordsByFilter('tickets', filter, '', 1, 0)
        if (existing.length > 0) continue
      } catch (_) {}

      const rec = new Record(ticketsCol)
      rec.set('cliente', cId)
      rec.set('assunto', t.assunto)
      rec.set('descricao', t.descricao)
      rec.set('prioridade', t.prioridade)
      rec.set('status', t.status)
      rec.set('atribuido_a', adminId)
      rec.set('respostas', t.respostas)
      app.save(rec)
    }
  },
  (app) => {
    // down logic is optional for seed
  },
)
