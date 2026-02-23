import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Client } = pg;

const databaseUrl = process.env.DATABASE_URL ?? 'postgres://docfix:docfix@localhost:5432/docfix';
const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(__dirname, '../../../packages/contracts/schemas/cartao_ponto.v1.schema.json');

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

    await client.query(
      `
        INSERT INTO schema_versions (schema_id, version, definition_json, status, created_by)
        VALUES ($1, $2, $3::jsonb, $4, $5)
        ON CONFLICT (schema_id, version)
        DO UPDATE SET
          definition_json = EXCLUDED.definition_json,
          status = EXCLUDED.status,
          updated_at = now()
      `,
      [schemaId, 1, JSON.stringify(definitionJson), 'PUBLISHED', 'seed-script'],
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
        DO UPDATE SET
          detector_config_json = EXCLUDED.detector_config_json,
          extractor_config_json = EXCLUDED.extractor_config_json,
          validator_overrides_json = EXCLUDED.validator_overrides_json,
          status = EXCLUDED.status,
          updated_at = now()
      `,
      [
        templateId,
        1,
        JSON.stringify({ strategy: 'manual_seed', templateCode: 'CARTAO_PONTO' }),
        JSON.stringify({ schemaId: 'CARTAO_PONTO', schemaVersion: 1 }),
        JSON.stringify({}),
        'PUBLISHED',
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
