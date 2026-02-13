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

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-4xl mx-auto p-4 gap-6">
      <div className="relative w-full aspect-[4/3] bg-black/5 rounded-2xl overflow-hidden shadow-2xl ring-1 ring-black/10 dark:ring-white/10">
        <Image
          src={currentPhoto.url}
          alt={currentPhoto.metadata?.prompt || 'Photo'}
          fill
          className="object-contain" // Contain to see full image, or cover for aesthetics? "Photo Picker" usually implies seeing the whole photo.
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
          priority
        />
        {/* Helper overlay for debug/dev */}
        <div className="absolute top-4 left-4 bg-black/50 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
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
