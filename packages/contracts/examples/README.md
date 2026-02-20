# Examples (contracts)

Este diretório contém exemplos **válidos** e **inválidos** para validar:
1) JSON Schemas de outputs canônicos (ex.: `CARTAO_PONTO@v1`)
2) Regras de `additionalProperties: false` (anti-“campo surpresa”)
3) Restrições de formato/padrões (ex.: HH:MM)

## Como usar
- CI deve validar todos os arquivos em `valid/` contra o schema correspondente: **devem passar**.
- CI deve validar todos os arquivos em `invalid/` contra o schema correspondente: **devem falhar**.

## Observação importante
Alguns validadores tratam `format: "date"` / `format: "date-time"` como *annotation* e não como erro.
Recomendação: habilitar validação de `format` no validador (ex.: AJV com `formats`).
Além disso, a plataforma também terá validações determinísticas no worker (confidence gate + rules),
então testes de schema não substituem testes de validação de negócio.

## Golden tests (regressão)
Além de validação estrutural (valid/invalid), mantemos golden tests por schema:
- `examples/<schema>/<version>/golden/README.md`
- suíte de regressão com inputs privados e expected outputs normalizados.
