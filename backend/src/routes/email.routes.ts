import { Router } from 'express';
import {
  scheduleSingleEmail,
  scheduleBulkEmails,
  getScheduledEmails,
  getSentEmails,
  searchAllEmails,
  cancelEmail,
  getStats,
  getSenders,
} from '../controllers/email.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

router.post('/schedule', requireAuth, scheduleSingleEmail);
router.post('/schedule-bulk', requireAuth, scheduleBulkEmails);
router.get('/scheduled', requireAuth, getScheduledEmails);
router.get('/sent', requireAuth, getSentEmails);
router.get('/search', requireAuth, searchAllEmails);
router.delete('/:id', requireAuth, cancelEmail);
router.get('/stats', requireAuth, getStats);
router.get('/senders', requireAuth, getSenders);

export default router;

