# Plataforma de Extração de Documentos — Pilar Técnico (Onboarding)

## 1) Propósito
Construir uma plataforma/serviço central de extração de informações a partir de documentos (PDF, JPG/PNG, Excel, etc.) para ser reutilizada por múltiplas aplicações verticais (trabalhista, valuation, contábil, etc.).

A plataforma de extração NÃO é o backend de domínio das aplicações verticais.
Ela é uma ferramenta transversal (“document intelligence”), consumida pelos backends verticais.

## 2) Decisões firmes já tomadas
1. O usuário/aplicação vertical SEMPRE escolhe o **schema** do output (ex.: `CARTAO_PONTO`).
   - Não haverá auto-detecção de schema no MVP (melhora performance e reduz erro).
2. O usuário NUNCA escolhe template.
   - O motor seleciona automaticamente: detector → top-K → extração → validação → escolha por score.
3. Catálogo de schemas/templates é GLOBAL (não exclusivo por cliente/tenant).
4. Confiança controlada por **confidence gate**:
   - Se confiança abaixo do limiar: status `NEEDS_REVIEW`.
   - Proíbe erro silencioso.
5. Quando nenhum template casar:
   - motor usa fallback (OCR/IA/heurísticas),
   - entrega o resultado,
   - gera `TemplateDraft` para evolução semi-automática (promoção controlada por evidência).
6. Métricas por template são obrigatórias:
   - vezes selecionado, `AUTO_OK`, `NEEDS_REVIEW`, falhas, taxa/intensidade de correções.

## 3) Convenções e nomenclaturas
- **Schema**: contrato do output (o que extrair + estrutura/tipos).
- **Template**: layout conhecido/estratégia de extração (como extrair). Interno.
- **TemplateDraft**: rascunho criado automaticamente a partir de fallback bem-sucedido.
- **Job**: execução assíncrona de extração.
- **Evidence**: evidências rastreáveis (bounding boxes, trechos OCR, âncoras) usadas para explicar/corrigir.

## 4) Requisitos de produto/UX
- Integração simples para verticais:
  - envia arquivos + schema
  - recebe jobId
  - consulta status e baixa resultado/export
- Usuário não deve ser exposto a complexidade de templates.
- Resultado deve ser sempre auditável e com risco controlado (confidence gate).

## 5) Stack recomendada (melhor dos dois mundos)
- Plataforma (API, catálogo, RBAC, auditoria, presigned URLs): **Node.js + TypeScript**.
- Extração pesada (PDF/OCR/Visão/IA): **Python Workers**.
- DB: Postgres.
- Fila multi-linguagem: Redis Streams (recomendado no Render).
- Storage S3-compatível: MinIO local, S3 em produção (ou equivalente).
- Admin Console interno: Next.js/React.

## 6) Modelo de autenticação/autorização
- Apps verticais: IdP OIDC para SSO (usuário final).
- Extrator: integração máquina-a-máquina (Client Credentials). 
  - O extrator não terá login de cliente final.
- Admin Console do extrator: IdP (Google/Microsoft) restrito ao time interno.
- Auditoria “on behalf of”: backend vertical informa contexto do usuário no job.

## 7) Regras operacionais e segurança (baseline)
- Isolamento por tenant em jobs/resultados e storage.
- Retenção de documentos configurável.
- Input hostil: limites de tamanho/páginas, timeouts, sandbox do processamento.
- LLM/OCR: nunca enviar segredos; validação determinística pós-IA é obrigatória.
