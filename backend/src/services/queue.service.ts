import { Queue } from 'bullmq';
import { redisConnectionOptions } from '../config/redis';

export const EMAIL_QUEUE_NAME = 'email-queue';

export const emailQueue = new Queue(EMAIL_QUEUE_NAME, {
  connection: redisConnectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      age: 24 * 3600, // keep completed jobs for 24 hours
      count: 1000,
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // keep failed jobs for 7 days
    },
  },
});

export interface EmailJobPayload {
  emailJobId: string;
  senderEmail: string;
}

/**
 * Adds an email to BullMQ with a calculated delay.
 * Uses deterministic jobId to prevent duplicate queue items.
 */
export async function scheduleEmailJob(
  emailJobId: string,
  senderEmail: string,
  scheduledAt: Date
) {
  const now = Date.now();
  const targetTime = new Date(scheduledAt).getTime();
  const delay = Math.max(0, targetTime - now);

  const job = await emailQueue.add(
    'send-email',
    {
      emailJobId,
      senderEmail,
    },
    {
      jobId: emailJobId,
      delay,
    }
  );

  console.log(`⏱️ Scheduled email job ${emailJobId} in BullMQ with delay ${delay}ms (${new Date(scheduledAt).toISOString()})`);
  return job;
}

/**
 * Removes or cancels a pending job from BullMQ
 */
export async function cancelEmailJob(emailJobId: string) {
  try {
    const job = await emailQueue.getJob(emailJobId);
    if (job) {
      await job.remove();
      console.log(`🗑️ Removed job ${emailJobId} from BullMQ queue`);
      return true;
    }
  } catch (err: any) {
    console.warn(`Could not remove job ${emailJobId} from BullMQ:`, err.message);
  }
  return false;
}

