# API Service

Implementação MVP da API pública em Node + TypeScript seguindo o contrato OpenAPI.

## Endpoints MVP
- `POST /v1/jobs`
- `GET /v1/jobs/{jobId}`
- `GET /v1/jobs/{jobId}/result`

## Variáveis de ambiente
- `PORT` (default `3000`)
- `DATABASE_URL`
- `REDIS_URL`
- `JOBS_STREAM` (default `stream:jobs`)
- `API_STATIC_BEARER_TOKEN` (token estático MVP)
- `MVP_TENANT_ID` (tenant retornado pelo resolvedor de token MVP)
- `MINIO_ENDPOINT`
- `MINIO_PORT`
- `MINIO_USE_SSL`
- `MINIO_ACCESS_KEY`
- `MINIO_SECRET_KEY`
- `MINIO_BUCKET`

## Execução
```bash
npm run db:migrate --workspace @docfix/api
npm run db:seed --workspace @docfix/api
npm run dev --workspace @docfix/api
```
