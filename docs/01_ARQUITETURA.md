# Arquitetura e Engenharia — Visão Completa

## 1) Componentes
### 1.1 API (Node/TS)
Responsável por:
- Tenancy e RBAC
- CRUD/versionamento do catálogo (schemas/templates)
- Criação e consulta de jobs
- Emissão de presigned URLs (quando aplicável)
- Auditoria de alterações e ações
- Exposição de resultados (JSON canônico + exports)

### 1.2 Worker (Python)
Responsável por:
- Pré-processamento (PDF digital vs scan/imagem)
- OCR quando necessário
- Seleção automática de template (detector + top-K)
- Extração por template (config declarativa)
- Validações técnicas por schema
- Confidence scoring + gate (`AUTO_OK` vs `NEEDS_REVIEW`)
- Geração de artefatos e exports (XLSX/CSV)

### 1.3 Infra compartilhada
- Postgres: catálogo + jobs + resultados + auditoria + reviews + métricas
- Redis Streams: fila (ProcessJob) + DLQ stream
- Storage S3/MinIO: arquivos originais + artefatos (OCR text/layout/debug/export)

## 2) Fluxo ponta a ponta (assíncrono)
1. Vertical chama API: envia arquivos + schema.
2. API salva arquivo no storage e cria job `QUEUED`.
3. API publica `ProcessJob(jobId)` no Redis Stream.
4. Worker consome mensagem, marca `RUNNING`.
5. Worker processa, grava resultado, atualiza status:
   - `DONE` (AUTO_OK) ou `NEEDS_REVIEW` ou `FAILED`.
6. Vertical consulta status/result e baixa artefatos permitidos.

## 3) Seleção automática de template (sem usuário escolher)
- Detector barato seleciona candidatos do schema.
- Executa top-K (K pequeno; no MVP pode ser 1).
- Valida output e calcula score final.
- Escolhe vencedor por score.
- Se nenhum candidato serve, fallback tenta extrair.

## 4) Por que schema explícito (decisão correta)
- Reduz o espaço de busca (menos templates candidatos).
- Evita classificador de schema no MVP (menos custo e erro).
- Habilita validação específica, elevando confiabilidade e performance.

## 5) Templates como DADOS (não como código)
Template é config declarativa (JSON):
- detector_config: como reconhecer layout (fingerprint, termos, anchors)
- extractor_config: como extrair (âncoras, regiões, tabela, key-value)
- validator_overrides: ajustes por layout

Evita gerar/instalar “código novo” por template, melhora governança e auditoria.

## 6) TemplateDraft (semi-automático)
Quando fallback extrai com sucesso:
- cria TemplateDraft com fingerprint + sugestões de âncoras/regiões
- NÃO publica automaticamente
- promoção ocorre com evidência (N ocorrências + baixa correção) e/ou ação do operador no admin console.
