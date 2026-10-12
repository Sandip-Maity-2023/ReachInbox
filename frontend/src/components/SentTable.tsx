import React from 'react';
import type { EmailJob } from '../types';
import { CheckCircle2, XCircle, ExternalLink, Mail, UserCheck } from 'lucide-react';

interface SentTableProps {
  emails: EmailJob[];
  loading: boolean;
  onOpenCompose: () => void;
}

export const SentTable: React.FC<SentTableProps> = ({
  emails,
  loading,
  onOpenCompose,
}) => {
  if (loading) {
    return (
      <div className="bg-[#121318] border border-zinc-800/80 rounded-xl overflow-hidden p-6 space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 bg-zinc-800/40 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="bg-[#121318] border border-zinc-800/80 rounded-xl p-12 text-center flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-3">
          <Mail className="w-6 h-6 text-zinc-500" />
        </div>
        <h3 className="text-sm font-semibold text-zinc-200 mb-1">No sent emails yet</h3>
        <p className="text-xs text-zinc-400 max-w-sm mb-4">
          Emails sent by the BullMQ worker via fake Ethereal SMTP will appear here with live preview links.
        </p>
        <button
          onClick={onOpenCompose}
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
        >
          Compose New Email
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[#121318] border border-zinc-800/80 rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-800/80 bg-zinc-900/50 text-zinc-400 uppercase tracking-wider text-[10px]">
              <th className="py-3 px-4 font-semibold">Recipient Email</th>
              <th className="py-3 px-4 font-semibold">Subject</th>
              <th className="py-3 px-4 font-semibold">Sender</th>
              <th className="py-3 px-4 font-semibold">Sent Time</th>
              <th className="py-3 px-4 font-semibold">Status</th>
              <th className="py-3 px-4 font-semibold text-right">Ethereal Preview</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
            {emails.map((email) => {
              const isSuccess = email.status === 'SENT';

              return (
                <tr
                  key={email.id}
                  className="hover:bg-zinc-800/30 transition-colors group"
                >
                  {/* Recipient */}
                  <td className="py-3.5 px-4 font-medium text-white flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isSuccess ? 'bg-emerald-400' : 'bg-red-400'
                      }`}
                    />
                    <span>{email.recipientEmail}</span>
                  </td>

                  {/* Subject */}
                  <td className="py-3.5 px-4 max-w-xs truncate text-zinc-200">
                    {email.subject}
                  </td>

                  {/* Sender */}
                  <td className="py-3.5 px-4 text-zinc-400 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-zinc-500" />
                    <span>{email.senderEmail}</span>
                  </td>

                  {/* Sent Time */}
                  <td className="py-3.5 px-4 text-zinc-400 font-mono text-[11px]">
                    {email.sentAt ? new Date(email.sentAt).toLocaleString() : '—'}
                  </td>

                  {/* Status */}
                  <td className="py-3.5 px-4">
                    {isSuccess ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>Sent</span>
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-red-500/10 border border-red-500/30 text-red-300"
                        title={email.errorMessage || 'Failed to deliver'}
                      >
                        <XCircle className="w-3 h-3 text-red-400" />
                        <span>Failed</span>
                      </span>
                    )}
                  </td>

                  {/* Ethereal Preview Action */}
                  <td className="py-3.5 px-4 text-right">
                    {email.etherealPreviewUrl ? (
                      <a
                        href={email.etherealPreviewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-indigo-600/20 border border-zinc-700/60 hover:border-indigo-500/50 text-indigo-400 hover:text-indigo-300 text-[11px] font-medium transition-all"
                      >
                        <span>View in Ethereal</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-zinc-600 text-[11px]">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
