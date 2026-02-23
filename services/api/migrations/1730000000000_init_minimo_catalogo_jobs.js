/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  pgm.createExtension('pgcrypto', { ifNotExists: true });

  pgm.createTable('schemas', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    code: { type: 'varchar(100)', notNull: true, unique: true },
    description: { type: 'text' },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.createTable('schema_versions', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    schema_id: {
      type: 'uuid',
      notNull: true,
      references: 'schemas',
      onDelete: 'CASCADE',
    },
    version: { type: 'integer', notNull: true },
    definition_json: { type: 'jsonb', notNull: true },
    status: {
      type: 'varchar(20)',
      notNull: true,
      default: 'DRAFT',
      check: "status in ('DRAFT', 'PUBLISHED', 'DEPRECATED')",
    },
    created_by: { type: 'varchar(120)' },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });
  pgm.addConstraint('schema_versions', 'schema_versions_schema_version_unique', {
    unique: ['schema_id', 'version'],
  });

  pgm.createTable('templates', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    schema_id: {
      type: 'uuid',
      notNull: true,
      references: 'schemas',
      onDelete: 'RESTRICT',
    },
    name: { type: 'varchar(120)', notNull: true },
    status: {
      type: 'varchar(20)',
      notNull: true,
      default: 'ACTIVE',
      check: "status in ('ACTIVE', 'DISABLED', 'DEPRECATED')",
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.addConstraint('templates', 'templates_schema_name_unique', {
    unique: ['schema_id', 'name'],
  });

  pgm.createTable('template_versions', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    template_id: {
      type: 'uuid',
      notNull: true,
      references: 'templates',
      onDelete: 'CASCADE',
    },
    version: { type: 'integer', notNull: true },
    detector_config_json: { type: 'jsonb' },
    extractor_config_json: { type: 'jsonb' },
    validator_overrides_json: { type: 'jsonb' },
    status: {
      type: 'varchar(20)',
      notNull: true,
      default: 'DRAFT',
      check: "status in ('DRAFT', 'PUBLISHED', 'DEPRECATED')",
    },
    created_by: { type: 'varchar(120)' },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });
  pgm.addConstraint('template_versions', 'template_versions_template_version_unique', {
    unique: ['template_id', 'version'],
  });

  pgm.createTable('extraction_jobs', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    tenant_id: { type: 'varchar(80)', notNull: true },
    schema_id: {
      type: 'uuid',
      notNull: true,
      references: 'schemas',
      onDelete: 'RESTRICT',
    },
    schema_version: { type: 'integer', notNull: true },
    status: {
      type: 'varchar(20)',
      notNull: true,
      default: 'PENDING',
      check: "status in ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'NEEDS_REVIEW')",
    },
    selected_template_id: {
      type: 'uuid',
      references: 'templates',
      onDelete: 'SET NULL',
    },
    selected_template_version: { type: 'integer' },
    confidence_score: { type: 'numeric(5,4)' },
    error_code: { type: 'varchar(80)' },
    error_message: { type: 'text' },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
    started_at: { type: 'timestamptz' },
    finished_at: { type: 'timestamptz' },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });
  pgm.createIndex('extraction_jobs', ['tenant_id']);
  pgm.createIndex('extraction_jobs', ['status']);

  pgm.createTable('job_files', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    job_id: {
      type: 'uuid',
      notNull: true,
      references: 'extraction_jobs',
      onDelete: 'CASCADE',
    },
    storage_key: { type: 'text', notNull: true },
    file_hash: { type: 'varchar(128)' },
    metadata_json: { type: 'jsonb' },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });
  pgm.createIndex('job_files', ['job_id']);

  pgm.createTable('job_results', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    job_id: {
      type: 'uuid',
      notNull: true,
      references: 'extraction_jobs',
      onDelete: 'CASCADE',
      unique: true,
    },
    result_json: { type: 'jsonb', notNull: true },
    exported_json_key: { type: 'text' },
    exported_pdf_key: { type: 'text' },
    validation_report_json: { type: 'jsonb' },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });
  pgm.createIndex('job_results', ['job_id']);

  pgm.createTable('audit_event', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    tenant_id: { type: 'varchar(80)' },
    actor_id: { type: 'varchar(120)' },
    action: { type: 'varchar(120)', notNull: true },
    target_type: { type: 'varchar(80)', notNull: true },
    target_id: { type: 'varchar(120)', notNull: true },
    payload_json: { type: 'jsonb' },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });
  pgm.createIndex('audit_event', ['tenant_id']);
  pgm.createIndex('audit_event', ['created_at']);
};

exports.down = (pgm) => {
  pgm.dropTable('audit_event', { ifExists: true, cascade: true });
  pgm.dropTable('job_results', { ifExists: true, cascade: true });
  pgm.dropTable('job_files', { ifExists: true, cascade: true });
  pgm.dropTable('extraction_jobs', { ifExists: true, cascade: true });
  pgm.dropTable('template_versions', { ifExists: true, cascade: true });
  pgm.dropTable('templates', { ifExists: true, cascade: true });
  pgm.dropTable('schema_versions', { ifExists: true, cascade: true });
  pgm.dropTable('schemas', { ifExists: true, cascade: true });
};
