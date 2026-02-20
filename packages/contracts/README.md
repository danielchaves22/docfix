# contracts

## Propósito
Contracts-first para a plataforma de extração.

## Conteúdo
- `openapi/openapi.yaml`: contratos HTTP (público + admin)
- `schemas/*.schema.json`: contratos de outputs canônicos por schema
- `types/*.d.ts`: tipagens TS auxiliares (derivadas dos contratos)
- `examples/`: exemplos válidos/inválidos + golden tests

## Regras
1) A API Node deve aderir ao OpenAPI.
2) O Worker Python deve produzir outputs aderentes aos JSON Schemas.
3) Mudanças em schema/template publicados são versionadas (imutabilidade):
   - muda contrato => nova versão.

## Exemplos e testes (obrigatório em CI)
Este repositório contém exemplos em `examples/`:
- `examples/**/valid/*.json` devem **passar** na validação contra o JSON Schema correspondente.
- `examples/**/invalid/*.json` devem **falhar**.

Recomendação de CI:
1) Validar `openapi/openapi.yaml` (lint e parsing).
2) Validar JSON Schemas (lint e parsing).
3) Rodar validação dos exemplos (valid passa, invalid falha).
4) Rodar golden tests (regressão) conforme `examples/**/golden/README.md`.

## Como usar
- Validação em CI:
  - lint OpenAPI
  - validar JSON Schemas
- Geração:
  - tipos TS a partir do OpenAPI
  - modelos Python a partir dos JSON Schemas (opcional)

## Validação automatizada dos contracts
Execute na raiz do monorepo:

```bash
pnpm contracts:check
```

O comando valida, em sequência:
1) `openapi/openapi.yaml` (parse + validação + lint básico de estrutura/operações).
2) `schemas/*.schema.json` (parse + validação no draft 2020-12).
3) `examples/**/valid/*.json` (devem passar) e `examples/**/invalid/*.json` (devem falhar).

A validação usa `jsonschema` (draft 2020-12) com `FormatChecker`, então `format` (ex.: `date`, `date-time`, `uuid`) e `pattern` são aplicados.
Se qualquer etapa falhar, o script encerra com exit code diferente de zero.