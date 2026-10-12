import React from 'react';
import { Search, X, Zap } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  searchSource?: string | null;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  placeholder = 'Search by recipient, subject, sender, or content...',
  searchSource,
}) => {
  return (
    <div className="relative flex items-center mb-4">
      <div className="absolute left-3.5 text-zinc-500 pointer-events-none">
        <Search className="w-4 h-4" />
      </div>

      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#121318] border border-zinc-800 rounded-xl pl-10 pr-32 py-2.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/50 transition-all"
      />

      <div className="absolute right-3 flex items-center gap-2">
        {value && (
          <button
            onClick={() => onChange('')}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            title="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-800/80 border border-zinc-700/50 text-[10px] text-zinc-400 font-mono">
          <Zap className="w-2.5 h-2.5 text-amber-400" />
          <span>{searchSource === 'elasticsearch' ? 'Elasticsearch' : 'Fast Search'}</span>
        </div>
      </div>
    </div>
  );
};

