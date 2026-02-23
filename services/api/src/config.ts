export interface ApiConfig {
  port: number;
  databaseUrl: string;
  redisUrl: string;
  jobsStream: string;
  staticBearerToken: string;
  mvpTenantId: string;
  minio: {
    endPoint: string;
    port: number;
    useSSL: boolean;
    accessKey: string;
    secretKey: string;
    bucket: string;
  };
}

function readEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
}

export function loadConfig(): ApiConfig {
  return {
    port: Number(process.env.PORT ?? 3000),
    databaseUrl: readEnv('DATABASE_URL', 'postgres://docfix:docfix@localhost:5432/docfix'),
    redisUrl: readEnv('REDIS_URL', 'redis://localhost:6379'),
    jobsStream: process.env.JOBS_STREAM ?? 'stream:jobs',
    staticBearerToken: readEnv('API_STATIC_BEARER_TOKEN', 'docfix-mvp-token'),
    mvpTenantId: process.env.MVP_TENANT_ID ?? 'tenant-mvp',
    minio: {
      endPoint: readEnv('MINIO_ENDPOINT', 'localhost'),
      port: Number(process.env.MINIO_PORT ?? 9000),
      useSSL: (process.env.MINIO_USE_SSL ?? 'false').toLowerCase() === 'true',
      accessKey: readEnv('MINIO_ACCESS_KEY', 'docfix'),
      secretKey: readEnv('MINIO_SECRET_KEY', 'docfix123'),
      bucket: readEnv('MINIO_BUCKET', 'docfix-jobs'),
    },
  };
}
