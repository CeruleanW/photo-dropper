'use client';

import { useState } from 'react';
import { Plus, Download, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

interface PixivIntegrationProps {
  onImportSuccess?: () => void;
}

export default function PixivIntegration({ onImportSuccess }: PixivIntegrationProps) {
  const [artworkUrl, setArtworkUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState('');
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [pixivUserId, setPixivUserId] = useState('');
  const [importing, setImporting] = useState(false);

  const handleAddByUrl = async () => {
    if (!artworkUrl.trim()) {
      setMessage('Paste a Pixiv artwork URL');
      return;
    }

    setAdding(true);
    setMessage('');

    try {
      const res = await fetch('/api/integrations/pixiv/artwork', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: artworkUrl.trim() }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        if (data.skipped) {
          setMessage('Already added!');
        } else {
          setMessage(`Added: ${data.photo?.metadata?.title || 'artwork'}`);
          if (onImportSuccess) onImportSuccess();
        }
        setArtworkUrl('');
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch {
      setMessage('Failed to add artwork');
    } finally {
      setAdding(false);
    }
  };

  const handleBulkImport = async () => {
    if (!pixivUserId.trim()) {
      setMessage('Enter a Pixiv User ID');
      return;
    }

    setImporting(true);
    setMessage('Importing bookmarks...');

    try {
      const res = await fetch('/api/integrations/pixiv/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pixivUserId: pixivUserId.trim() }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        let msg = `Imported ${data.imported} of ${data.total} bookmarks`;
        if (data.skipped > 0) msg += ` (${data.skipped} existed)`;
        if (data.errors?.length > 0) {
          msg += ` — ${data.errors.length} errors`;
          console.error('Import errors:', data.errors);
        }
        setMessage(msg);
        if (data.imported > 0 && onImportSuccess) onImportSuccess();
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch {
      setMessage('Failed to import');
    } finally {
      setImporting(false);
    }
  };

  const handleClear = async () => {
    if (!confirm('Delete all Pixiv illustrations? This cannot be undone.')) return;
    setMessage('Clearing...');
    try {
      const res = await fetch('/api/integrations/pixiv/bookmarks', { method: 'DELETE' });
      const data = await res.json();
      setMessage(data.success ? `Cleared ${data.count} photos.` : `Error: ${data.error}`);
    } catch {
      setMessage('Failed to clear');
    }
  };

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      {/* Header */}
      <div className="flex items-center gap-3 w-full p-3 bg-pink-50 dark:bg-pink-900/20 rounded-lg">
        <div className="w-8 h-8 rounded-full bg-pink-100 dark:bg-pink-900/40 flex items-center justify-center text-pink-600 dark:text-pink-300 font-bold text-sm">
          P
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Pixiv</span>
          <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Add by URL</span>
        </div>
      </div>

      {/* Add by URL — primary action */}
      <div className="flex gap-2 w-full">
        <input
          type="text"
          value={artworkUrl}
          onChange={(e) => setArtworkUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddByUrl()}
          placeholder="https://www.pixiv.net/artworks/..."
          className="flex-1 px-3 py-2 text-sm border rounded-lg bg-transparent dark:border-zinc-600 dark:text-white"
          disabled={adding}
        />
        <button
          onClick={handleAddByUrl}
          disabled={adding || !artworkUrl.trim()}
          className="px-3 py-2 bg-pink-600 text-white rounded-lg text-sm font-medium hover:bg-pink-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 shadow-sm"
        >
          <Plus className={`w-4 h-4 ${adding ? 'animate-spin' : ''}`} />
          Add
        </button>
      </div>

      {/* Bulk import — collapsible */}
      <button
        onClick={() => setShowBulkImport(!showBulkImport)}
        className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors self-start"
      >
        {showBulkImport ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        Bulk import bookmarks
      </button>

      {showBulkImport && (
        <div className="flex flex-col gap-2 w-full pl-2 border-l-2 border-pink-200 dark:border-pink-800">
          <div className="flex gap-2">
            <input
              type="text"
              value={pixivUserId}
              onChange={(e) => setPixivUserId(e.target.value)}
              placeholder="Pixiv User ID"
              className="flex-1 px-3 py-1.5 text-xs border rounded-lg bg-transparent dark:border-zinc-600 dark:text-white"
              disabled={importing}
            />
            <button
              onClick={handleBulkImport}
              disabled={importing || !pixivUserId.trim()}
              className="px-3 py-1.5 bg-pink-600 text-white rounded-lg text-xs font-medium hover:bg-pink-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <Download className={`w-3 h-3 ${importing ? 'animate-bounce' : ''}`} />
              {importing ? 'Importing...' : 'Import All'}
            </button>
          </div>
          <button
            onClick={handleClear}
            className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-100 rounded-lg text-xs hover:bg-red-100 transition flex items-center justify-center gap-1"
          >
            <Trash2 className="w-3 h-3" />
            Clear Pixiv Storage
          </button>
        </div>
      )}

      {/* Status */}
      {adding && <p className="text-xs text-pink-500 animate-pulse">Fetching artwork...</p>}
      {message && !adding && <p className="text-xs text-gray-500">{message}</p>}
    </div>
  );
}
