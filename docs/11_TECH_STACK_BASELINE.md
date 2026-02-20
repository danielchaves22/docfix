# Baseline de Stack — DB, Migrations e Acesso a Dados

## Decisão (obrigatória para o MVP)
- **Banco**: Postgres
- **Fonte de verdade das migrations**: `services/api/migrations`
- **Quem roda migrations**: apenas a **API** (humano/CI/CD)  
  - **Worker nunca roda migrations**
- **Node (API)**
  - **Migrations**: `node-pg-migrate`
  - **Acesso ao DB**: `kysely` (preferencial) ou `pg` com SQL explícito
  - **Não usar ORM pesado no MVP** (Prisma/TypeORM) para evitar magia e drift de schema
- **Python (Worker)**
  - **Acesso ao DB**: `psycopg` (v3) ou SQLAlchemy **Core** (sem ORM)
  - Objetivo: atualizar status, gravar resultado, registrar relatórios e métricas

## Motivação (por que isso é a melhor escolha)
- Templates/schemas/jobs exigem **controle fino** do SQL, índices e evolução.
- Migrations precisam ser **explícitas e auditáveis**.
- ORMs pesados criam:
  - SQL imprevisível
  - migrações acopladas ao ORM
  - decisões divergentes entre agentes
- Worker não precisa de ORM: é pipeline, não domínio rico.

## Regras de ouro
1) Mudou tabela/coluna/índice? **Migration SQL primeiro.**
2) API é dona do schema do banco.
3) Worker só consome o schema existente.
4) Tudo que um agente gerar deve seguir este baseline (ou justificar tecnicamente a exceção).
