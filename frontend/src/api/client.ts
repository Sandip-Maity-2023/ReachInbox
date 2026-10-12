import axios from 'axios';
import type { BulkSchedulePayload, EmailJob, EmailStats, SenderStatus, SlackStatus, User } from '../types';

const API_BASE = '/api';

export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('reachinbox_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const api = {
  auth: {
    loginDemo: async (): Promise<{ token: string; user: User }> => {
      const res = await apiClient.post('/auth/demo');
      if (res.data.token) {
        localStorage.setItem('reachinbox_token', res.data.token);
      }
      return res.data;
    },
    getMe: async (): Promise<User> => {
      const res = await apiClient.get('/auth/me');
      return res.data;
    },
    getGoogleUrl: async (): Promise<{ url: string }> => {
      const res = await apiClient.get('/auth/google/url');
      return res.data;
    },
    logout: () => {
      localStorage.removeItem('reachinbox_token');
    },
  },

  emails: {
    getScheduled: async (q?: string): Promise<{ total: number; emails: EmailJob[] }> => {
      const res = await apiClient.get('/emails/scheduled', { params: { q } });
      return res.data;
    },
    getSent: async (q?: string): Promise<{ total: number; emails: EmailJob[] }> => {
      const res = await apiClient.get('/emails/sent', { params: { q } });
      return res.data;
    },
    search: async (q: string, status?: string): Promise<{ total: number; emails: EmailJob[]; source: string }> => {
      const res = await apiClient.get('/emails/search', { params: { q, status } });
      return res.data;
    },
    scheduleBulk: async (payload: BulkSchedulePayload): Promise<any> => {
      const res = await apiClient.post('/emails/schedule-bulk', payload);
      return res.data;
    },
    cancel: async (id: string): Promise<any> => {
      const res = await apiClient.delete(`/emails/${id}`);
      return res.data;
    },
    getStats: async (): Promise<EmailStats> => {
      const res = await apiClient.get('/emails/stats');
      return res.data;
    },
    getSenders: async (): Promise<{ senders: SenderStatus[] }> => {
      const res = await apiClient.get('/emails/senders');
      return res.data;
    },
  },

  slack: {
    getStatus: async (): Promise<SlackStatus> => {
      const res = await apiClient.get('/slack/status');
      return res.data;
    },
    saveWebhook: async (webhookUrl: string, channel?: string): Promise<any> => {
      const res = await apiClient.post('/slack/webhook', { webhookUrl, channel });
      return res.data;
    },
    disconnect: async (): Promise<any> => {
      const res = await apiClient.post('/slack/disconnect');
      return res.data;
    },
    sendTest: async (senderEmail?: string, limit?: number): Promise<any> => {
      const res = await apiClient.post('/slack/test', { senderEmail, limit });
      return res.data;
    },
  },
};
