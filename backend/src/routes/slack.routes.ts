import { Router } from 'express';
import {
  getSlackStatus,
  saveSlackWebhook,
  disconnectSlack,
  getSlackAuthorizeUrl,
  handleSlackOAuthCallback,
  testSlackNotification,
} from '../controllers/slack.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

router.get('/status', requireAuth, getSlackStatus);
router.post('/webhook', requireAuth, saveSlackWebhook);
router.post('/disconnect', requireAuth, disconnectSlack);
router.get('/oauth/authorize', requireAuth, getSlackAuthorizeUrl);
router.get('/oauth/callback', handleSlackOAuthCallback);
router.post('/test', requireAuth, testSlackNotification);

export default router;

