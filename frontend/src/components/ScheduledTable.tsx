import React from 'react';
import type { EmailJob } from '../types';
import { Clock, AlertCircle, Ban, Calendar, UserCheck } from 'lucide-react';

interface ScheduledTableProps {
  emails: EmailJob[];
  loading: boolean;
  onCancel: (id: string) => void;
  onOpenCompose: () => void;
}

export const ScheduledTable: React.FC<ScheduledTableProps> = ({
  emails,
  loading,
  onCancel,
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
          <Calendar className="w-6 h-6 text-zinc-500" />
        </div>
        <h3 className="text-sm font-semibold text-zinc-200 mb-1">No scheduled emails found</h3>
        <p className="text-xs text-zinc-400 max-w-sm mb-4">
          You don't have any pending emails in the scheduler queue. Compose a new campaign to get started.
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
              <th className="py-3 px-4 font-semibold">Scheduled Time</th>
              <th className="py-3 px-4 font-semibold">Status</th>
              <th className="py-3 px-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
            {emails.map((email) => {
              const isRateLimited = email.status === 'DELAYED_RATE_LIMITED';
              const isProcessing = email.status === 'PROCESSING';

              return (
                <tr
                  key={email.id}
                  className="hover:bg-zinc-800/30 transition-colors group"
                >
                  {/* Recipient */}
                  <td className="py-3.5 px-4 font-medium text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-400" />
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

                  {/* Scheduled Time */}
                  <td className="py-3.5 px-4 text-zinc-300 font-mono text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-zinc-500" />
                      <span>{new Date(email.scheduledAt).toLocaleString()}</span>
                    </div>
                  </td>

                  {/* Status Badge */}
                  <td className="py-3.5 px-4">
                    {isRateLimited ? (
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-300"
                        title="Rate limit hit: Rescheduled into next available hour window"
                      >
                        <AlertCircle className="w-3 h-3 text-amber-400 animate-pulse" />
                        <span>Rate Limited (Next Window)</span>
                      </span>
                    ) : isProcessing ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-blue-500/10 border border-blue-500/30 text-blue-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
                        <span>Processing</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-zinc-800 border border-zinc-700 text-zinc-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                        <span>Scheduled</span>
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => onCancel(email.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 text-[11px] font-medium transition-all"
                      title="Cancel scheduled job"
                    >
                      <Ban className="w-3 h-3" />
                      <span>Cancel</span>
                    </button>
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
