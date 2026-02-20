# Sequência de Atividades (do zero absoluto)

## A) Fundação (repo + infra)
1. Criar monorepo (estrutura /apps /services /packages /infra /docs).
2. docker-compose com Postgres + Redis + MinIO.
3. pipelines CI: lint/test básico Node/Python.

## B) Modelo de dados
4. Migrations SQL em `services/api/migrations` usando `node-pg-migrate` (API é dona do schema).
5. Seed mínimo via API: `CARTAO_PONTO@v1` (schema_versions).

## C) Contratos “travados”
6. Publicar contrato de fila `ProcessJob v1`.
7. Publicar `confidence gate` (score + thresholds).
8. Publicar schema canônico `CARTAO_PONTO@v1`.

## D) API Node
9. POST /jobs (upload e criar job).
10. Publicar ProcessJob(jobId) no stream.
11. GET /jobs/:id e GET /jobs/:id/result.

## E) Worker Python
12. Consumer Redis Streams + idempotência/lock + retry/DLQ.
13. Pipeline v0: ler arquivo do storage e produzir resultado mock no schema.
14. Pipeline v1: validações do schema + score + gate.

## F) Templates reais
15. Implementar Template v1 (config declarativa) para 1 layout real.
16. Detector + seleção automática (top-K).
17. Instrumentar métricas por template (selected/auto_ok/review/failed).

## G) Admin Console
18. Jobs view (status + download result).
19. CRUD/publish templates e schemas (mínimo).
20. Test harness (AUTO vs FORCE template).

## H) TemplateDraft (fase posterior)
21. Fallback produz draft quando nenhum template casar.
22. Promoção controlada (N ocorrências + baixa correção).
