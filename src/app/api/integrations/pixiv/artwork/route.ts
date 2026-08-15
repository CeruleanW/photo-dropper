import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import Photo from '@/models/Photo';
import { getServerUserId } from '@/lib/auth';

const PIXIV_BASE = 'https://www.pixiv.net';

function getSessionCookie(): string {
  const cookie = process.env.PIXIV_PHPSESSID;
  if (!cookie) {
    throw new Error('PIXIV_PHPSESSID is not set');
  }
  return cookie;
}

const HEADERS = {
  'Cookie': '',
  'Referer': PIXIV_BASE,
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
};

function makeHeaders() {
  return { ...HEADERS, Cookie: `PHPSESSID=${getSessionCookie()}` };
}

/**
 * POST /api/integrations/pixiv/artwork
 * Body: { url: string } — a pixiv.net/artworks/ID URL
 *
 * Fetches the artwork details and saves it as a photo.
 */
export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url) {
      return NextResponse.json({ error: 'Missing url' }, { status: 400 });
    }

    // Extract artwork ID from URL
    const match = url.match(/artworks\/(\d+)/);
    if (!match) {
      return NextResponse.json(
        { error: 'Invalid URL. Expected format: https://www.pixiv.net/artworks/12345' },
        { status: 400 }
      );
    }
    const illustId = match[1];

    await connectToDatabase();

    // Check if already exists
    const userId = await getServerUserId();
    const existing = await Photo.findOne({ source: 'PIXIV', externalId: illustId, userId });
    if (existing) {
      return NextResponse.json({ success: true, skipped: true, photo: existing });
    }

    // Fetch illustration details
    const detailRes = await fetch(`${PIXIV_BASE}/ajax/illust/${illustId}?lang=en`, {
      headers: makeHeaders(),
    });
    if (!detailRes.ok) {
      return NextResponse.json({ error: `Pixiv API error: ${detailRes.status}` }, { status: 502 });
    }
    const detailData = await detailRes.json();
    if (detailData.error) {
      return NextResponse.json({ error: detailData.message }, { status: 502 });
    }
    const illust = detailData.body;

    // Fetch page URLs for higher-res image
    const pagesRes = await fetch(`${PIXIV_BASE}/ajax/illust/${illustId}/pages?lang=en`, {
      headers: { ...makeHeaders(), Referer: `${PIXIV_BASE}/artworks/${illustId}` },
    });
    let imageUrl = illust.urls?.regular || illust.urls?.original || '';
    let pages: string[] = [];
    if (pagesRes.ok) {
      const pagesData = await pagesRes.json();
      if (!pagesData.error && pagesData.body?.length > 0) {
        pages = pagesData.body
          .map((p: { urls?: { regular?: string; original?: string } }) =>
            p.urls?.regular || p.urls?.original || ''
          )
          .filter(Boolean);
        imageUrl = pages[0] || imageUrl;
      }
    }

    const photo = await Photo.create({
      userId,
      source: 'PIXIV',
      externalId: illustId,
      url: imageUrl,
      thumbnailUrl: illust.urls?.thumb || illust.urls?.mini || imageUrl,
      metadata: {
        title: illust.title,
        artist: illust.userName,
        artistId: illust.userId,
        tags: (illust.tags?.tags || []).map((t: { tag: string }) => t.tag),
        width: illust.width,
        height: illust.height,
        pixivUrl: `https://www.pixiv.net/artworks/${illustId}`,
        createDate: illust.createDate,
        pageCount: illust.pageCount,
        description: illust.description,
        resolved: true, // Already resolved since we fetched pages
        ...(pages.length > 1 ? { pages } : {}),
      },
    });

    return NextResponse.json({ success: true, photo });
  } catch (error) {
    console.error('Pixiv artwork fetch error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
