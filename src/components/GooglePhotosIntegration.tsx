'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import { useState, useRef } from 'react';
import { Download, Trash2, LogOut } from 'lucide-react';

interface GooglePhotosIntegrationProps {
  onImportSuccess?: () => void;
}

export default function GooglePhotosIntegration({ onImportSuccess }: GooglePhotosIntegrationProps) {
  const { data: session } = useSession();
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState('');
  const [pickerWindow, setPickerWindow] = useState<Window | null>(null);
  const pollTimer = useRef<NodeJS.Timeout | null>(null);

  const startPolling = (sessionId: string) => {
    if (pollTimer.current) clearInterval(pollTimer.current);

    pollTimer.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/integrations/google/picker?sessionId=${sessionId}`);
        const data = await res.json();

        if (data.success && data.mediaItemsSet) {
          // Import finished
          if (pollTimer.current) clearInterval(pollTimer.current);
          setImporting(false);

          let msg = `Successfully imported ${data.count} photos!`;
          if (data.errors && data.errors.length > 0) {
            console.error('Import errors:', data.errors);
            msg += ` (${data.errors.length} failed - see console)`;
            if (data.count === 0) {
              msg = `Import failed. ${data.errors[0]}`;
            }
          }
          setMessage(msg);

          if (data.count > 0 && onImportSuccess) {
            onImportSuccess(); // Trigger parent refresh
          }

          // Helper to close window if it's still open
          if (pickerWindow && !pickerWindow.closed) {
            pickerWindow.close();
          }
        } else if (data.error) {
          console.error('Polling error:', data.error);
          // Optional: stop polling on error?
        }
      } catch (error) {
        console.error('Polling failed', error);
      }
    }, 2000); // Poll every 2 seconds
  };

  const handleImport = async () => {
    setImporting(true);
    setMessage('Opening Google Photos...');

    try {
      // 1. Create Session
      const res = await fetch('/api/integrations/google/picker', { method: 'POST' });
      const data = await res.json();

      if (data.success && data.session) {
        const { id: sessionId, pickerUri } = data.session;

        // 2. Open Picker
        // We append /autoclose to let Google handle closing, but we also poll.
        // Google docs say: "For web-based applications, you can append /autoclose... 
        // The Google Photos window or tab will then close automatically after the user has finished picking"
        // Wait, if it auto-closes, we purely rely on polling to know it's done. 
        // pickerUri likely already has some parameters, so we check carefully.
        // Actually the docs say "pickerUri" is the full URI. 
        // Let's just open it.
        const win = window.open(pickerUri, '_blank', 'width=800,height=600');
        setPickerWindow(win);
        setMessage('Waiting for you to select photos...');

        // 3. Start Polling
        startPolling(sessionId);

      } else {
        setImporting(false);
        setMessage(`Error starting import: ${data.error}`);
      }
    } catch (error) {
      setImporting(false);
      setMessage('Failed to start import');
      console.error(error);
    }
  };

  if (!session) {
    return (
      <div className="flex flex-col items-center gap-2 p-4 border rounded-lg bg-white dark:bg-zinc-900 shadow-sm">
        <p className="text-sm text-gray-500">Connect Google Photos to see your memories.</p>
        <button
          onClick={() => signIn('google')}
          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition"
        >
          Connect Google Photos
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <div className="flex items-center justify-between w-full p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-lg">
        <div className="flex items-center gap-3">
          {session.user?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={session.user.image} alt={session.user.name || 'User'} className="w-8 h-8 rounded-full ring-2 ring-white dark:ring-zinc-700" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 font-bold">
              {session.user?.name?.[0] || 'U'}
            </div>
          )}
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{session.user?.name}</span>
            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Connected</span>
          </div>
        </div>
        <button
          onClick={() => signOut()}
          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors group"
          title="Sign out"
        >
          <LogOut className="w-4 h-4 group-hover:scale-110 transition-transform" />
        </button>
      </div>

      <div className="flex flex-col gap-2 w-full mt-2">

        <button
          onClick={handleImport}
          disabled={importing}
          className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
        >
          <Download className={`w-4 h-4 ${importing ? 'animate-bounce' : ''}`} />
          {importing ? 'Importing...' : 'Import Selected Photos'}
        </button>

        <button
          onClick={async () => {
            if (!confirm('Are you sure you want to delete all imported Google Photos from your local storage? This cannot be undone.')) return;

            setMessage('Clearing storage...');
            try {
              const res = await fetch('/api/integrations/google/clear', { method: 'DELETE' });
              const data = await res.json();
              if (data.success) {
                setMessage(`Cleared ${data.count} photos.`);
              } else {
                setMessage(`Error: ${data.error}`);
              }
            } catch (err) {
              setMessage('Failed to clear storage');
              console.error(err);
            }
          }}
          className="w-full px-4 py-2 bg-red-50 text-red-600 border border-red-100 rounded-lg text-xs font-medium hover:bg-red-100 hover:text-red-700 transition flex items-center justify-center gap-2"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clear Imported Storage
        </button>
      </div>
      {importing && <p className="text-xs text-blue-500 mt-1 animate-pulse">Please select photos in the popup window...</p>}
      {message && !importing && <p className="text-xs text-gray-500 mt-1">{message}</p>}
    </div>
  );
}
