# Modelo de Dados — Catálogo, Jobs, Métricas

## 1) Catálogo global
### Nota de governança (baseline)
- O schema do banco é controlado por migrations em `services/api/migrations`.
- Apenas a API executa migrations. Worker não executa.
- Referência: `docs/11_TECH_STACK_BASELINE.md`

### schemas
- schemas: id, description
- schema_versions: schema_id, version, definition_json, status (DRAFT/PUBLISHED/DEPRECATED), timestamps, created_by

### templates
- templates: id, schema_id, name, status (ACTIVE/DISABLED/DEPRECATED)
- template_versions: template_id, version, detector_config_json, extractor_config_json, validator_overrides_json, status, timestamps, created_by

Regra: versões publicadas são imutáveis.

## 2) Jobs
- extraction_jobs: tenant_id, schema_id, schema_version, status, selected_template_id/version, confidence_score, error fields, timestamps
- job_files: storage_key, hash, metadata
- job_results: result_json (canônico), export keys, validation_report_json
- job_artifacts: OCR_TEXT, LAYOUT_MAP, DEBUG_TRACE, etc.

## 3) Reviews/correções (para confiabilidade)
- job_reviews: job_id, reviewer, timestamp, changed_fields_count, changes_json

## 4) Métricas por template (mínimo viável)
Calcular on-demand ou manter agregados diários.
Recomendação: tabela `template_metrics_daily` posteriormente.

Campos recomendados:
- times_selected
- auto_ok_count
- needs_review_count
- failed_count
- manual_reviews_count
- fields_corrected_total
- avg/p95_confidence
- avg/p95_runtime_ms

## 5) TemplateDraft
- template_drafts: schema_id, fingerprint_json, draft_config_json, sample_job_id
- occurrences_count, auto_ok, needs_review, manual_reviews
- status: DRAFT/CANDIDATE/PROMOTED/REJECTED
