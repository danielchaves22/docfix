# Golden Tests — CARTAO_PONTO@v1 (Regressão de Templates)

## 1) Objetivo
Golden tests verificam que:
- Um conjunto de documentos (inputs) continua gerando **o mesmo output esperado** (expected),
- Mesmo após evoluções no motor, templates, detector, OCR, etc.

Isso é essencial porque templates são “dados” versionados e o motor evolui continuamente.
Sem regressão, você quebra extração silenciosamente.

## 2) Princípio de privacidade (LGPD)
Documentos reais normalmente NÃO devem ser commitados no repositório público/compartilhado.
Este diretório define o **padrão**. Os arquivos de input podem ser:
- armazenados em bucket privado (S3/MinIO) com acesso controlado, ou
- armazenados em um repositório privado separado, ou
- mantidos localmente pelos operadores (com script que puxa de um vault/bucket).

O repositório pode conter apenas:
- `expected` outputs (sem PII), e/ou outputs mascarados,
- hashes e metadados.

## 3) Estrutura recomendada para golden tests
Crie uma área “privada” fora do Git (ex.: `.golden-private/`) ou em bucket:
- inputs (PDF/JPG/XLSX) com identificação estável
- expected outputs (JSON canônico)
- metadados (hash, schema, template esperado, etc.)

### Convenção de nomes (inputs)
- `CP_<caseId>__<descricao_curta>.<ext>`
Exemplo:
- `CP_0001__pdf_digital_layoutA.pdf`
- `CP_0002__scan_ruim_layoutA.jpg`
- `CP_0003__pdf_digital_layoutB.pdf`

### Convenção de nomes (expected)
- `CP_<caseId>__expected.json`

## 4) Manifest (fonte de verdade da suíte)
Use `golden.manifest.json` para enumerar os casos:
- caseId
- schemaId/schemaVersion
- inputRef (path local OU s3Key)
- expectedRef (path local)
- modo de teste:
  - AUTO: seleção automática
  - FORCE: forçar templateId@version (opcional)
- tolerâncias e normalizações

O manifest permite que agentes rodem a suíte sem “adivinhar”.

## 5) Execução do golden test (passo a passo)
Para cada caso:
1) Rodar extração no modo definido:
   - AUTO (default) para simular produção
   - FORCE (opcional) para testar apenas um template
2) Obter output canônico JSON.
3) Normalizar o output (ver seção 6).
4) Comparar com `expected` normalizado.
5) Falha => marcar regressão (bloquear publish/deploy).

## 6) Normalização (ESSENCIAL)
Comparação ingênua de JSON dá falsos negativos. Normalize antes:

### 6.1 Campos voláteis (remover/ignorar)
- `jobId`
- `extractedAt`
- `dayConfidence` (opcional, se variar por OCR)
- `source.bbox` (opcional, se bbox variar entre libs)
- `source.textSnippet` (pode variar por OCR)

Recomendação:
- Definir uma lista de paths ignorados por schema.
- Ex.: `ignorePaths = ["jobId", "extractedAt", "days[].dayConfidence", "days[].punches[].source.bbox", "days[].punches[].source.textSnippet"]`

### 6.2 Ordenação estável
- Ordenar `days` por `date` ascendente (ou manter como esperado)
- Ordenar `punches` por `time` ascendente
- Ordenar `issues` por `code`+`severity`

### 6.3 Normalização de strings
- Trim
- Normalizar whitespace
- Normalizar timezone/formatos se necessário

## 7) Critérios de aceitação
Um caso passa quando:
- output final é válido no JSON Schema de `CARTAO_PONTO@v1`
- após normalização, JSON == expected normalizado

## 8) Como atualizar expected (quando for legítimo)
Expected só deve ser atualizado quando:
- houve evolução intencional do motor/template
- e a mudança foi validada com revisão humana

Toda atualização de expected deve:
- ter commit separado
- referência ao motivo (issue/PR)
- (ideal) registro no audit log do catálogo quando envolver template publish

## 9) Integração com Admin Console (futuro próximo)
O Admin Console deve permitir:
- rodar casos golden em staging
- comparar diffs
- bloquear promoção de TemplateDraft/templates que quebram golden suite

## 10) Recomendação de escopo inicial
Comece com 5–10 casos:
- 2 PDFs digitais (2 layouts)
- 2 scans (qualidades diferentes)
- 1 caso “ruim” que deve ir para NEEDS_REVIEW

E expanda conforme catálogo cresce.
