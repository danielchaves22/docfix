# API — Contratos essenciais (público + admin interno)

## 1) Público (consumido por backends verticais)
### POST /v1/jobs
Cria job e registra arquivos.

Request (mínimo):
- schemaId
- schemaVersion
- files[] (upload direto no MVP) ou presigned (fase 2)
- tenantId (vem do contexto do token de serviço; não confiar no body)
- requestedBy (metadado para auditoria "on behalf of")

Response:
- jobId
- status=QUEUED

### GET /v1/jobs/{jobId}
Retorna:
- status: QUEUED/RUNNING/DONE/NEEDS_REVIEW/FAILED
- confidenceScore (quando aplicável)
- selectedTemplate (opcional para debug do integrador, não para UX)
- links para result/export (quando pronto)

### GET /v1/jobs/{jobId}/result
Retorna:
- JSON canônico conforme schema versão.

### GET /v1/jobs/{jobId}/export/xlsx (opcional no MVP)
Retorna:
- arquivo XLSX gerado.

## 2) Admin interno (operadores)
### Schemas
- GET/POST /v1/admin/schemas
- POST /v1/admin/schemas/{id}/versions
- POST /v1/admin/schemas/{id}/versions/{v}/publish
- POST /v1/admin/schemas/{id}/versions/{v}/deprecate

### Templates
- GET/POST /v1/admin/templates?schemaId=...
- POST /v1/admin/templates/{id}/versions
- POST /v1/admin/templates/{id}/versions/{v}/publish
- POST /v1/admin/templates/{id}/disable
- POST /v1/admin/templates/{id}/deprecate

### Test harness (alto ROI)
- POST /v1/admin/tests/run
  - modo: AUTO (seleção automática) ou FORCE (forçar templateId@version)
  - retorna relatório de candidatos, scores, output e diffs (quando houver expected)

### Drafts
- GET /v1/admin/template-drafts
- POST /v1/admin/template-drafts/{id}/promote
- POST /v1/admin/template-drafts/{id}/reject
