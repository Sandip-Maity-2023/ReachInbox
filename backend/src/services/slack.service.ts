import axios from 'axios';
import { prisma } from '../config/prisma';
import { config } from '../config/env';

export interface SendSlackAlertParams {
  userId?: string | null;
  senderEmail: string;
  limit: number;
  nextAvailableRun: Date;
  jobCountAffected?: number;
}

/**
 * Sends a live Slack notification when a sender's hourly rate limit is hit.
 * If user hasn't connected Slack, gracefully skips without throwing.
 */
export async function sendSlackRateLimitNotification({
  userId,
  senderEmail,
  limit,
  nextAvailableRun,
  jobCountAffected = 1,
}: SendSlackAlertParams): Promise<boolean> {
  try {
    let webhookUrl: string | null = null;
    let accessToken: string | null = null;
    let channel: string | null = null;

    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });
      if (user) {
        webhookUrl = user.slackWebhookUrl;
        accessToken = user.slackAccessToken;
        channel = user.slackChannel;
      }
    } else {
      // Look for any connected user with a Slack integration
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { slackWebhookUrl: { not: null } },
            { slackAccessToken: { not: null } },
          ],
        },
      });
      if (user) {
        webhookUrl = user.slackWebhookUrl;
        accessToken = user.slackAccessToken;
        channel = user.slackChannel;
      }
    }

    if (!webhookUrl && !accessToken) {
      // Slack is not connected; gracefully ignore as required
      console.log(`ℹ️ Slack notification skipped: User has not connected Slack for sender ${senderEmail}`);
      return false;
    }

    const payload = {
      text: `⚠️ Rate Limit Alert: Sender ${senderEmail} has hit the hourly sending limit (${limit} emails/hr).`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '⚠️ ReachInbox Scheduler: Rate Limit Hit',
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Sender *${senderEmail}* has reached the configured hourly limit of *${limit} emails/hour*.\nPending email jobs have been *automatically delayed and rescheduled* into the next available hour window.`,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Sender Account:*\n\`${senderEmail}\``,
            },
            {
              type: 'mrkdwn',
              text: `*Hourly Limit:*\n${limit} emails`,
            },
            {
              type: 'mrkdwn',
              text: `*Action Taken:*\nRescheduled (BullMQ Delayed Job)`,
            },
            {
              type: 'mrkdwn',
              text: `*Next Sending Window:*\n<!date^${Math.floor(nextAvailableRun.getTime() / 1000)}^{date_num} {time_secs}|${nextAvailableRun.toISOString()}>`,
            },
          ],
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `ReachInbox Scheduler • Automated Provider Protection • ${new Date().toLocaleTimeString()}`,
            },
          ],
        },
      ],
    };

    if (webhookUrl) {
      console.log(`📤 Sending live Slack rate-limit alert to webhook for ${senderEmail}...`);
      const response = await axios.post(webhookUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 8000,
      });
      console.log(`✅ Slack notification sent successfully via webhook. Response:`, response.data);
      return true;
    } else if (accessToken && channel) {
      console.log(`📤 Sending live Slack rate-limit alert via Slack API for ${senderEmail}...`);
      const response = await axios.post(
        'https://slack.com/api/chat.postMessage',
        {
          channel,
          ...payload,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 8000,
        }
      );
      console.log(`✅ Slack notification sent via chat.postMessage:`, response.data);
      return response.data.ok === true;
    }
  } catch (error: any) {
    console.error('❌ Failed to dispatch Slack rate-limit notification:', error.message);
  }
  return false;
}

