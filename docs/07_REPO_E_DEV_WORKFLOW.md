# Monorepo — Organização e Workflow de Desenvolvimento

## 1) Por que monorepo
- Versiona contratos junto do código (API, worker, admin).
- Reduz inconsistência de schema/queue/API.
- Ajuda agentes a operar com contexto único.

## 2) Estrutura
/apps/admin-console
  - Next.js para operação interna (catálogo, jobs, testes, métricas).

/services/api
  - Node/TS: REST API, RBAC, jobs, storage, catálogo, auditoria, publisher da fila.

/services/worker
  - Python: consumer da fila + pipeline de extração + validação + export.

 /packages/contracts
  - contratos: OpenAPI (API), JSON schema (outputs), types TS, etc.
  - fonte de verdade compartilhada (agents devem atualizar aqui primeiro).

/infra
  - docker-compose (db/redis/minio)
  - scripts de dev

/docs
  - pilar e specs.

## 3) Gestão de dependências
- Node: pnpm (workspace) recomendado.
- Python: Poetry (pyproject.toml) recomendado.
- Execução local: docker compose para subir infra; rodar API/worker localmente ou em containers.

## 3.1) Banco e migrations (baseline obrigatório)
- Postgres como banco.
- Migrations em `services/api/migrations` (fonte de verdade).
- Apenas a API (humano/CI/CD) executa migrations.
- Worker **nunca** executa migrations.
- Node/API:
  - Migrations: `node-pg-migrate`
  - Acesso ao DB: `kysely` (preferencial) ou `pg` com SQL explícito
- Python/Worker:
  - Acesso ao DB: `psycopg` (v3) ou SQLAlchemy Core (sem ORM)
- Referência: `docs/11_TECH_STACK_BASELINE.md`

## 4) Execução local (conceito)
- Subir infra: `docker compose up -d`
- Rodar API: `pnpm -C services/api dev`
- Rodar Worker: `poetry -C services/worker run python -m worker`

(agentes podem gerar scripts equivalentes)

## 5) Ambientes
- dev: MinIO + Postgres + Redis local
- staging: semelhante a prod, para testar templates/schemas antes de publicar
- prod: storage S3 (ou compatível), Postgres gerenciado, Redis gerenciado

## 6) Regras de versionamento do catálogo
- schema/template publicado é imutável.
- mudança = nova versão.
- publish/deprecate/disable sempre auditado.
