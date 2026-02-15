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

    // Already resolved — just return the current URL
    if (photo.metadata?.resolved) {
      return NextResponse.json({ success: true, url: photo.url });
    }

    const illustId = photo.externalId;
    const headers = {
      'Cookie': `PHPSESSID=${getSessionCookie()}`,
      'Referer': `${PIXIV_BASE}/artworks/${illustId}`,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    };

    // Fetch page URLs to get the high-res image
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
      ...(pages.length > 1 ? { pages } : {}),
    };
    await photo.save();

    return NextResponse.json({ success: true, url: imageUrl, pages: pages.length > 1 ? pages : undefined });
  } catch (error) {
    console.error('Resolve error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
