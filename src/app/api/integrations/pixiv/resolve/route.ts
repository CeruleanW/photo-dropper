import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import Photo from '@/models/Photo';

const PIXIV_BASE = 'https://www.pixiv.net';

function getSessionCookie(): string {
  const cookie = process.env.PIXIV_PHPSESSID;
  if (!cookie) throw new Error('PIXIV_PHPSESSID is not set');
  return cookie;
}

/**
 * GET /api/integrations/pixiv/resolve?id=<photoId>
 *
 * Lazily resolves a Pixiv photo's high-res image URL.
 * Called by the PhotoViewer when it's about to display a Pixiv photo
 * that hasn't been resolved yet (metadata.resolved === false).
 *
 * Returns the proxied image URL ready for the browser.
 */
export async function GET(req: NextRequest) {
  const photoId = req.nextUrl.searchParams.get('id');
  if (!photoId) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  try {
    await connectToDatabase();

    const photo = await Photo.findById(photoId);
    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    // Already resolved — return cached data.
    // Exception: re-resolve if illustType is unknown (old import that may be ugoira resolved with broken logic)
    if (photo.metadata?.resolved && photo.metadata?.illustType !== undefined) {
      return NextResponse.json({
        success: true,
        url: photo.url,
        ...(photo.metadata.ugoiraZipUrl ? {
          ugoiraZipUrl: photo.metadata.ugoiraZipUrl,
          ugoiraFrames: photo.metadata.ugoiraFrames,
        } : {}),
        ...(photo.metadata.pages?.length > 1 ? { pages: photo.metadata.pages } : {}),
      });
    }

    const illustId = photo.externalId;
    const headers = {
      'Cookie': `PHPSESSID=${getSessionCookie()}`,
      'Referer': `${PIXIV_BASE}/artworks/${illustId}`,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    };

    const isUgoira = photo.metadata?.illustType === 2;

    // --- Ugoira (animated artwork) ---
    if (isUgoira) {
      const ugoiraRes = await fetch(
        `${PIXIV_BASE}/ajax/illust/${illustId}/ugoira_meta?lang=en`,
        { headers }
      );

      if (ugoiraRes.ok) {
        const ugoiraData = await ugoiraRes.json();
        if (!ugoiraData.error && ugoiraData.body) {
          const zipUrl = ugoiraData.body.originalSrc || ugoiraData.body.src;
          const frames = ugoiraData.body.frames; // [{file:"000000.jpg", delay:100}, ...]

          photo.metadata = {
            ...photo.metadata,
            resolved: true,
            ugoiraZipUrl: zipUrl,
            ugoiraFrames: frames,
          };
          await photo.save();

          return NextResponse.json({
            success: true,
            url: photo.url, // keep thumbnail as poster
            ugoiraZipUrl: zipUrl,
            ugoiraFrames: frames,
          });
        }
      }

      // Ugoira meta failed — mark resolved anyway to avoid retry loops
      photo.metadata = { ...photo.metadata, resolved: true };
      await photo.save();
      return NextResponse.json({ success: true, url: photo.url });
    }

    // --- Normal illustration / manga ---
    // For old imports without illustType, try ugoira_meta first since the pages API
    // returns static preview images even for ugoira artworks.
    if (photo.metadata?.illustType === undefined) {
      try {
        const ugoiraRes = await fetch(
          `${PIXIV_BASE}/ajax/illust/${illustId}/ugoira_meta?lang=en`,
          { headers }
        );
        if (ugoiraRes.ok) {
          const ugoiraData = await ugoiraRes.json();
          if (!ugoiraData.error && ugoiraData.body) {
            const zipUrl = ugoiraData.body.originalSrc || ugoiraData.body.src;
            const frames = ugoiraData.body.frames;

            photo.metadata = {
              ...photo.metadata,
              resolved: true,
              illustType: 2,
              ugoiraZipUrl: zipUrl,
              ugoiraFrames: frames,
            };
            await photo.save();

            return NextResponse.json({
              success: true,
              url: photo.url,
              ugoiraZipUrl: zipUrl,
              ugoiraFrames: frames,
            });
          }
        }
      } catch {
        // Not a ugoira, fall through to pages logic
      }
    }

    const pagesRes = await fetch(`${PIXIV_BASE}/ajax/illust/${illustId}/pages?lang=en`, { headers });

    let imageUrl = photo.url; // keep thumbnail as fallback
    let pages: string[] = [];

    if (pagesRes.ok) {
      const pagesData = await pagesRes.json();
      if (!pagesData.error && pagesData.body?.length > 0) {
        // Extract all page URLs (regular quality preferred, fall back to original)
        pages = pagesData.body
          .map((p: { urls?: { regular?: string; original?: string } }) =>
            p.urls?.regular || p.urls?.original || ''
          )
          .filter(Boolean);
        imageUrl = pages[0] || imageUrl;
      }
    }

    // Update the photo record with the resolved URL and all pages
    photo.url = imageUrl;
    photo.metadata = {
      ...photo.metadata,
      resolved: true,
      illustType: photo.metadata?.illustType ?? 0, // store type to avoid re-resolution
      ...(pages.length > 1 ? { pages } : {}),
    };
    await photo.save();

    return NextResponse.json({
      success: true,
      url: imageUrl,
      illustType: photo.metadata.illustType,
      pages: pages.length > 1 ? pages : undefined,
    });
  } catch (error) {
    console.error('Resolve error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
