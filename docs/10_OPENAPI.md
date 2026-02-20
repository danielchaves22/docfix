# OpenAPI e Contracts — Fonte de Verdade

## 1) Objetivo
Este repositório adota **contracts-first** para evitar que agentes gerem APIs/outputs inconsistentes.

A “fonte de verdade” é:
1) `packages/contracts/openapi/openapi.yaml` (contrato HTTP)
2) `packages/contracts/schemas/*.schema.json` (contratos de outputs por schema)

A implementação (Node API e Python worker) deve **seguir os contracts**, não o contrário.

## 2) O que o OpenAPI cobre
O `openapi.yaml` descreve:
- Endpoints públicos (consumidos por backends verticais)
  - `POST /v1/jobs`
  - `GET /v1/jobs/{jobId}`
  - `GET /v1/jobs/{jobId}/result`
  - `GET /v1/jobs/{jobId}/export/xlsx` (opcional)
- Endpoints admin internos (catálogo, testes, drafts)
  - CRUD/versionamento mínimo de schema/template
  - `POST /v1/admin/tests/run`
  - drafts: list/promote/reject

## 3) Auth no OpenAPI (modelo)
O OpenAPI usa Bearer JWT em dois contextos:
- **service token** (machine-to-machine) para endpoints públicos
- **admin token** (OIDC) para endpoints `/v1/admin/*`

No contrato, ambos aparecem como Bearer JWT; a diferença é o **audience/claims** (definidos pelo IdP e validados pela API).

## 4) Tenancy e auditoria (regras)
- `tenantId` **não entra no body** como fonte confiável.
- O tenant vem do token do serviço e é aplicado no backend.
- Para auditoria “on behalf of”, o integrador envia metadados `requestedBy` (user id/email) no request. Isso não altera autorização; apenas registra contexto.

## 5) Output canônico por schema
Para cada schema, existe um JSON Schema versionado.
Exemplo: `CARTAO_PONTO@v1` em:
- `packages/contracts/schemas/cartao_ponto.v1.schema.json`

O endpoint `GET /v1/jobs/{jobId}/result` retorna exatamente o payload compatível com este JSON Schema.

## 6) Geração de SDKs e validação (recomendação)
- Node:
  - gerar tipos a partir do OpenAPI (ou validar runtime via Zod)
- Python:
  - gerar modelos Pydantic a partir do JSON Schema (ou mapear manualmente)
- CI deve validar que:
  - `openapi.yaml` é válido
  - JSON Schemas são válidos
  - exemplos (quando existirem) passam na validação

## 7) Regra de ouro
Nenhum agente deve implementar endpoint/shape “na intuição”.
**Primeiro ajusta o contract**, depois implementa.

## 8) Testes mínimos obrigatórios (contracts-first)
- Validar `openapi.yaml` em CI.
- Validar JSON Schemas em CI.
- Validar exemplos em `packages/contracts/examples`:
  - valid/ passa
  - invalid/ falha
- Golden tests (regressão): executar suíte definida em `packages/contracts/examples/**/golden/`
  com normalização e comparação contra expected.
