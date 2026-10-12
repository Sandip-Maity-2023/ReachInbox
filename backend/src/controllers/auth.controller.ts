import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma';
import { config } from '../config/env';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

export async function demoLogin(req: Request, res: Response) {
  try {
    let user = await prisma.user.findFirst({
      where: { email: 'alex.mercer@reachinbox.ai' },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: 'alex.mercer@reachinbox.ai',
          name: 'Alex Mercer',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        },
      });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      config.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        slackConnected: Boolean(user.slackWebhookUrl || user.slackAccessToken),
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

export async function getMe(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      slackConnected: Boolean(user.slackWebhookUrl || user.slackAccessToken),
      slackChannel: user.slackChannel || null,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

export async function googleAuthUrl(req: Request, res: Response) {
  if (!config.GOOGLE_CLIENT_ID) {
    return res.status(400).json({
      error: 'Google Client ID not configured in .env. Please configure GOOGLE_CLIENT_ID or use Demo Login.',
    });
  }

  const redirectUri = `${config.FRONTEND_URL}/auth/google/callback`;
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${config.GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&response_type=code&scope=openid%20email%20profile&access_type=offline`;

  return res.json({ url });
}

export async function googleCallback(req: Request, res: Response) {
  try {
    const { code, credential } = req.body;

    // Handle Google Identity Services One Tap / JWT Credential
    if (credential) {
      const decoded: any = jwt.decode(credential);
      if (decoded && decoded.email) {
        let user = await prisma.user.findUnique({
          where: { email: decoded.email },
        });

        if (!user) {
          user = await prisma.user.create({
            data: {
              email: decoded.email,
              name: decoded.name || decoded.email.split('@')[0],
              avatar: decoded.picture || null,
              googleId: decoded.sub,
            },
          });
        }

        const token = jwt.sign(
          { id: user.id, email: user.email, name: user.name },
          config.JWT_SECRET,
          { expiresIn: '7d' }
        );

        return res.json({
          success: true,
          token,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            avatar: user.avatar,
            slackConnected: Boolean(user.slackWebhookUrl || user.slackAccessToken),
          },
        });
      }
    }

    return res.status(400).json({ error: 'Missing Google credentials or authorization code' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

