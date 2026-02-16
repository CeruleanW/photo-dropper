'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface UgoiraFrame {
  file: string;
  delay: number;
}

interface UgoiraPlayerProps {
  zipUrl: string;
  frames: UgoiraFrame[];
  onLoad?: () => void;
  onError?: () => void;
}

/**
 * Extract files from a ZIP archive using only browser-native APIs.
 * Handles the local file header format (no dependency on fflate/JSZip).
 *
 * ZIP local file header layout:
 *   0..3  : signature (0x04034b50)
 *   4..5  : version needed
 *   6..7  : flags
 *   8..9  : compression method (0 = stored, 8 = deflate)
 *  10..11 : mod time
 *  12..13 : mod date
 *  14..17 : crc32
 *  18..21 : compressed size
 *  22..25 : uncompressed size
 *  26..27 : filename length
 *  28..29 : extra field length
 *  30..   : filename, extra field, data
 */
async function extractZip(buffer: ArrayBuffer): Promise<Map<string, Blob>> {
  const view = new DataView(buffer);
  const files = new Map<string, Blob>();
  let offset = 0;

  while (offset < buffer.byteLength - 4) {
    const sig = view.getUint32(offset, true);
    if (sig !== 0x04034b50) break; // not a local file header

    const compression = view.getUint16(offset + 8, true);
    const flags = view.getUint16(offset + 6, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const filenameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);

    const filenameBytes = new Uint8Array(buffer, offset + 30, filenameLen);
    const filename = new TextDecoder().decode(filenameBytes);

    const dataOffset = offset + 30 + filenameLen + extraLen;
    const compressedData = new Uint8Array(buffer, dataOffset, compressedSize);

    if (compression === 0) {
      // Stored (no compression)
      files.set(filename, new Blob([compressedData]));
    } else if (compression === 8) {
      // Deflate — use browser's DecompressionStream
      try {
        const ds = new DecompressionStream('deflate-raw');
        const writer = ds.writable.getWriter();
        const reader = ds.readable.getReader();

        // Write and close in parallel
        writer.write(compressedData).then(() => writer.close());

        const chunks: Uint8Array[] = [];
        let totalLen = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          totalLen += value.length;
        }

        const decompressed = new Uint8Array(totalLen);
        let pos = 0;
        for (const chunk of chunks) {
          decompressed.set(chunk, pos);
          pos += chunk.length;
        }
        files.set(filename, new Blob([decompressed]));
      } catch {
        // If decompression fails, skip this file
        console.warn(`Failed to decompress ${filename}`);
      }
    }

    offset = dataOffset + compressedSize;
    // Handle data descriptor if bit 3 of flags is set
    if (flags & 0x08) {
      // Data descriptor follows: may have optional signature + crc32 + sizes
      if (offset + 4 <= buffer.byteLength && view.getUint32(offset, true) === 0x08074b50) {
        offset += 16; // signature(4) + crc32(4) + compressed(4) + uncompressed(4)
      } else {
        offset += 12; // crc32(4) + compressed(4) + uncompressed(4)
      }
    }
  }

  return files;
}

/**
 * Renders a Pixiv ugoira (animated illustration) using canvas.
 * Fetches the ZIP of frame images, extracts them, and cycles through
 * them respecting the per-frame delay timings.
 */
export default function UgoiraPlayer({ zipUrl, frames, onLoad, onError }: UgoiraPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const frameImagesRef = useRef<HTMLImageElement[]>([]);
  const animFrameRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load and decode all frame images from the ZIP
  const loadFrames = useCallback(async () => {
    try {
      const res = await fetch(zipUrl);
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);

      const buffer = await res.arrayBuffer();
      const zipFiles = await extractZip(buffer);

      // Sort frames by the order specified in the frames metadata
      const sortedFrames = frames.filter(f => zipFiles.has(f.file));
      if (sortedFrames.length === 0) {
        throw new Error('No matching frames found in ZIP');
      }

      // Create Image elements from the extracted blobs
      const images = await Promise.all(
        sortedFrames.map(f => {
          return new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new window.Image();
            const blob = zipFiles.get(f.file)!;
            const url = URL.createObjectURL(blob);
            img.onload = () => {
              URL.revokeObjectURL(url);
              resolve(img);
            };
            img.onerror = () => {
              URL.revokeObjectURL(url);
              reject(new Error(`Failed to decode ${f.file}`));
            };
            img.src = url;
          });
        })
      );

      frameImagesRef.current = images;
      setLoading(false);
      onLoad?.();
    } catch (err) {
      console.error('UgoiraPlayer load error:', err);
      setError(true);
      setLoading(false);
      onError?.();
    }
  }, [zipUrl, frames, onLoad, onError]);

  useEffect(() => {
    loadFrames();
  }, [loadFrames]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || loading || error || frameImagesRef.current.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const images = frameImagesRef.current;

    // Size canvas to the first frame's natural dimensions
    canvas.width = images[0].naturalWidth;
    canvas.height = images[0].naturalHeight;

    let currentFrame = 0;

    const drawFrame = () => {
      const img = images[currentFrame];
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      const delay = frames[currentFrame]?.delay || 100;
      currentFrame = (currentFrame + 1) % images.length;

      timerRef.current = setTimeout(() => {
        animFrameRef.current = requestAnimationFrame(drawFrame);
      }, delay);
    };

    drawFrame();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [loading, error, frames]);

  if (error) {
    return null; // Parent (PhotoViewer) handles error state
  }

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-auto"
      style={{ imageRendering: 'auto' }}
    />
  );
}
