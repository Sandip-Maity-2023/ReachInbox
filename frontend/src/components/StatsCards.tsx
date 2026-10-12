import React from 'react';
import type { EmailStats } from '../types';
import { Clock, CheckCircle2, AlertTriangle, Layers } from 'lucide-react';

interface StatsCardsProps {
  stats: EmailStats | null;
}

export const StatsCards: React.FC<StatsCardsProps> = ({ stats }) => {
  const cards = [
    {
      title: 'Scheduled Queue',
      value: stats?.db?.scheduled ?? 0,
      label: 'Jobs waiting to send',
      icon: Clock,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
    },
    {
      title: 'Sent Successfully',
      value: stats?.db?.sent ?? 0,
      label: 'Delivered via Ethereal SMTP',
      icon: CheckCircle2,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
    },
    {
      title: 'Rate-Limited & Delayed',
      value: stats?.db?.delayedRateLimited ?? 0,
      label: 'Rescheduled into next hour window',
      icon: AlertTriangle,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
    },
    {
      title: 'BullMQ Active Queue',
      value: (stats?.queue?.delayed ?? 0) + (stats?.queue?.waiting ?? 0) + (stats?.queue?.active ?? 0),
      label: `${stats?.queue?.delayed ?? 0} delayed • ${stats?.queue?.active ?? 0} active`,
      icon: Layers,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
      border: 'border-purple-500/20',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card, i) => {
        const Icon = card.icon;
        return (
          <div
            key={i}
            className="p-4 rounded-xl bg-[#121318] border border-zinc-800/80 hover:border-zinc-700/80 transition-all flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-zinc-400">{card.title}</span>
              <div className={`p-2 rounded-lg ${card.bg} ${card.border} border`}>
                <Icon className={`w-4 h-4 ${card.color}`} />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white tracking-tight">
                {card.value.toLocaleString()}
              </div>
              <p className="text-[11px] text-zinc-400 mt-1">{card.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};
