'use client';

import { useState, useEffect } from 'react';
import { Filter, X } from 'lucide-react';

export interface PhotoFilters {
  source?: string;
  tags: string[];
}

interface FilterBarProps {
  filters: PhotoFilters;
  onChange: (filters: PhotoFilters) => void;
}

const SOURCE_LABELS: Record<string, string> = {
  PIXIV: 'Pixiv',
  GOOGLE: 'Google Photos',
  LOCAL: 'Local',
  ICLOUD: 'iCloud',
};

const SOURCE_COLORS: Record<string, string> = {
  PIXIV: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-300/40 dark:border-blue-600/40',
  GOOGLE: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300/40 dark:border-emerald-600/40',
  LOCAL: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300/40 dark:border-amber-600/40',
  ICLOUD: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-300/40 dark:border-purple-600/40',
};

const SOURCE_ACTIVE_COLORS: Record<string, string> = {
  PIXIV: 'bg-blue-500 text-white border-blue-500 shadow-blue-500/30',
  GOOGLE: 'bg-emerald-500 text-white border-emerald-500 shadow-emerald-500/30',
  LOCAL: 'bg-amber-500 text-white border-amber-500 shadow-amber-500/30',
  ICLOUD: 'bg-purple-500 text-white border-purple-500 shadow-purple-500/30',
};

export default function FilterBar({ filters, onChange }: FilterBarProps) {
  const [availableSources, setAvailableSources] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [showTags, setShowTags] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch available filters on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/photos/filters');
        if (res.ok) {
          const data = await res.json();
          setAvailableSources(data.sources || []);
          setAvailableTags(data.tags || []);
        }
      } catch {
        // Silently fail — filters just won't populate
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const hasActiveFilters = filters.source || filters.tags.length > 0;

  const toggleSource = (src: string) => {
    onChange({
      ...filters,
      source: filters.source === src ? undefined : src,
    });
  };

  const toggleTag = (tag: string) => {
    const newTags = filters.tags.includes(tag)
      ? filters.tags.filter(t => t !== tag)
      : [...filters.tags, tag];
    onChange({ ...filters, tags: newTags });
  };

  const clearAll = () => {
    onChange({ source: undefined, tags: [] });
  };

  if (loading) return null;
  if (availableSources.length === 0 && availableTags.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {/* Source filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />

        {availableSources.map(src => {
          const isActive = filters.source === src;
          return (
            <button
              key={src}
              onClick={() => toggleSource(src)}
              className={`
                px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200
                hover:scale-105 active:scale-95 cursor-pointer
                ${isActive
                  ? `${SOURCE_ACTIVE_COLORS[src] || 'bg-gray-500 text-white border-gray-500'} shadow-lg`
                  : `${SOURCE_COLORS[src] || 'bg-gray-100 text-gray-600 border-gray-200'} hover:shadow-md`
                }
              `}
            >
              {SOURCE_LABELS[src] || src}
            </button>
          );
        })}

        {availableTags.length > 0 && (
          <>
            <div className="h-5 w-px bg-gray-200 dark:bg-zinc-700 mx-1" />
            <button
              onClick={() => setShowTags(!showTags)}
              className={`
                px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200
                hover:scale-105 active:scale-95 cursor-pointer
                ${showTags || filters.tags.length > 0
                  ? 'bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-300/40 dark:border-pink-600/40'
                  : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-zinc-700'
                }
              `}
            >
              Tags{filters.tags.length > 0 ? ` (${filters.tags.length})` : ''}
            </button>
          </>
        )}

        {hasActiveFilters && (
          <button
            onClick={clearAll}
            className="ml-auto px-2.5 py-1.5 rounded-full text-xs font-medium text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors flex items-center gap-1 cursor-pointer"
            title="Clear all filters"
          >
            <X className="w-3.5 h-3.5" />
            Clear
          </button>
        )}
      </div>

      {/* Tag pills (expandable) */}
      {(showTags || filters.tags.length > 0) && availableTags.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap pl-6">
          {availableTags.slice(0, 50).map(tag => {
            const isActive = filters.tags.includes(tag);
            return (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`
                  px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all duration-200
                  hover:scale-105 active:scale-95 cursor-pointer
                  ${isActive
                    ? 'bg-pink-500 text-white border-pink-500 shadow-md shadow-pink-500/20'
                    : 'bg-gray-50 dark:bg-zinc-800/60 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-zinc-700 hover:border-pink-300 dark:hover:border-pink-600 hover:text-pink-600 dark:hover:text-pink-400'
                  }
                `}
              >
                {tag}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
