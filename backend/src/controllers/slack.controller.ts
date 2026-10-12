import { Request, Response } from 'express';
import axios from 'axios';
import { prisma } from '../config/prisma';
import { config } from '../config/env';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { sendSlackRateLimitNotification } from '../services/slack.service';

export async function getSlackStatus(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    const isConnected = Boolean(user?.slackWebhookUrl || user?.slackAccessToken);

    return res.json({
      connected: isConnected,
      channel: user?.slackChannel || (user?.slackWebhookUrl ? 'Incoming Webhook' : null),
      hasWebhook: Boolean(user?.slackWebhookUrl),
      hasOAuth: Boolean(user?.slackAccessToken),
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

export async function saveSlackWebhook(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const { webhookUrl, channel } = req.body;

    if (!webhookUrl || typeof webhookUrl !== 'string' || !webhookUrl.startsWith('https://hooks.slack.com/')) {
      return res.status(400).json({
        error: 'Invalid Slack Webhook URL. It must start with https://hooks.slack.com/',
      });
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        slackWebhookUrl: webhookUrl.trim(),
        slackChannel: channel ? channel.trim() : '#general',
      },
    });

    return res.json({
      success: true,
      message: 'Slack webhook connected successfully',
      channel: channel || '#general',
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

export async function disconnectSlack(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;
    await prisma.user.update({
      where: { id: userId },
      data: {
        slackWebhookUrl: null,
        slackAccessToken: null,
        slackChannel: null,
      },
    });

    return res.json({
      success: true,
      message: 'Slack disconnected successfully',
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

export async function getSlackAuthorizeUrl(req: AuthenticatedRequest, res: Response) {
  if (!config.SLACK_CLIENT_ID) {
    return res.status(400).json({
      error: 'Slack Client ID is not configured in .env. You can connect directly using a Slack Webhook URL.',
    });
  }

  const state = req.user?.id || 'demo-user';
  const scopes = 'incoming-webhook,chat:write';
  const url = `https://slack.com/oauth/v2/authorize?client_id=${config.SLACK_CLIENT_ID}&scope=${encodeURIComponent(
    scopes
  )}&redirect_uri=${encodeURIComponent(config.SLACK_REDIRECT_URI)}&state=${state}`;

  return res.json({ url });
}

export async function handleSlackOAuthCallback(req: Request, res: Response) {
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.redirect(`${config.FRONTEND_URL}?slack_error=${encodeURIComponent(String(error))}`);
    }

    if (!code) {
      return res.redirect(`${config.FRONTEND_URL}?slack_error=missing_code`);
    }

    const tokenResponse = await axios.post(
      'https://slack.com/api/oauth.v2.access',
      null,
      {
        params: {
          client_id: config.SLACK_CLIENT_ID,
          client_secret: config.SLACK_CLIENT_SECRET,
          code,
          redirect_uri: config.SLACK_REDIRECT_URI,
        },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );

    const data = tokenResponse.data;
    if (!data.ok) {
      console.error('Slack OAuth token error:', data.error);
      return res.redirect(`${config.FRONTEND_URL}?slack_error=${encodeURIComponent(data.error)}`);
    }

    const userId = typeof state === 'string' && state !== 'demo-user' ? state : undefined;
    const webhookUrl = data.incoming_webhook?.url;
    const channel = data.incoming_webhook?.channel;
    const accessToken = data.access_token;

    if (userId) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          slackWebhookUrl: webhookUrl || null,
          slackAccessToken: accessToken || null,
          slackChannel: channel || null,
        },
      });
    }

    return res.redirect(`${config.FRONTEND_URL}?slack=connected`);
  } catch (err: any) {
    console.error('Slack OAuth callback error:', err.message);
    return res.redirect(`${config.FRONTEND_URL}?slack_error=internal_error`);
  }
}

export async function testSlackNotification(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const { senderEmail = 'demo@reachinbox.ai', limit = 50 } = req.body;

    const nextRun = new Date(Date.now() + 3600 * 1000);
    const sent = await sendSlackRateLimitNotification({
      userId,
      senderEmail,
      limit,
      nextAvailableRun: nextRun,
    });

    if (sent) {
      return res.json({ success: true, message: 'Test notification sent to your Slack channel!' });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Could not send notification. Please verify Slack is connected with a valid webhook or token.',
      });
    }
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

