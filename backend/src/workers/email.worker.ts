import { Worker, Job } from 'bullmq';
import { redisConnectionOptions } from '../config/redis';
import { prisma } from '../config/prisma';
import { config } from '../config/env';
import { sendEmail } from '../services/email.service';
import { checkAndIncrementRateLimit } from '../services/rateLimit.service';
import { sendSlackRateLimitNotification } from '../services/slack.service';
import { indexEmailDoc } from '../config/elasticsearch';
import { EMAIL_QUEUE_NAME, EmailJobPayload, emailQueue } from '../services/queue.service';

export let emailWorker: Worker | null = null;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function startEmailWorker(): Worker {
  if (emailWorker) {
    return emailWorker;
  }

  console.log(`🚀 Starting BullMQ worker for '${EMAIL_QUEUE_NAME}' with concurrency=${config.WORKER_CONCURRENCY}`);

  emailWorker = new Worker<EmailJobPayload>(
    EMAIL_QUEUE_NAME,
    async (job: Job<EmailJobPayload>) => {
      const { emailJobId, senderEmail } = job.data;
      console.log(`📥 Processing job ${job.id} for email ${emailJobId} (${senderEmail})`);

      // 1. Atomic DB state transition to PROCESSING to ensure idempotency across workers
      const lockResult = await prisma.emailJob.updateMany({
        where: {
          id: emailJobId,
          status: { in: ['SCHEDULED', 'DELAYED_RATE_LIMITED'] },
        },
        data: {
          status: 'PROCESSING',
        },
      });

      if (lockResult.count === 0) {
        console.log(`⚠️ Email job ${emailJobId} is already processed, in progress, or cancelled. Skipping.`);
        return;
      }

      // 2. Fetch full email job details
      const emailRecord = await prisma.emailJob.findUnique({
        where: { id: emailJobId },
      });

      if (!emailRecord) {
        console.error(`❌ Email job record ${emailJobId} not found in database.`);
        return;
      }

      // 3. Hourly Rate Limit Check
      const rateLimitCheck = await checkAndIncrementRateLimit(emailRecord.senderEmail);

      if (!rateLimitCheck.allowed) {
        console.warn(
          `🛑 Rate limit exceeded for sender ${emailRecord.senderEmail} (${rateLimitCheck.currentCount}/${rateLimitCheck.limit}). Delaying job to next hour window: ${rateLimitCheck.nextWindowDate.toISOString()}`
        );

        // Update database with delayed state and new scheduled time
        const delayedEmail = await prisma.emailJob.update({
          where: { id: emailJobId },
          data: {
            status: 'DELAYED_RATE_LIMITED',
            scheduledAt: rateLimitCheck.nextWindowDate,
          },
        });

        // Update Elasticsearch index
        await indexEmailDoc(delayedEmail);

        // Re-schedule into next hour window via BullMQ delayed job
        await emailQueue.add(
          'send-email',
          {
            emailJobId,
            senderEmail: emailRecord.senderEmail,
          },
          {
            delay: rateLimitCheck.delayUntilNextWindowMs,
            jobId: `${emailJobId}-window-${rateLimitCheck.nextWindowDate.getTime()}`,
          }
        );

        // Live Slack Notification trigger
        await sendSlackRateLimitNotification({
          userId: emailRecord.userId,
          senderEmail: emailRecord.senderEmail,
          limit: rateLimitCheck.limit,
          nextAvailableRun: rateLimitCheck.nextWindowDate,
        });

        return {
          rescheduled: true,
          nextWindow: rateLimitCheck.nextWindowDate,
        };
      }

      // 4. Delay between each email to mimic provider throttling (configurable, e.g. 2 seconds)
      if (config.MIN_DELAY_BETWEEN_EMAILS_MS > 0) {
        await sleep(config.MIN_DELAY_BETWEEN_EMAILS_MS);
      }

      // 5. Send Email via Ethereal SMTP
      try {
        const sendResult = await sendEmail({
          senderEmail: emailRecord.senderEmail,
          recipientEmail: emailRecord.recipientEmail,
          subject: emailRecord.subject,
          body: emailRecord.body,
        });

        console.log(`✅ Email sent successfully! MessageId: ${sendResult.messageId}, Preview: ${sendResult.previewUrl}`);

        // Update DB status to SENT
        const sentRecord = await prisma.emailJob.update({
          where: { id: emailJobId },
          data: {
            status: 'SENT',
            sentAt: new Date(),
            etherealMessageId: sendResult.messageId,
            etherealPreviewUrl: sendResult.previewUrl,
            errorMessage: null,
          },
        });

        // Index in Elasticsearch
        await indexEmailDoc(sentRecord);

        return {
          success: true,
          messageId: sendResult.messageId,
          previewUrl: sendResult.previewUrl,
        };
      } catch (sendError: any) {
        console.error(`❌ SMTP sending error for job ${emailJobId}:`, sendError.message);

        // Update DB status to FAILED
        const failedRecord = await prisma.emailJob.update({
          where: { id: emailJobId },
          data: {
            status: 'FAILED',
            errorMessage: sendError.message,
            retryCount: { increment: 1 },
          },
        });

        // Index in Elasticsearch
        await indexEmailDoc(failedRecord);

        throw sendError;
      }
    },
    {
      connection: redisConnectionOptions,
      concurrency: config.WORKER_CONCURRENCY,
    }
  );

  emailWorker.on('completed', (job: Job) => {
    console.log(`🎉 Job ${job.id} completed successfully`);
  });

  emailWorker.on('failed', (job: Job | undefined, err: Error) => {
    console.error(`💥 Job ${job?.id} failed with error:`, err.message);
  });

  return emailWorker;
}

