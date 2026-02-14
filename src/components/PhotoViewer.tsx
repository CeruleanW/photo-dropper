'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Controls from './Controls';
import MetadataEditor from './MetadataEditor';
import { Photo } from '@/types';

export default function PhotoViewer() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);

  // Reset image error when photo changes
  useEffect(() => {
    setImgError(false);
  }, [currentIndex]);

  const fetchPhotos = useCallback(async (count = 10) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/photos/next?count=${count}`);
      if (!res.ok) throw new Error('Failed to fetch photos');
      const data = await res.json();

      // Filter out duplicates if needed, or just append
      // For now, replacing the list if empty, or appending if near end?
      // Simple strategy: If list is empty, set it. If appending, add to end.
      setPhotos(prev => {
        // Simple distinct check by ID
        const existingIds = new Set(prev.map(p => p._id));
        const newPhotos = data.photos.filter((p: Photo) => !existingIds.has(p._id));
        return [...prev, ...newPhotos];
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    // Only fetch if we have no photos
    if (photos.length === 0) {
      fetchPhotos();
    }
  }, [fetchPhotos, photos.length]);

  const currentPhoto = photos[currentIndex];

  const handleNext = () => {
    if (currentIndex < photos.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      // Reached end, fetch more
      fetchPhotos();
    }
  };

  const handleInteraction = async (type: string) => {
    if (!currentPhoto) return;

    // Optimistic UI updates could happen here
    console.log(`User interaction: ${type} on photo ${currentPhoto._id}`);

    // Call API to record interaction
    // Note: We need a userId. For now, we'll use a dummy ID or generate one if not auth'd.
    // In a real app, get from session.
    const dummyUserId = '507f1f77bcf86cd799439011'; // Mock ObjectId

    try {
      await fetch('/api/photos/interaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: dummyUserId,
          photoId: currentPhoto._id,
          type,
        }),
      });
    } catch (err) {
      console.error('Failed to record interaction', err);
    }

    // Move to next photo automatically on some actions
    if (type === 'SKIP' || type === 'DISLIKE') {
      handleNext();
    }
  };

  // Record VIEW when a new photo is displayed
  useEffect(() => {
    if (currentPhoto) {
      // Small delay to ensure it's actually viewed? Or just record immediately.
      handleInteraction('VIEW');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPhoto?._id]); // Only trigger when photo ID changes

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-red-500">
        <p>Error: {error}</p>
        <button
          onClick={() => fetchPhotos()}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!currentPhoto) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        {loading ? (
          <p className="text-lg animate-pulse">Loading photos...</p>
        ) : (
          <div className="text-center">
            <p className="text-lg text-gray-500 mb-4">No photos found.</p>
            <button
              onClick={() => fetch('/api/seed', { method: 'POST' }).then(() => fetchPhotos())}
              className="px-6 py-3 bg-green-600 text-white rounded-lg shadow hover:bg-green-700 transition"
            >
              Seed Database with Sample Photos
            </button>
          </div>
        )}
      </div>
    );
  }



  // ... (existing code)

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-5xl mx-auto gap-6 px-4">
      <div className="relative w-full aspect-[4/3] md:aspect-[16/9] bg-gray-100 dark:bg-zinc-800 rounded-2xl overflow-hidden shadow-2xl ring-1 ring-black/5 dark:ring-white/10 flex items-center justify-center group">

        {/* Background Blur for Ambience */}
        {currentPhoto && !imgError && (
          <div className="absolute inset-0 z-0">
            <Image
              src={currentPhoto.url}
              alt=""
              fill
              className="object-cover blur-3xl opacity-50 scale-110"
              unoptimized
            />
            <div className="absolute inset-0 bg-white/30 dark:bg-black/30 backdrop-blur-md" />
          </div>
        )}

        {imgError ? (
          <div className="relative z-10 flex flex-col items-center gap-3 text-red-500 p-8 text-center bg-white/80 dark:bg-zinc-900/80 rounded-xl backdrop-blur-sm shadow-sm border border-red-100 dark:border-red-900/30">
            <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-full">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></svg>
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-gray-100">Failed to load image</p>
              <p className="text-xs text-gray-500 mt-1 max-w-xs truncate">{currentPhoto.url}</p>
            </div>
            <button
              onClick={() => handleNext()}
              className="mt-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              Skip to next photo
            </button>
          </div>
        ) : (
          <div className="relative z-10 w-full h-full p-4 transition-all duration-500 ease-in-out">
            <Image
              src={currentPhoto.url}
              alt={currentPhoto.metadata?.prompt || 'Photo'}
              fill
              className={`object-contain transition-opacity duration-500 ${loading ? 'opacity-50 scale-95' : 'opacity-100 scale-100'}`}
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
              priority
              onError={() => setImgError(true)}
            />
          </div>
        )}

        {/* Info Overlay */}
        <div className="absolute top-4 left-4 bg-black/60 text-white text-xs font-mono px-3 py-1.5 rounded-full backdrop-blur-md z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
          {currentIndex + 1} / {photos.length}
        </div>
      </div>

      <Controls
        onLike={() => handleInteraction('LIKE')}
        onDislike={() => handleInteraction('DISLIKE')}
        onSkip={() => handleInteraction('SKIP')}
        onFavorite={() => handleInteraction('FAVORITE')}
        onNext={handleNext}
        disabled={loading && photos.length === 0}
      />

      {currentPhoto && (
        <MetadataEditor
          photo={currentPhoto}
          onUpdate={(updatedPhoto: Photo) => {
            // Update local state to reflect changes (e.g. tags)
            setPhotos(prev => prev.map(p => p._id === updatedPhoto._id ? updatedPhoto : p));
          }}
        />
      )}

      {loading && photos.length > 0 && <p className="text-sm text-gray-400">Fetching more...</p>}
    </div>
  );
}
