import { prisma } from '../config/prisma';
import { emailQueue } from './queue.service';
import { indexEmailDoc } from '../config/elasticsearch';

/**
 * Reconciles DB state with BullMQ queue on startup.
 * Ensures:
 * 1. Future scheduled emails are registered in BullMQ even after a server restart.
 * 2. Any jobs interrupted in 'PROCESSING' state during a crash are recovered.
 * 3. Already sent emails are never re-queued (guaranteed idempotency).
 */
export async function reconcilePendingJobs(): Promise<void> {
  console.log('🔄 Running startup job reconciler to verify persistence across restarts...');
  try {
    // 1. Recover any jobs that were stuck in PROCESSING when the server terminated
    const stuckJobs = await prisma.emailJob.findMany({
      where: { status: 'PROCESSING' },
    });

    if (stuckJobs.length > 0) {
      console.log(`⚠️ Found ${stuckJobs.length} job(s) left in PROCESSING state after restart. Recovering...`);
      for (const job of stuckJobs) {
        await prisma.emailJob.update({
          where: { id: job.id },
          data: { status: 'SCHEDULED' },
        });

        const delay = Math.max(0, new Date(job.scheduledAt).getTime() - Date.now());
        await emailQueue.add(
          'send-email',
          { emailJobId: job.id, senderEmail: job.senderEmail },
          { jobId: job.id, delay }
        );
      }
    }

    // 2. Check all SCHEDULED or DELAYED_RATE_LIMITED jobs
    const pendingJobs = await prisma.emailJob.findMany({
      where: {
        status: { in: ['SCHEDULED', 'DELAYED_RATE_LIMITED'] },
      },
    });

    let reEnqueuedCount = 0;
    for (const email of pendingJobs) {
      const existingBullJob = await emailQueue.getJob(email.id);
      if (!existingBullJob) {
        const delay = Math.max(0, new Date(email.scheduledAt).getTime() - Date.now());
        await emailQueue.add(
          'send-email',
          { emailJobId: email.id, senderEmail: email.senderEmail },
          { jobId: email.id, delay }
        );
        reEnqueuedCount++;
      }
      // Ensure it's indexed in Elasticsearch
      await indexEmailDoc(email);
    }

    console.log(
      `✅ Reconciler completed: Verified ${pendingJobs.length} pending email(s). Re-enqueued ${reEnqueuedCount} missing job(s).`
    );
  } catch (error: any) {
    console.error('❌ Reconciler error on startup:', error.message);
  }
}

