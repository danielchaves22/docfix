# Segurança — Baseline (obrigatório mesmo no MVP)

## 1) Isolamento por tenant
- Toda leitura/escrita de job/result sempre filtra por tenant_id no backend.
- Storage com prefixo por tenant: `tenant/{tenantId}/...`
- Downloads via presigned URL curta, emitida somente após checar permissão.

## 2) Criptografia
- TLS em trânsito.
- Criptografia em repouso no storage (SSE).
- Hash sha256 do arquivo para integridade/deduplicação (opcional).

## 3) Retenção e privacidade (LGPD)
- Retenção padrão (ex.: 30/90 dias) por tenant com purge automático.
- Possibilidade de exclusão antecipada por job.
- Logs não podem conter conteúdo bruto de documentos.

## 4) Input hostil e hardening
- Limites: tamanho do arquivo, páginas, formatos aceitos.
- Timeouts por etapa (OCR/parse/extract).
- Workers em containers isolados.
- Preferir executar OCR/parse sem acesso a rede (quando possível).
- Sanitizar PDFs/imagens (evitar bombas e exploits conhecidos).

## 5) IA/LLM
- Nunca enviar segredos (tokens, chaves) ao modelo.
- Proteger contra prompt injection: modelo recebe apenas texto do documento + schema + instruções fixas.
- Pós-processamento determinístico e validação são obrigatórios (confidence gate).

## 6) Auditoria
- Todas as ações administrativas no catálogo:
  - publish/deprecate/disable/enable
  - promotion/rejection de drafts
  geram audit_event com before/after.
