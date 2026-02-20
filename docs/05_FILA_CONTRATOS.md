# Fila (Redis Streams) — Contrato do Job

## 1) Por que Redis Streams
- Multi-linguagem (Node publica; Python consome).
- Simples no Render.
- Permite consumer groups, ack, retries e DLQ.

## 2) Stream e grupos
- Stream principal: `stream:jobs`
- Consumer group: `cg:workers`
- DLQ stream: `stream:jobs:dlq`

## 3) Mensagem ProcessJob v1 (payload mínimo)
A mensagem deve ser pequena. Worker busca detalhes no DB.

Fields (string por padrão):
- messageType: "ProcessJob"
- version: "1"
- jobId: UUID
- attempt: int (default 1)
- traceId: string (correlação)
- publishedAt: ISO-8601

Regras:
- O worker deve ser idempotente (fila é at-least-once).
- Tentativas:
  - erros transitórios: retry com backoff e incrementa attempt.
  - erros permanentes: marcar FAILED e publicar na DLQ com error_code.

## 4) Idempotência e lock
- Worker tenta adquirir lock via DB (ex.: update condicional status de QUEUED→RUNNING).
- Se job já DONE/NEEDS_REVIEW: ignora e ack.
- Se job RUNNING há muito tempo: aplicar política de recuperação (reatribuir).
