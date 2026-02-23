import crypto from 'node:crypto';
import express, { Request, Response, RequestHandler } from 'express';
import multer from 'multer';
import { PoolClient } from 'pg';
import { ApiConfig } from './config';
import { Infra, withTransaction } from './infra';
import { ErrorResponse, JobStatus } from './types';

const upload = multer({ storage: multer.memoryStorage() });

function errorResponse(res: Response<ErrorResponse>, status: number, errorCode: string, message: string, details?: Record<string, unknown>) {
  return res.status(status).json({ errorCode, message, details });
}

function normalizeRequestedBy(raw: unknown): Record<string, unknown> | null {
  if (!raw) {
    return null;
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : null;
    } catch {
      return null;
    }
  }
  if (typeof raw === 'object') {
    return raw as Record<string, unknown>;
  }
  return null;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function resolveSchemaInternalId(client: PoolClient, schemaCode: string): Promise<string | null> {
  const query = await client.query('SELECT id FROM schemas WHERE code = $1 LIMIT 1', [schemaCode]);
  return query.rows[0]?.id ?? null;
}

async function hasSchemaVersion(client: PoolClient, schemaInternalId: string, schemaVersion: number): Promise<boolean> {
  const query = await client.query(
    `
      SELECT 1
      FROM schema_versions
      WHERE schema_id = $1 AND version = $2
      LIMIT 1
    `,
    [schemaInternalId, schemaVersion],
  );

  return (query.rowCount ?? 0) > 0;
}

export function buildApp(config: ApiConfig, infra: Infra, auth: RequestHandler) {
  const app = express();
  app.use(express.json());
  app.use(auth);

  app.post('/v1/jobs', upload.array('files'), async (req: Request, res: Response) => {
    const principal = req.principal;
    if (!principal) {
      return res.status(401).send();
    }

    const schemaId = typeof req.body.schemaId === 'string' ? req.body.schemaId.trim() : '';
    const schemaVersion = Number(req.body.schemaVersion);
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];

    if (!schemaId || !Number.isInteger(schemaVersion) || schemaVersion <= 0 || files.length === 0) {
      return errorResponse(res, 400, 'INVALID_REQUEST', 'Parâmetros inválidos para criação do job.');
    }

    const requestedBy = normalizeRequestedBy(req.body.requestedBy);

    try {
      const now = new Date().toISOString();
      const traceId = req.header('x-trace-id') ?? crypto.randomUUID();
      const created = await withTransaction(infra.pool, async (client) => {
        const schemaInternalId = await resolveSchemaInternalId(client, schemaId);
        if (!schemaInternalId) {
          throw new Error('SCHEMA_NOT_FOUND');
        }

        const versionExists = await hasSchemaVersion(client, schemaInternalId, schemaVersion);
        if (!versionExists) {
          throw new Error('SCHEMA_VERSION_NOT_FOUND');
        }

        const insertedJob = await client.query(
          `
            INSERT INTO extraction_jobs (tenant_id, schema_id, schema_version, status)
            VALUES ($1, $2, $3, $4)
            RETURNING id, status
          `,
          [principal.tenantId, schemaInternalId, schemaVersion, 'QUEUED'],
        );

        const jobId = insertedJob.rows[0].id as string;

        for (const file of files) {
          const storageKey = `${principal.tenantId}/${jobId}/${crypto.randomUUID()}-${file.originalname}`;
          await infra.minioClient.putObject(config.minio.bucket, storageKey, file.buffer, file.size, {
            'Content-Type': file.mimetype,
          });

          await client.query(
            `
              INSERT INTO job_files (job_id, storage_key, metadata_json)
              VALUES ($1, $2, $3::jsonb)
            `,
            [
              jobId,
              storageKey,
              JSON.stringify({
                originalName: file.originalname,
                mimeType: file.mimetype,
                size: file.size,
                requestedBy,
              }),
            ],
          );
        }

        await infra.redisClient.xAdd(config.jobsStream, '*', {
          messageType: 'ProcessJob',
          version: '1',
          jobId,
          attempt: '1',
          traceId,
          publishedAt: now,
        });

        return { jobId, status: insertedJob.rows[0].status as JobStatus };
      });

      return res.status(201).json(created);
    } catch (error) {
      if (error instanceof Error && error.message === 'SCHEMA_NOT_FOUND') {
        return errorResponse(res, 400, 'INVALID_REQUEST', 'Schema informado não existe.');
      }
      if (error instanceof Error && error.message === 'SCHEMA_VERSION_NOT_FOUND') {
        return errorResponse(res, 400, 'INVALID_REQUEST', 'Versão do schema informada não existe.');
      }
      return errorResponse(res, 500, 'INTERNAL_ERROR', 'Falha ao criar job.');
    }
  });

  app.get('/v1/jobs/:jobId', async (req: Request, res: Response) => {
    const principal = req.principal;
    if (!principal) {
      return res.status(401).send();
    }

    const { jobId } = req.params;
    if (!isUuid(jobId)) {
      return errorResponse(res, 404, 'NOT_FOUND', 'Job não encontrado.');
    }

    const query = await infra.pool.query(
      `
      SELECT
        ej.id,
        ej.status,
        s.code AS schema_code,
        ej.schema_version,
        ej.confidence_score,
        ej.selected_template_id,
        ej.selected_template_version,
        ej.created_at,
        ej.finished_at,
        jr.job_id AS has_result
      FROM extraction_jobs ej
      INNER JOIN schemas s ON s.id = ej.schema_id
      LEFT JOIN job_results jr ON jr.job_id = ej.id
      WHERE ej.id = $1 AND ej.tenant_id = $2
      LIMIT 1
      `,
      [jobId, principal.tenantId],
    );

    if (query.rowCount === 0) {
      return errorResponse(res, 404, 'NOT_FOUND', 'Job não encontrado.');
    }

    const row = query.rows[0];
    const ready = row.status === 'DONE' || row.status === 'NEEDS_REVIEW';

    return res.json({
      jobId: row.id,
      status: row.status,
      schemaId: row.schema_code,
      schemaVersion: row.schema_version,
      confidenceScore: row.confidence_score === null ? null : Number(row.confidence_score),
      selectedTemplate:
        row.selected_template_id && row.selected_template_version
          ? { templateId: row.selected_template_id, templateVersion: row.selected_template_version }
          : null,
      createdAt: row.created_at.toISOString(),
      finishedAt: row.finished_at ? row.finished_at.toISOString() : null,
      links: {
        result: ready && row.has_result ? `/v1/jobs/${row.id}/result` : null,
        exportXlsx: null,
      },
    });
  });

  app.get('/v1/jobs/:jobId/result', async (req: Request, res: Response) => {
    const principal = req.principal;
    if (!principal) {
      return res.status(401).send();
    }

    const { jobId } = req.params;
    if (!isUuid(jobId)) {
      return errorResponse(res, 404, 'NOT_FOUND', 'Job não encontrado.');
    }

    const query = await infra.pool.query(
      `
      SELECT ej.id, ej.status, jr.result_json
      FROM extraction_jobs ej
      LEFT JOIN job_results jr ON jr.job_id = ej.id
      WHERE ej.id = $1 AND ej.tenant_id = $2
      LIMIT 1
      `,
      [jobId, principal.tenantId],
    );

    if (query.rowCount === 0) {
      return errorResponse(res, 404, 'NOT_FOUND', 'Job não encontrado.');
    }

    const row = query.rows[0];
    if (row.status !== 'DONE' && row.status !== 'NEEDS_REVIEW') {
      return errorResponse(res, 409, 'RESULT_NOT_READY', 'Resultado ainda não está disponível.');
    }

    if (!row.result_json) {
      return errorResponse(res, 409, 'RESULT_NOT_READY', 'Resultado ainda não está disponível.');
    }

    return res.json(row.result_json);
  });

  return app;
}
