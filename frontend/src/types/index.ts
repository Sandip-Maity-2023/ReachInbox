export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string | null;
  slackConnected?: boolean;
  slackChannel?: string | null;
}

export type EmailStatus =
  | 'SCHEDULED'
  | 'PROCESSING'
  | 'SENT'
  | 'FAILED'
  | 'DELAYED_RATE_LIMITED'
  | 'CANCELLED';

export interface EmailJob {
  id: string;
  userId?: string | null;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  status: EmailStatus;
  scheduledAt: string;
  sentAt?: string | null;
  errorMessage?: string | null;
  etherealMessageId?: string | null;
  etherealPreviewUrl?: string | null;
  bullJobId?: string | null;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface EmailStats {
  db: {
    scheduled: number;
    sent: number;
    failed: number;
    delayedRateLimited: number;
    total: number;
  };
  queue: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  };
}

export interface SenderStatus {
  senderEmail: string;
  currentCount: number;
  limit: number;
  remaining: number;
  isLimitReached: boolean;
  resetInSeconds: number;
  nextWindowDate: string;
}

export interface SlackStatus {
  connected: boolean;
  channel?: string | null;
  hasWebhook?: boolean;
  hasOAuth?: boolean;
}

export interface BulkSchedulePayload {
  senderEmail: string;
  recipients: string[];
  subject: string;
  body: string;
  startTime?: string;
  delayBetweenEmails?: number;
  hourlyLimit?: number;
}

