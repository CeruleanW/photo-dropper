'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import { useState, useRef } from 'react';

export default function GooglePhotosIntegration() {
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
          setMessage(`Successfully imported ${data.count} photos!`);

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
    <div className="flex flex-col items-center gap-2 p-4 border rounded-lg bg-white dark:bg-zinc-900 shadow-sm w-full">
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          {session.user?.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={session.user.image} alt={session.user.name || 'User'} className="w-8 h-8 rounded-full" />
          )}
          <span className="text-sm font-medium">{session.user?.name}</span>
        </div>
        <button onClick={() => signOut()} className="text-xs text-red-500 hover:underline">
          Sign out
        </button>
      </div>

      <div className="flex items-center gap-2 w-full mt-2">
        <button
          onClick={handleImport}
          disabled={importing}
          className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 transition disabled:opacity-50"
        >
          {importing ? 'Importing...' : 'Import from Google Photos'}
        </button>
      </div>
      {importing && <p className="text-xs text-blue-500 mt-1 animate-pulse">Please select photos in the popup window...</p>}
      {message && !importing && <p className="text-xs text-gray-500 mt-1">{message}</p>}
    </div>
  );
}
