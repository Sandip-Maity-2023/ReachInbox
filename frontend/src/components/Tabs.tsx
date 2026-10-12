import React from 'react';
import { Plus, Clock, Send, RefreshCw } from 'lucide-react';

interface TabsProps {
  activeTab: 'scheduled' | 'sent';
  onTabChange: (tab: 'scheduled' | 'sent') => void;
  onOpenCompose: () => void;
  onRefresh: () => void;
  scheduledCount: number;
  sentCount: number;
  loading: boolean;
}

export const Tabs: React.FC<TabsProps> = ({
  activeTab,
  onTabChange,
  onOpenCompose,
  onRefresh,
  scheduledCount,
  sentCount,
  loading,
}) => {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-5">
      {/* Tab Selectors */}
      <div className="flex items-center gap-1.5 p-1 bg-zinc-900/90 border border-zinc-800 rounded-xl">
        <button
          onClick={() => onTabChange('scheduled')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'scheduled'
              ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700/60'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Scheduled Emails</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              activeTab === 'scheduled'
                ? 'bg-blue-500/20 text-blue-300'
                : 'bg-zinc-800 text-zinc-400'
            }`}
          >
            {scheduledCount}
          </span>
        </button>

        <button
          onClick={() => onTabChange('sent')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'sent'
              ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700/60'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
          }`}
        >
          <Send className="w-3.5 h-3.5" />
          <span>Sent Emails</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              activeTab === 'sent'
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'bg-zinc-800 text-zinc-400'
            }`}
          >
            {sentCount}
          </span>
        </button>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors disabled:opacity-50"
          title="Refresh Data"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>

        <button
          onClick={onOpenCompose}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-medium text-xs shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Compose New Email</span>
        </button>
      </div>
    </div>
  );
};

