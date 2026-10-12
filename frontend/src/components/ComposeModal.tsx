import React, { useState, useRef } from 'react';
import { X, Upload, FileText, CheckCircle2, Clock, ShieldAlert, Sparkles } from 'lucide-react';
import type { BulkSchedulePayload } from '../types';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: BulkSchedulePayload) => Promise<void>;
  loading: boolean;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  loading,
}) => {
  const [senderEmail, setSenderEmail] = useState('alex@reachinbox.ai');
  const [customSender, setCustomSender] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState(
    'Hi there,\n\nI came across your company and was really impressed by your recent growth.\nReachInbox transforms cold email outreach with AI-driven sequences.\n\nWould you be open to a 10-minute chat this week?\n\nBest regards,\nOutbox Team'
  );

  const [recipientInput, setRecipientInput] = useState('');
  const [detectedEmails, setDetectedEmails] = useState<string[]>([]);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  // Stagger & rate limiting settings
  const [startTime, setStartTime] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 1);
    return d.toISOString().slice(0, 16);
  });
  const [delayBetweenEmails, setDelayBetweenEmails] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(50);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const extractEmailsFromText = (text: string): string[] => {
    const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
    const matches = text.match(emailRegex) || [];
    return Array.from(new Set(matches.map((e) => e.trim().toLowerCase())));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = String(event.target?.result || '');
      const emails = extractEmailsFromText(content);
      setDetectedEmails(emails);
      setRecipientInput(emails.join(', '));
    };
    reader.readAsText(file);
  };

  const handleManualRecipientChange = (text: string) => {
    setRecipientInput(text);
    const emails = extractEmailsFromText(text);
    setDetectedEmails(emails);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const activeSender = customSender.trim() ? customSender.trim() : senderEmail;
    const finalRecipients =
      detectedEmails.length > 0 ? detectedEmails : extractEmailsFromText(recipientInput);

    if (finalRecipients.length === 0) {
      alert('Please enter or upload at least one valid recipient email address.');
      return;
    }

    if (!subject.trim()) {
      alert('Please enter an email subject.');
      return;
    }

    if (!body.trim()) {
      alert('Please enter email body content.');
      return;
    }

    await onSubmit({
      senderEmail: activeSender,
      recipients: finalRecipients,
      subject: subject.trim(),
      body: body.trim(),
      startTime: startTime ? new Date(startTime).toISOString() : new Date().toISOString(),
      delayBetweenEmails: Number(delayBetweenEmails),
      hourlyLimit: Number(hourlyLimit),
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#121318] border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[#121318]/95 backdrop-blur-md px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Compose & Schedule Email</h2>
              <p className="text-[11px] text-zinc-400">
                Persistent BullMQ job scheduling with throttling & rate limits
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {/* Sender Selection */}
          <div>
            <label className="block text-zinc-300 font-medium mb-1.5">Sender Account</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
              {['alex@reachinbox.ai', 'sarah@outbox.io', 'growth@outboxlabs.com'].map((email) => (
                <button
                  type="button"
                  key={email}
                  onClick={() => {
                    setSenderEmail(email);
                    setCustomSender('');
                  }}
                  className={`px-3 py-2 rounded-lg border text-left transition-all ${
                    senderEmail === email && !customSender
                      ? 'bg-indigo-600/15 border-indigo-500 text-indigo-300 font-semibold'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <div className="truncate">{email}</div>
                </button>
              ))}
            </div>
            <input
              type="email"
              value={customSender}
              onChange={(e) => setCustomSender(e.target.value)}
              placeholder="Or enter custom sender email (e.g. founder@domain.com)"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Subject */}
          <div>
            <label className="block text-zinc-300 font-medium mb-1.5">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Scaling outbound outreach with ReachInbox AI"
              required
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 text-xs"
            />
          </div>

          {/* Recipient Leads / CSV Upload */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-zinc-300 font-medium">Recipient Leads (CSV or Manual)</label>
              {detectedEmails.length > 0 && (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>{detectedEmails.length} email addresses detected</span>
                </span>
              )}
            </div>

            {/* CSV Dropzone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-zinc-800 hover:border-indigo-500/50 bg-zinc-900/60 rounded-xl p-3.5 text-center cursor-pointer transition-colors mb-2 group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="flex items-center justify-center gap-2 text-zinc-400 group-hover:text-indigo-300">
                <Upload className="w-4 h-4 text-zinc-500 group-hover:text-indigo-400" />
                <span className="font-medium">
                  {uploadedFileName
                    ? `Uploaded: ${uploadedFileName}`
                    : 'Upload CSV or Text Lead List (.csv, .txt)'}
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 mt-1">
                Auto-extracts and deduplicates valid email addresses from any column or format
              </p>
            </div>

            {/* Recipient textarea fallback */}
            <textarea
              rows={2}
              value={recipientInput}
              onChange={(e) => handleManualRecipientChange(e.target.value)}
              placeholder="Or paste comma or newline-separated emails: lead1@company.com, lead2@company.com"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 text-xs font-mono"
            />

            {/* Preview chips */}
            {detectedEmails.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5 max-h-20 overflow-y-auto p-1 bg-zinc-900/50 rounded-lg border border-zinc-800/60">
                {detectedEmails.slice(0, 8).map((email, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-300 font-mono"
                  >
                    <FileText className="w-2.5 h-2.5 text-zinc-500" />
                    {email}
                  </span>
                ))}
                {detectedEmails.length > 8 && (
                  <span className="px-2 py-0.5 text-[10px] text-zinc-400 font-medium">
                    +{detectedEmails.length - 8} more leads
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Email Body */}
          <div>
            <label className="block text-zinc-300 font-medium mb-1.5">Email Body</label>
            <textarea
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your email pitch or sequence..."
              required
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 text-xs font-sans"
            />
          </div>

          {/* Throttling & Scheduling Parameters */}
          <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-3">
            <div className="text-zinc-300 font-semibold flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              <span>Queue & Rate Limiting Parameters</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-zinc-400 text-[11px] mb-1">Start Time</label>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:border-indigo-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-zinc-400 text-[11px] mb-1">
                  Delay Between Sends (sec)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={delayBetweenEmails}
                  onChange={(e) => setDelayBetweenEmails(Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:border-indigo-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-zinc-400 text-[11px] mb-1">
                  Hourly Limit / Sender
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={hourlyLimit}
                  onChange={(e) => setHourlyLimit(Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:border-indigo-500 text-xs"
                />
              </div>
            </div>

            <p className="text-[10px] text-zinc-400 flex items-center gap-1">
              <ShieldAlert className="w-3 h-3 text-amber-400" />
              <span>
                If sending volume exceeds {hourlyLimit} emails/hr, BullMQ automatically reschedules overflow jobs to the next hour window & alerts your connected Slack!
              </span>
            </p>
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-medium shadow-lg shadow-indigo-600/25 transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Scheduling Queue...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Schedule Emails</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
