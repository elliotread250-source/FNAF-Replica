import { loadEnv } from './env';
import { connect, runMigrations } from './db/client';
import { buildApp } from './app';
import { startCleanup } from './jobs/cleanup';

async function main(): Promise<void> {
  const env = loadEnv();
  const h = connect(env.DATABASE_URL);
  await runMigrations(h);
  const { app, lobbies, close } = await buildApp(env, h);
  if (!env.smtpEnabled) app.log.warn('SMTP not configured: password reset is disabled.');
  const job = startCleanup(h.db, (err) => app.log.warn({ err }, 'cleanup failed'));
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  app.log.info(`FNAF Replica listening on ${env.PORT} (roster: ${env.ROSTER_MODE}${env.fastNight ? ', FAST_NIGHT' : ''})`);

  let stopping = false;
  const stop = async (sig: string) => {
    if (stopping) return;
    stopping = true;
    app.log.info(`${sig}: shutting down`);
    const force = setTimeout(() => process.exit(0), 10_000);
    force.unref();
    clearInterval(job);
    try {
      await lobbies.shutdown();
      await close();
      await h.close();
    } catch (err) {
      app.log.error({ err }, 'shutdown error');
    }
    process.exit(0);
  };
  process.on('SIGTERM', () => void stop('SIGTERM'));
  process.on('SIGINT', () => void stop('SIGINT'));
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
