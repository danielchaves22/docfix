import { authMiddleware, buildTokenResolver } from './auth';
import { buildApp } from './app';
import { loadConfig } from './config';
import { createInfra } from './infra';

async function bootstrap() {
  const config = loadConfig();
  const infra = await createInfra(config);
  const auth = authMiddleware(buildTokenResolver(config));
  const app = buildApp(config, infra, auth);

  app.listen(config.port, () => {
    console.log(`API ouvindo na porta ${config.port}`);
  });
}

bootstrap().catch((error) => {
  console.error('Falha ao inicializar API:', error);
  process.exit(1);
});
