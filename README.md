# HARAMAQ CRM — Projeto 01

CRM conversacional da Haramaq Indústria (equipamentos para pecuária — alimentação de bovinos), construído no [Skip](https://goskip.dev) com referência visual/funcional no Altforce para futura integração.

## Stack

- React 19 + Vite + TypeScript
- PocketBase (backend/Skip Cloud)
- Shadcn UI + Tailwind CSS
- Recharts (gráficos)
- pdfjs-dist + tesseract.js (leitura automática de pedidos: PDF e OCR de prints)

## Módulos

- **Dashboard** — painel geral de leads e operações
- **Leads / Kanban** — 11 etapas (incluindo Peças e Pós-vendas, Financeiro e Fiscal, Fornecedores), motivos obrigatórios nas etapas terminais, histórico e tarefas
- **Clientes / Revendas** — cadastros unificados com tipo (cliente final/revenda), External ID, documento CPF/CNPJ, endereço e responsável
- **Suporte** — chamados e pós-venda
- **Relatórios** — filtros por etapa, usuário, origem, região/carteira, linha de equipamento, status e período; exportação CSV
- **Feiras** (admin) — custos (custo estimado total da feira + custos realizados por categoria), resultados comerciais com importação de pedidos (upload/colar print com leitura automática), arquivos e ROI
- **Configurações** (admin) — usuários, perfis, permissões adicionais e auditoria

## Segurança

- RBAC com perfis: admin, gestor, triagem, vendedor, revendedor, suporte
- Permissões efetivas por usuário (booleans) + carteira/território
- Regras de acesso restritivas no PocketBase (migrações)
- Auditoria append-only (`auditoria_acesso`)
- Etapas restritas do Kanban visíveis apenas a admin/triagem/suporte

## Desenvolvimento

```bash
npm install
npm start        # desenvolvimento
npm run build    # produção
npm test         # validação do contrato (scripts/validate_contract.mjs)
```

## Migrações

Em `pocketbase/migrations/` (PocketBase v0.36, hooks em goja — sem built-ins de Node).

## Repositório de documentação

Especificações e fases do projeto (consultoria Adapta): `kimberlyPrest/Haramaq---Adapta-Native`.

## Notas

- `.env` não é versionado; defina `VITE_POCKETBASE_URL` localmente.
- Produção: `https://finalizacao-da-implementacao-abb7b.goskip.app`
