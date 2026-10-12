import React, { useState } from 'react';
import { X, CheckCircle2, AlertTriangle, Send, Link, Trash2 } from 'lucide-react';
import type { SlackStatus } from '../types';
import { api } from '../api/client';

const SlackIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
  </svg>
);

interface SlackModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: SlackStatus;
  onRefreshStatus: () => Promise<void>;
}

export const SlackModal: React.FC<SlackModalProps> = ({
  isOpen,
  onClose,
  status,
  onRefreshStatus,
}) => {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [channel, setChannel] = useState('#email-alerts');
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleOAuthConnect = async () => {
    try {
      await api.slack.getStatus();
      window.location.href = '/api/slack/oauth/authorize';
    } catch (err: any) {
      alert(err.response?.data?.error || 'Could not initialize Slack OAuth flow. Use direct Webhook URL below.');
    }
  };

  const handleSaveWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl.startsWith('https://hooks.slack.com/')) {
      alert('Please enter a valid Slack Incoming Webhook URL starting with https://hooks.slack.com/');
      return;
    }
    setLoading(true);
    setTestResult(null);
    try {
      await api.slack.saveWebhook(webhookUrl.trim(), channel.trim());
      await onRefreshStatus();
      setTestResult('✅ Slack webhook connected successfully!');
      setWebhookUrl('');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save Slack webhook');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Slack notifications?')) return;
    setLoading(true);
    try {
      await api.slack.disconnect();
      await onRefreshStatus();
      setTestResult('Slack disconnected.');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to disconnect Slack');
    } finally {
      setLoading(false);
    }
  };

  const handleTestAlert = async () => {
    setLoading(true);
    setTestResult(null);
    try {
      await api.slack.sendTest('alex@reachinbox.ai', 50);
      setTestResult('🎉 Live test alert dispatched! Check your Slack channel.');
    } catch (err: any) {
      setTestResult(`❌ Test alert failed: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#121318] border border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl text-xs">
        {/* Header */}
        <div className="bg-zinc-900/80 px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <SlackIcon className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Slack Rate-Limit Integration</h2>
              <p className="text-[11px] text-zinc-400">Live alerts when hourly sending limits are hit</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {status.connected ? (
            /* Connected View */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-emerald-300 text-xs">
                    Slack Connected & Active
                  </div>
                  <p className="text-[11px] text-emerald-400/80 mt-0.5">
                    Target Channel: <span className="font-mono">{status.channel || 'Incoming Webhook'}</span>
                  </p>
                  <p className="text-[10px] text-zinc-400 mt-2">
                    Whenever an outbound email sender reaches their hourly rate limit, an automated alert is immediately posted to your Slack workspace.
                  </p>
                </div>
              </div>

              {testResult && (
                <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs">
                  {testResult}
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleTestAlert}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Live Test Alert</span>
                </button>

                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={loading}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-900 hover:bg-red-500/10 border border-zinc-800 hover:border-red-500/30 text-zinc-400 hover:text-red-400 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Disconnect</span>
                </button>
              </div>
            </div>
          ) : (
            /* Disconnected Setup View */
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 text-zinc-300 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-zinc-400">
                  Connect your Slack channel to receive real-time notifications whenever a sender reaches their hourly email quota and jobs are postponed into the next hour window.
                </p>
              </div>

              {testResult && (
                <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs">
                  {testResult}
                </div>
              )}

              {/* Method 1: Webhook URL */}
              <form onSubmit={handleSaveWebhook} className="space-y-3">
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">
                    Connect via Slack Incoming Webhook
                  </label>
                  <input
                    type="url"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://hooks.slack.com/services/T.../B.../..."
                    required
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 font-mono text-[11px]"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 text-[11px] mb-1">
                    Channel Name (Display Label)
                  </label>
                  <input
                    type="text"
                    value={channel}
                    onChange={(e) => setChannel(e.target.value)}
                    placeholder="#email-alerts"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 text-xs"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
                >
                  <Link className="w-3.5 h-3.5" />
                  <span>Connect Slack Webhook</span>
                </button>
              </form>

              {/* Divider */}
              <div className="relative flex items-center justify-center">
                <div className="border-t border-zinc-800 w-full" />
                <span className="bg-[#121318] px-2 text-[10px] text-zinc-500 uppercase tracking-wider">
                  Or OAuth
                </span>
              </div>

              {/* Method 2: OAuth */}
              <button
                type="button"
                onClick={handleOAuthConnect}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition-all font-medium"
              >
                <SlackIcon className="w-4 h-4 text-[#E01E5A]" />
                <span>Connect via Slack OAuth App</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

