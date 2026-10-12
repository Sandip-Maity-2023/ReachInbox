import { Response } from 'express';
import { prisma } from '../config/prisma';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { scheduleEmailJob, cancelEmailJob, emailQueue } from '../services/queue.service';
import { indexEmailDoc, searchEmails } from '../config/elasticsearch';
import { getRateLimitStatus } from '../services/rateLimit.service';

/**
 * Schedule a single email
 */
export async function scheduleSingleEmail(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const {
      senderEmail,
      recipientEmail,
      subject,
      body,
      scheduledAt,
      hourlyLimit,
      minDelaySeconds,
    } = req.body;

    if (!senderEmail || !recipientEmail || !subject || !body) {
      return res.status(400).json({ error: 'senderEmail, recipientEmail, subject, and body are required' });
    }

    const scheduledDate = scheduledAt ? new Date(scheduledAt) : new Date();

    // Upsert sender configuration if provided
    if (hourlyLimit || minDelaySeconds) {
      await prisma.senderConfig.upsert({
        where: { senderEmail: senderEmail.toLowerCase() },
        create: {
          senderEmail: senderEmail.toLowerCase(),
          hourlyLimit: hourlyLimit ? parseInt(hourlyLimit, 10) : 200,
          minDelaySeconds: minDelaySeconds ? parseInt(minDelaySeconds, 10) : 2,
        },
        update: {
          hourlyLimit: hourlyLimit ? parseInt(hourlyLimit, 10) : undefined,
          minDelaySeconds: minDelaySeconds ? parseInt(minDelaySeconds, 10) : undefined,
        },
      });
    }

    // Create DB record
    const emailJob = await prisma.emailJob.create({
      data: {
        userId,
        senderEmail: senderEmail.trim().toLowerCase(),
        recipientEmail: recipientEmail.trim().toLowerCase(),
        subject: subject.trim(),
        body: body.trim(),
        status: 'SCHEDULED',
        scheduledAt: scheduledDate,
      },
    });

    // Schedule delayed job in BullMQ
    const bullJob = await scheduleEmailJob(emailJob.id, emailJob.senderEmail, scheduledDate);

    // Update with BullMQ job ID
    const updated = await prisma.emailJob.update({
      where: { id: emailJob.id },
      data: { bullJobId: String(bullJob.id) },
    });

    // Index into Elasticsearch
    await indexEmailDoc(updated);

    return res.status(201).json({
      success: true,
      email: updated,
      message: 'Email scheduled successfully',
    });
  } catch (error: any) {
    console.error('Error scheduling email:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Schedule bulk emails with staggered delays and lead parsing
 */
export async function scheduleBulkEmails(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const {
      senderEmail,
      recipients, // array of strings or comma-separated string
      subject,
      body,
      startTime,
      delayBetweenEmails = 2, // in seconds
      hourlyLimit = 50,
    } = req.body;

    if (!senderEmail || !recipients || !subject || !body) {
      return res.status(400).json({ error: 'senderEmail, recipients, subject, and body are required' });
    }

    // Parse recipient list
    let recipientList: string[] = [];
    if (Array.isArray(recipients)) {
      recipientList = recipients;
    } else if (typeof recipients === 'string') {
      recipientList = recipients
        .split(/[\r\n,;]+/)
        .map((e) => e.trim())
        .filter((e) => e.length > 0 && e.includes('@'));
    }

    // Clean and deduplicate recipient emails
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const cleanRecipients = Array.from(
      new Set(
        recipientList
          .map((e) => e.trim().toLowerCase())
          .filter((e) => emailRegex.test(e))
      )
    );

    if (cleanRecipients.length === 0) {
      return res.status(400).json({ error: 'No valid recipient email addresses found' });
    }

    // Update sender configuration
    await prisma.senderConfig.upsert({
      where: { senderEmail: senderEmail.toLowerCase() },
      create: {
        senderEmail: senderEmail.toLowerCase(),
        hourlyLimit: hourlyLimit ? parseInt(String(hourlyLimit), 10) : 50,
        minDelaySeconds: delayBetweenEmails ? parseInt(String(delayBetweenEmails), 10) : 2,
      },
      update: {
        hourlyLimit: hourlyLimit ? parseInt(String(hourlyLimit), 10) : undefined,
        minDelaySeconds: delayBetweenEmails ? parseInt(String(delayBetweenEmails), 10) : undefined,
      },
    });

    const startTimestamp = startTime ? new Date(startTime).getTime() : Date.now();
    const delayStepMs = (parseInt(String(delayBetweenEmails), 10) || 2) * 1000;

    const scheduledJobs = [];

    for (let i = 0; i < cleanRecipients.length; i++) {
      const recipient = cleanRecipients[i];
      const scheduledTime = new Date(startTimestamp + i * delayStepMs);

      const emailJob = await prisma.emailJob.create({
        data: {
          userId,
          senderEmail: senderEmail.trim().toLowerCase(),
          recipientEmail: recipient,
          subject: subject.trim(),
          body: body.trim(),
          status: 'SCHEDULED',
          scheduledAt: scheduledTime,
        },
      });

      const bullJob = await scheduleEmailJob(emailJob.id, emailJob.senderEmail, scheduledTime);

      const updated = await prisma.emailJob.update({
        where: { id: emailJob.id },
        data: { bullJobId: String(bullJob.id) },
      });

      // Index in Elasticsearch
      await indexEmailDoc(updated);

      scheduledJobs.push(updated);
    }

    return res.status(201).json({
      success: true,
      count: scheduledJobs.length,
      firstScheduledAt: scheduledJobs[0]?.scheduledAt,
      lastScheduledAt: scheduledJobs[scheduledJobs.length - 1]?.scheduledAt,
      jobs: scheduledJobs,
      message: `Successfully scheduled ${scheduledJobs.length} email(s) with ${delayBetweenEmails}s stagger!`,
    });
  } catch (error: any) {
    console.error('Error scheduling bulk emails:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Get Scheduled Emails (status: SCHEDULED, DELAYED_RATE_LIMITED, PROCESSING)
 */
export async function getScheduledEmails(req: AuthenticatedRequest, res: Response) {
  try {
    const { q, limit = 50, offset = 0 } = req.query;

    if (q && String(q).trim() !== '') {
      const searchResult = await searchEmails({
        query: String(q),
        status: 'SCHEDULED',
        limit: parseInt(String(limit), 10),
        offset: parseInt(String(offset), 10),
      });
      return res.json(searchResult);
    }

    const where = {
      status: { in: ['SCHEDULED', 'DELAYED_RATE_LIMITED', 'PROCESSING'] },
    };

    const [total, emails] = await Promise.all([
      prisma.emailJob.count({ where }),
      prisma.emailJob.findMany({
        where,
        take: parseInt(String(limit), 10),
        skip: parseInt(String(offset), 10),
        orderBy: { scheduledAt: 'asc' },
      }),
    ]);

    return res.json({
      total,
      emails,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Get Sent Emails (status: SENT, FAILED)
 */
export async function getSentEmails(req: AuthenticatedRequest, res: Response) {
  try {
    const { q, limit = 50, offset = 0 } = req.query;

    if (q && String(q).trim() !== '') {
      const searchResult = await searchEmails({
        query: String(q),
        status: 'SENT',
        limit: parseInt(String(limit), 10),
        offset: parseInt(String(offset), 10),
      });
      return res.json(searchResult);
    }

    const where = {
      status: { in: ['SENT', 'FAILED'] },
    };

    const [total, emails] = await Promise.all([
      prisma.emailJob.count({ where }),
      prisma.emailJob.findMany({
        where,
        take: parseInt(String(limit), 10),
        skip: parseInt(String(offset), 10),
        orderBy: { sentAt: 'desc' },
      }),
    ]);

    return res.json({
      total,
      emails,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Search emails endpoint via Elasticsearch
 */
export async function searchAllEmails(req: AuthenticatedRequest, res: Response) {
  try {
    const { q = '', status, limit = 50, offset = 0 } = req.query;

    const results = await searchEmails({
      query: String(q),
      status: status ? String(status) : undefined,
      limit: parseInt(String(limit), 10),
      offset: parseInt(String(offset), 10),
    });

    return res.json(results);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Cancel a scheduled email
 */
export async function cancelEmail(req: AuthenticatedRequest, res: Response) {
  try {
    const id = String(req.params.id);

    const email = await prisma.emailJob.findUnique({
      where: { id },
    });

    if (!email) {
      return res.status(404).json({ error: 'Email job not found' });
    }

    if (email.status === 'SENT') {
      return res.status(400).json({ error: 'Cannot cancel an email that has already been sent' });
    }

    // Cancel in BullMQ
    await cancelEmailJob(id);

    // Update in DB
    const updated = await prisma.emailJob.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    // Update in Elasticsearch
    await indexEmailDoc(updated);

    return res.json({
      success: true,
      message: 'Email scheduled job cancelled',
      email: updated,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

/**
 * System and queue statistics
 */
export async function getStats(req: AuthenticatedRequest, res: Response) {
  try {
    const [scheduledCount, sentCount, failedCount, delayedCount] = await Promise.all([
      prisma.emailJob.count({ where: { status: 'SCHEDULED' } }),
      prisma.emailJob.count({ where: { status: 'SENT' } }),
      prisma.emailJob.count({ where: { status: 'FAILED' } }),
      prisma.emailJob.count({ where: { status: 'DELAYED_RATE_LIMITED' } }),
    ]);

    const queueCounts = await emailQueue.getJobCounts(
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed'
    );

    return res.json({
      db: {
        scheduled: scheduledCount,
        sent: sentCount,
        failed: failedCount,
        delayedRateLimited: delayedCount,
        total: scheduledCount + sentCount + failedCount + delayedCount,
      },
      queue: queueCounts,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Get Senders and their current rate-limit usage
 */
export async function getSenders(req: AuthenticatedRequest, res: Response) {
  try {
    const sendersInDb = await prisma.emailJob.findMany({
      select: { senderEmail: true },
      distinct: ['senderEmail'],
    });

    const defaultSenders = ['alex@reachinbox.ai', 'marketing@reachinbox.ai', 'outreach@reachinbox.ai'];
    const allSenders = Array.from(
      new Set([...defaultSenders, ...sendersInDb.map((s) => s.senderEmail)])
    );

    const senderStatuses = await Promise.all(
      allSenders.map(async (email) => {
        return await getRateLimitStatus(email);
      })
    );

    return res.json({ senders: senderStatuses });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
