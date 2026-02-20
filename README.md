# DocFix Monorepo

Scaffold inicial do monorepo para API, worker e console administrativo, conforme `docs/07_REPO_E_DEV_WORKFLOW.md`.

## Pré-requisitos
- Node.js 20+
- pnpm 9+
- Python 3.11+
- Poetry 1.8+
- Docker + Docker Compose (plugin)

## Estrutura
- `apps/admin-console`: futuro app Next.js para operação interna.
- `services/api`: futuro serviço Node/TypeScript (REST, RBAC, jobs, auditoria).
- `services/worker`: futuro worker Python para pipeline assíncrono.
- `packages/contracts`: contratos compartilhados (OpenAPI, schemas, tipos).
- `infra`: stack local com Postgres/Redis/MinIO.
- `docs`: documentação de arquitetura e execução.

## Subir infraestrutura local
```bash
cd infra
docker compose up -d
```

Serviços expostos:
- Postgres: `localhost:5432`
- Redis: `localhost:6379`
- MinIO API: `localhost:9000`
- MinIO Console: `localhost:9001`
- Adminer: `localhost:8080`

Para derrubar:
```bash
cd infra
docker compose down
```

## Rodar API localmente
```bash
pnpm install
pnpm dev:api
```

## Rodar Worker localmente
```bash
cd services/worker
poetry install
poetry run python -m worker
```

## Rodar Admin Console localmente
```bash
pnpm install
pnpm dev:admin
```

## Scripts do workspace
No root do repositório:
```bash
pnpm lint
pnpm test
pnpm build
```

Todos estão como placeholders para permitir evolução incremental sem bloquear o workflow inicial.
