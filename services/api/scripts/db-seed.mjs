import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Client } = pg;

const databaseUrl = process.env.DATABASE_URL ?? 'postgres://docfix:docfix@localhost:5432/docfix';
const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(__dirname, '../../../packages/contracts/schemas/cartao_ponto.v1.schema.json');

function stableJson(value) {
  return JSON.stringify(value);
}

function assertPublishedImmutable(existingRow, nextValues, entityLabel) {
  if (!existingRow) {
    return;
  }

  const definitionChanged = stableJson(existingRow.definition_json) !== stableJson(nextValues.definition_json);
  const statusChanged = existingRow.status !== nextValues.status;

  if (definitionChanged || statusChanged) {
    throw new Error(
      `${entityLabel} publicada é imutável. Crie uma nova versão em vez de alterar a existente.`,
    );
  }
}

function assertPublishedTemplateImmutable(existingRow, nextValues) {
  if (!existingRow) {
    return;
  }

  const detectorChanged =
    stableJson(existingRow.detector_config_json) !== stableJson(nextValues.detector_config_json);
  const extractorChanged =
    stableJson(existingRow.extractor_config_json) !== stableJson(nextValues.extractor_config_json);
  const validatorChanged =
    stableJson(existingRow.validator_overrides_json) !== stableJson(nextValues.validator_overrides_json);
  const statusChanged = existingRow.status !== nextValues.status;

  if (detectorChanged || extractorChanged || validatorChanged || statusChanged) {
    throw new Error(
      'Template version publicada é imutável. Crie uma nova versão em vez de alterar a existente.',
    );
  }
}

async function seed() {
  const definitionRaw = await readFile(schemaPath, 'utf8');
  const definitionJson = JSON.parse(definitionRaw);

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query('BEGIN');

    const schemaInsert = await client.query(
      `
        INSERT INTO schemas (code, description)
        VALUES ($1, $2)
        ON CONFLICT (code)
        DO UPDATE SET description = EXCLUDED.description, updated_at = now()
        RETURNING id
      `,
      ['CARTAO_PONTO', 'Schema canônico de extração para cartão de ponto'],
    );

    const schemaId = schemaInsert.rows[0].id;

    const schemaVersionValues = {
      definition_json: definitionJson,
      status: 'PUBLISHED',
    };

    const existingSchemaVersion = await client.query(
      `
        SELECT definition_json, status
        FROM schema_versions
        WHERE schema_id = $1 AND version = $2
        LIMIT 1
      `,
      [schemaId, 1],
    );

    assertPublishedImmutable(existingSchemaVersion.rows[0], schemaVersionValues, 'Schema version');

    await client.query(
      `
        INSERT INTO schema_versions (schema_id, version, definition_json, status, created_by)
        VALUES ($1, $2, $3::jsonb, $4, $5)
        ON CONFLICT (schema_id, version)
        DO NOTHING
      `,
      [schemaId, 1, JSON.stringify(definitionJson), schemaVersionValues.status, 'seed-script'],
    );

    const templateInsert = await client.query(
      `
        INSERT INTO templates (schema_id, name, status)
        VALUES ($1, $2, $3)
        ON CONFLICT DO NOTHING
        RETURNING id
      `,
      [schemaId, 'CARTAO_PONTO', 'ACTIVE'],
    );

    let templateId = templateInsert.rows[0]?.id;

    if (!templateId) {
      const existingTemplate = await client.query(
        `SELECT id FROM templates WHERE schema_id = $1 AND name = $2 LIMIT 1`,
        [schemaId, 'CARTAO_PONTO'],
      );
      templateId = existingTemplate.rows[0].id;
    }

    const templateVersionValues = {
      detector_config_json: { strategy: 'manual_seed', templateCode: 'CARTAO_PONTO' },
      extractor_config_json: { schemaId: 'CARTAO_PONTO', schemaVersion: 1 },
      validator_overrides_json: {},
      status: 'PUBLISHED',
    };

    const existingTemplateVersion = await client.query(
      `
        SELECT detector_config_json, extractor_config_json, validator_overrides_json, status
        FROM template_versions
        WHERE template_id = $1 AND version = $2
        LIMIT 1
      `,
      [templateId, 1],
    );

    assertPublishedTemplateImmutable(existingTemplateVersion.rows[0], templateVersionValues);

    await client.query(
      `
        INSERT INTO template_versions (
          template_id,
          version,
          detector_config_json,
          extractor_config_json,
          validator_overrides_json,
          status,
          created_by
        )
        VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6, $7)
        ON CONFLICT (template_id, version)
        DO NOTHING
      `,
      [
        templateId,
        1,
        JSON.stringify(templateVersionValues.detector_config_json),
        JSON.stringify(templateVersionValues.extractor_config_json),
        JSON.stringify(templateVersionValues.validator_overrides_json),
        templateVersionValues.status,
        'seed-script',
      ],
    );

    await client.query('COMMIT');
    console.log('Seed concluído: CARTAO_PONTO v1 criado/atualizado com sucesso.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Falha no seed:', error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

seed();
