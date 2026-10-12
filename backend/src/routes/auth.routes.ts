import { Router } from 'express';
import { demoLogin, getMe, googleAuthUrl, googleCallback } from '../controllers/auth.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

router.post('/demo', demoLogin);
router.get('/me', requireAuth, getMe);
router.get('/google/url', googleAuthUrl);
router.post('/google/callback', googleCallback);

export default router;

