'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Controls from './Controls';
import MetadataEditor from './MetadataEditor';
import UgoiraPlayer from './UgoiraPlayer';
import { Photo } from '@/types';

// Pixiv images need to be proxied server-side due to hotlink protection
function getProxiedPixivUrl(url: string): string {
  if (url.includes('pximg.net') || url.includes('ugoira.com')) {
    return `/api/proxy/image?url=${encodeURIComponent(url)}`;
  }
  return url;
}

function getImageUrl(photo: Photo): string {
  if (photo.source === 'PIXIV') {
    return getProxiedPixivUrl(photo.url);
  }
  return photo.url;
}

import { PhotoFilters } from './FilterBar';

interface PhotoViewerProps {
  searchQuery?: string;
  refreshTrigger?: number;
  filters?: PhotoFilters;
}

export default function PhotoViewer({ searchQuery, refreshTrigger, filters }: PhotoViewerProps) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  const [imgLoading, setImgLoading] = useState(true);
  const [likedPhotos, setLikedPhotos] = useState<Set<string>>(new Set());
  const [favoritedPhotos, setFavoritedPhotos] = useState<Set<string>>(new Set());

  const currentPhoto = photos[currentIndex];

  // Reset image states when photo changes
  useEffect(() => {
    setImgError(false);
    setImgLoading(true);
  }, [currentIndex]);

  // Lazily resolve Pixiv high-res URL when a photo is displayed
  useEffect(() => {
    if (!currentPhoto) return;
    if (currentPhoto.source !== 'PIXIV') return;
    // Skip resolve if already resolved AND we know the type.
    // Re-resolve if illustType is unknown (old import that may be ugoira resolved with broken logic).
    if (currentPhoto.metadata?.resolved && currentPhoto.metadata?.illustType !== undefined) return;

    // Resolve in background — thumbnail shows immediately via proxy
    (async () => {
      try {
        const res = await fetch(`/api/integrations/pixiv/resolve?id=${currentPhoto._id}`);
        const data = await res.json();
        if (data.success && data.url) {
          // Update the photo in state with the resolved high-res URL, pages, and ugoira data
          setPhotos(prev => prev.map(p =>
            p._id === currentPhoto._id
              ? {
                ...p,
                url: data.url,
                metadata: {
                  ...p.metadata,
                  resolved: true,
                  ...(data.illustType !== undefined ? { illustType: data.illustType } : {}),
                  ...(data.pages ? { pages: data.pages } : {}),
                  ...(data.ugoiraZipUrl ? {
                    ugoiraZipUrl: data.ugoiraZipUrl,
                    ugoiraFrames: data.ugoiraFrames,
                  } : {}),
                },
              }
              : p
          ));
        }
      } catch {
        // Thumbnail still works, silent fail
      }
    })();
  }, [currentPhoto]);

  // Listen for refresh trigger
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      setPhotos([]); // Clear to show loading
      setCurrentIndex(0);
      // fetchPhotos will be called by the next useEffect/logic because photos is empty? 
      // No, current logic is "if photos.length === 0 { fetch() }" in a distinct useEffect.
      // Let's rely on that existing effect. By setting photos to [], it should trigger it.
    }
  }, [refreshTrigger]);

  // Reset photos when searchQuery or filters change
  useEffect(() => {
    setPhotos([]);
    setCurrentIndex(0);
    setHasMore(true);
  }, [searchQuery, filters?.source, filters?.tags]);
  const [hasMore, setHasMore] = useState(true);

  const fetchPhotos = useCallback(async (count = 25): Promise<number> => {
    setLoading(true);
    setError(null);
    let newCount = 0;
    try {
      let url: string;
      // Build filter query params
      const filterParams = new URLSearchParams();
      if (filters?.source) filterParams.set('source', filters.source);
      if (filters?.tags?.length) filterParams.set('tags', filters.tags.join(','));
      const filterSuffix = filterParams.toString() ? `&${filterParams.toString()}` : '';

      if (searchQuery) {
        url = `/api/photos/search?q=${encodeURIComponent(searchQuery)}&limit=${count}${filterSuffix}`;
      } else {
        url = `/api/photos/next?count=${count}${filterSuffix}`;
      }

      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch photos');
      const data = await res.json();

      setPhotos(prev => {
        if ((searchQuery || (refreshTrigger && refreshTrigger > 0)) && prev.length === 0) {
          newCount = data.photos.length;
          return data.photos;
        }
        const existingIds = new Set(prev.map(p => p._id));
        const newPhotos = data.photos.filter((p: Photo) => !existingIds.has(p._id));
        newCount = newPhotos.length;
        if (newPhotos.length === 0) {
          setHasMore(false);
        }
        return [...prev, ...newPhotos];
      });

      // Seed like/favorite state from persisted data
      const fetchedPhotos = data.photos as Photo[];
      setLikedPhotos(prev => {
        const next = new Set(prev);
        fetchedPhotos.forEach((p: Photo) => {
          if (p.isLiked) next.add(p._id);
        });
        return next;
      });
      setFavoritedPhotos(prev => {
        const next = new Set(prev);
        fetchedPhotos.forEach((p: Photo) => {
          if (p.isFavorited) next.add(p._id);
        });
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
    return newCount;
  }, [searchQuery, refreshTrigger, filters]);

  // Initial fetch when photos array is empty
  useEffect(() => {
    if (photos.length === 0 && !loading && !error) {
      fetchPhotos();
    }
  }, [photos.length, loading, error, fetchPhotos]);




  // ... rest of component

  // ... rest of component

  const handleNext = async () => {
    if (photos.length === 0) return;
    if (currentIndex < photos.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else if (hasMore) {
      // Try to fetch more photos
      const added = await fetchPhotos();
      if (added > 0) {
        setCurrentIndex(prev => prev + 1);
      } else {
        // No new photos, wrap around
        setCurrentIndex(0);
      }
    } else {
      // Already know there are no more, wrap around
      setCurrentIndex(0);
    }
  };

  const handleInteraction = async (type: string) => {
    if (!currentPhoto) return;

    // Optimistic UI updates could happen here
    console.log(`User interaction: ${type} on photo ${currentPhoto._id}`);

    try {
      await fetch('/api/photos/interaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          photoId: currentPhoto._id,
          type,
        }),
      });
    } catch (err) {
      console.error('Failed to record interaction', err);
    }

    // Toggle like/favorite state
    if (type === 'LIKE') {
      setLikedPhotos(prev => {
        const next = new Set(prev);
        if (next.has(currentPhoto._id)) {
          next.delete(currentPhoto._id);
        } else {
          next.add(currentPhoto._id);
        }
        return next;
      });
    }
    if (type === 'FAVORITE') {
      setFavoritedPhotos(prev => {
        const next = new Set(prev);
        if (next.has(currentPhoto._id)) {
          next.delete(currentPhoto._id);
        } else {
          next.add(currentPhoto._id);
        }
        return next;
      });
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
      <div className="flex flex-col items-center justify-center h-96 gap-4 text-center">
        {loading ? (
          <p className="text-lg animate-pulse text-gray-500">Loading photos...</p>
        ) : (
          <>
            <div className="p-4 bg-gray-100 dark:bg-zinc-800 rounded-full mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></svg>
            </div>
            <p className="text-lg text-gray-500 dark:text-gray-400">No photos found.</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 max-w-xs">
              {searchQuery ? `No matches for "${searchQuery}"` : "Try importing photos from Google or check back later."}
            </p>
            <button
              onClick={() => fetchPhotos()}
              className="mt-2 px-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition flex items-center gap-2"
            >
              Next
            </button>
          </>
        )}
      </div>
    );
  }



  // ... (existing code)

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-5xl mx-auto gap-6 px-4">
      <div className="relative w-full min-h-[300px] max-h-[80vh] bg-gray-100 dark:bg-zinc-800 rounded-2xl overflow-y-auto overflow-x-hidden shadow-2xl ring-1 ring-black/5 dark:ring-white/10 group">

        {/* Loading spinner */}
        {imgLoading && !imgError && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-gray-100/80 dark:bg-zinc-800/80">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-blue-200 dark:border-blue-800 border-t-blue-500 dark:border-t-blue-400 rounded-full animate-spin" />
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Loading...</p>
            </div>
          </div>
        )}

        {imgError ? (
          <div className="flex flex-col items-center gap-3 text-red-500 p-8 text-center bg-white/80 dark:bg-zinc-900/80 rounded-xl backdrop-blur-sm shadow-sm border border-red-100 dark:border-red-900/30 m-8">
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
          <div className="w-full">
            {/* Ugoira (animated Pixiv artwork) */}
            {currentPhoto.metadata?.ugoiraZipUrl && currentPhoto.metadata?.ugoiraFrames ? (
              <UgoiraPlayer
                zipUrl={getProxiedPixivUrl(currentPhoto.metadata.ugoiraZipUrl)}
                frames={currentPhoto.metadata.ugoiraFrames}
                onLoad={() => setImgLoading(false)}
                onError={() => { setImgError(true); setImgLoading(false); }}
              />
            ) : currentPhoto.source === 'PIXIV' && currentPhoto.metadata?.pages?.length > 1 ? (
              currentPhoto.metadata!.pages.map((pageUrl: string, idx: number) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  key={idx}
                  src={getProxiedPixivUrl(pageUrl)}
                  alt={`${currentPhoto.metadata?.title || 'Artwork'} — page ${idx + 1}`}
                  className={`w-full h-auto transition-opacity duration-500 ${imgLoading && idx === 0 ? 'opacity-0' : 'opacity-100'}`}
                  onLoad={() => { if (idx === 0) setImgLoading(false); }}
                  onError={() => { if (idx === 0) { setImgError(true); setImgLoading(false); } }}
                />
              ))
            ) : currentPhoto.metadata?.productUrl ? (
              <a
                href={currentPhoto.metadata.productUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full cursor-pointer"
                title="Open in Google Photos"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getImageUrl(currentPhoto)}
                  alt={currentPhoto.metadata?.prompt || 'Photo'}
                  className={`w-full h-auto transition-opacity duration-500 ${imgLoading ? 'opacity-0' : 'opacity-100'}`}
                  onLoad={() => setImgLoading(false)}
                  onError={() => { setImgError(true); setImgLoading(false); }}
                />
              </a>
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={getImageUrl(currentPhoto)}
                alt={currentPhoto.metadata?.prompt || 'Photo'}
                className={`w-full h-auto transition-opacity duration-500 ${imgLoading ? 'opacity-0' : 'opacity-100'}`}
                onLoad={() => setImgLoading(false)}
                onError={() => { setImgError(true); setImgLoading(false); }}
              />
            )}
          </div>
        )}

        {/* Info Overlay */}
        <div className="absolute top-4 left-4 flex items-center gap-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
          <div className="bg-black/60 text-white text-xs font-mono px-3 py-1.5 rounded-full backdrop-blur-md">
            {currentIndex + 1} / {photos.length}
          </div>
          {currentPhoto.source === 'PIXIV' && currentPhoto.metadata?.pages?.length > 1 && (
            <div className="bg-pink-600/80 text-white text-xs font-medium px-2.5 py-1.5 rounded-full backdrop-blur-md">
              {currentPhoto.metadata!.pages.length} pages
            </div>
          )}
        </div>

        {/* Open original link */}
        {currentPhoto.metadata?.pixivUrl && (
          <a
            href={currentPhoto.metadata.pixivUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute top-4 right-4 bg-black/60 hover:bg-black/80 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-md z-20 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center gap-1.5 cursor-pointer"
            title="Open on Pixiv"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            Pixiv
          </a>
        )}
      </div>

      <Controls
        onLike={() => handleInteraction('LIKE')}
        onDislike={() => handleInteraction('DISLIKE')}
        onFavorite={() => handleInteraction('FAVORITE')}
        onPrev={() => {
          if (photos.length === 0) return;
          if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
          } else {
            setCurrentIndex(photos.length - 1);
          }
        }}
        onNext={handleNext}
        disabled={loading && photos.length === 0}
        isLiked={currentPhoto ? likedPhotos.has(currentPhoto._id) : false}
        isFavorited={currentPhoto ? favoritedPhotos.has(currentPhoto._id) : false}
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
