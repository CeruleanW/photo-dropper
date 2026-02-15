import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy endpoint for Pixiv images.
 * Pixiv blocks hotlinking - images require Referer: https://www.pixiv.net
 * This endpoint fetches images server-side and streams them to the browser.
 *
 * Usage: GET /api/proxy/image?url=https://i.pximg.net/...
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  // Security: only allow proxying from Pixiv image domains
  const allowedDomains = ['i.pximg.net', 'i-f.pximg.net', 'i-cf.pximg.net', 's.pximg.net'];
  try {
    const parsedUrl = new URL(url);
    if (!allowedDomains.some(d => parsedUrl.hostname === d || parsedUrl.hostname.endsWith('.' + d))) {
      return NextResponse.json({ error: 'Domain not allowed' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          'Referer': 'https://www.pixiv.net/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: `Upstream returned ${response.status}` },
        { status: response.status }
      );
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, immutable',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Proxy image error:', error);
    return NextResponse.json({ error: 'Failed to fetch image' }, { status: 500 });
  }
}
