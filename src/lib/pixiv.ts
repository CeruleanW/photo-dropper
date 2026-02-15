import connectToDatabase from '@/lib/db';
import Photo from '@/models/Photo';

/**
 * Pixiv Web API client.
 *
 * Uses the Pixiv website's internal AJAX API with a session cookie (PHPSESSID).
 * This is much simpler than the OAuth flow and works reliably.
 *
 * To get your PHPSESSID:
 *   1. Log into pixiv.net in your browser
 *   2. Open DevTools → Application → Cookies → pixiv.net
 *   3. Copy the value of the PHPSESSID cookie
 *   4. Set PIXIV_PHPSESSID in .env.local
 */

const PIXIV_BASE = 'https://www.pixiv.net';

function getSessionCookie(): string {
  const cookie = process.env.PIXIV_PHPSESSID;
  if (!cookie) {
    throw new Error('PIXIV_PHPSESSID is not set in environment variables. See the setup instructions.');
  }
  return cookie;
}

interface PixivBookmarkResponse {
  error: boolean;
  message: string;
  body: {
    works: PixivWork[];
    total: number;
  };
}

export interface PixivWork {
  id: string;
  title: string;
  illustType: number;
  url: string; // thumbnail
  tags: string[];
  userId: string;
  userName: string;
  width: number;
  height: number;
  pageCount: number;
  createDate: string;
  updateDate: string;
}

interface PixivIllustDetailResponse {
  error: boolean;
  body: {
    urls: {
      mini: string;
      thumb: string;
      small: string;
      regular: string;
      original: string;
    };
  };
}

/**
 * Fetch a page of bookmarks for a user.
 */
async function fetchBookmarkPage(
  pixivUserId: string,
  offset: number,
  limit: number = 48
): Promise<{ works: PixivWork[]; total: number }> {
  const url = `${PIXIV_BASE}/ajax/user/${pixivUserId}/illusts/bookmarks?tag=&offset=${offset}&limit=${limit}&rest=show&lang=en`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(url, {
      headers: {
        'Cookie': `PHPSESSID=${getSessionCookie()}`,
        'Referer': 'https://www.pixiv.net/',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Pixiv API error (${res.status}): ${text}`);
    }

    const data: PixivBookmarkResponse = await res.json();
    if (data.error) {
      throw new Error(`Pixiv API error: ${data.message}`);
    }

    return { works: data.body.works, total: data.body.total };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetch the original/high-res image URL for an illustration.
 */
async function fetchOriginalUrl(illustId: string): Promise<string> {
  const url = `${PIXIV_BASE}/ajax/illust/${illustId}/pages?lang=en`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(url, {
      headers: {
        'Cookie': `PHPSESSID=${getSessionCookie()}`,
        'Referer': `https://www.pixiv.net/artworks/${illustId}`,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      // Fall back to the thumbnail if we can't get original
      return '';
    }

    const data = await res.json();
    if (data.error || !data.body || data.body.length === 0) {
      return '';
    }

    // First page, regular quality (original can be very large)
    return data.body[0].urls?.regular || data.body[0].urls?.original || '';
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Import all public bookmarks for a given Pixiv user.
 */
export async function importBookmarks(
  appUserId: string,
  pixivUserId: string,
  onProgress?: (imported: number, total: number) => void
): Promise<{ imported: number; skipped: number; total: number; errors: string[] }> {
  await connectToDatabase();

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];
  let offset = 0;
  const limit = 48;

  // First fetch to get total count
  const firstPage = await fetchBookmarkPage(pixivUserId, 0, limit);
  const total = firstPage.total;

  // Process first page
  let result = await processWorks(firstPage.works, appUserId);
  imported = result.imported;
  skipped = result.skipped;
  errors.push(...result.errors);

  offset += limit;

  // Fetch remaining pages
  while (offset < total) {
    try {
      const page = await fetchBookmarkPage(pixivUserId, offset, limit);
      const pageResult = await processWorks(page.works, appUserId);
      imported += pageResult.imported;
      skipped += pageResult.skipped;
      errors.push(...pageResult.errors);

      if (onProgress) {
        onProgress(imported + skipped, total);
      }

      offset += limit;

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      errors.push(`Fetch failed at offset ${offset}: ${msg}`);
      break;
    }
  }

  return { imported, skipped, total, errors };
}

async function processWorks(
  works: PixivWork[],
  appUserId: string
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const work of works) {
    try {
      // Skip restricted/age-gated content (Pixiv returns a placeholder image)
      if (!work.url || work.url.includes('limit_unknown') || work.url.includes('limit_r18')) {
        skipped++;
        continue;
      }

      // Check if already imported
      const existing = await Photo.findOne({
        source: 'PIXIV',
        externalId: work.id,
        userId: appUserId,
      });

      if (existing) {
        skipped++;
        continue;
      }

      // Save with thumbnail URL only — high-res is resolved lazily at display time
      await Photo.create({
        userId: appUserId,
        source: 'PIXIV',
        externalId: work.id,
        url: work.url, // thumbnail for now
        thumbnailUrl: work.url,
        metadata: {
          title: work.title,
          artist: work.userName,
          artistId: work.userId,
          tags: work.tags,
          width: work.width,
          height: work.height,
          pixivUrl: `https://www.pixiv.net/artworks/${work.id}`,
          createDate: work.createDate,
          pageCount: work.pageCount,
          resolved: false, // flag: high-res URL not yet fetched
        },
      });

      imported++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      errors.push(`Failed to import ${work.id}: ${msg}`);
    }
  }

  return { imported, skipped, errors };
}
