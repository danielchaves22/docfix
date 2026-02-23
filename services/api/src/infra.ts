import { Pool, PoolClient } from 'pg';
import { Client as MinioClient } from 'minio';
import { createClient } from 'redis';
import { ApiConfig } from './config';

export interface Infra {
  pool: Pool;
  minioClient: MinioClient;
  redisClient: ReturnType<typeof createClient>;
  close: () => Promise<void>;
}

export async function createInfra(config: ApiConfig): Promise<Infra> {
  const pool = new Pool({ connectionString: config.databaseUrl });

  const minioClient = new MinioClient({
    endPoint: config.minio.endPoint,
    port: config.minio.port,
    useSSL: config.minio.useSSL,
    accessKey: config.minio.accessKey,
    secretKey: config.minio.secretKey,
  });

  const redisClient = createClient({ url: config.redisUrl });
  await redisClient.connect();

  const bucketExists = await minioClient.bucketExists(config.minio.bucket);
  if (!bucketExists) {
    await minioClient.makeBucket(config.minio.bucket);
  }

  return {
    pool,
    minioClient,
    redisClient,
    close: async () => {
      await redisClient.quit();
      await pool.end();
    },
  };
}

export async function withTransaction<T>(pool: Pool, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
