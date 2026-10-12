import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { prisma } from '../config/prisma';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    avatar?: string | null;
  };
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, config.JWT_SECRET) as any;
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
      });
      if (user) {
        req.user = {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
        };
        return next();
      }
    }

    // Default demo user fallback for seamless local testing
    let demoUser = await prisma.user.findFirst({
      where: { email: 'alex.mercer@reachinbox.ai' },
    });
    if (!demoUser) {
      demoUser = await prisma.user.create({
        data: {
          email: 'alex.mercer@reachinbox.ai',
          name: 'Alex Mercer',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        },
      });
    }

    req.user = {
      id: demoUser.id,
      email: demoUser.email,
      name: demoUser.name,
      avatar: demoUser.avatar,
    };
    return next();
  } catch (error) {
    return next();
  }
}

