import app from './app';
import { config } from './config/env';
import { initElasticsearch } from './config/elasticsearch';
import { startEmailWorker, emailWorker } from './workers/email.worker';
import { reconcilePendingJobs } from './services/reconciler.service';
import { prisma } from './config/prisma';
import { redis } from './config/redis';

async function bootstrap() {
  console.log('🚀 Initializing ReachInbox Email Scheduler Service...');

  // 1. Initialize Elasticsearch index
  await initElasticsearch();

  // 2. Reconcile pending & interrupted jobs from DB to BullMQ queue
  await reconcilePendingJobs();

  // 3. Start BullMQ worker
  startEmailWorker();

  // 4. Start HTTP Server
  const server = app.listen(config.PORT, () => {
    console.log(`\n======================================================`);
    console.log(`📡 ReachInbox Backend running on http://127.0.0.1:${config.PORT}`);
    console.log(`📊 BullMQ Live Dashboard: http://127.0.0.1:${config.PORT}/admin/queues`);
    console.log(`🔍 Elasticsearch Search: ${config.ELASTICSEARCH_NODE}`);
    console.log(`⚡ Redis: ${config.REDIS_HOST}:${config.REDIS_PORT}`);
    console.log(`🐘 PostgreSQL DB: ${config.DATABASE_URL.split('@')[1]}`);
    console.log(`======================================================\n`);
  });

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    console.log(`\n🛑 Received ${signal}. Gracefully shutting down...`);
    server.close(async () => {
      console.log('HTTP server closed.');
      if (emailWorker) {
        await emailWorker.close();
        console.log('BullMQ worker stopped.');
      }
      await redis.quit();
      console.log('Redis disconnected.');
      await prisma.$disconnect();
      console.log('Database disconnected.');
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  console.error('❌ Fatal error during bootstrap:', err);
  process.exit(1);
});

