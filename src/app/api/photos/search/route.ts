import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import Photo from '@/models/Photo';

/** Escape special regex characters so user input is treated as a literal string. */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get('q');
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10), 1), 200);
    const source = searchParams.get('source') || '';
    const tagsParam = searchParams.get('tags') || '';

    if (!query || query.trim().length === 0) {
      return NextResponse.json({ photos: [] });
    }

    // Cap query length to prevent regex DoS
    const safeQuery = query.slice(0, 200);

    await connectToDatabase();

    // Escape metacharacters so user input is matched literally
    const regex = new RegExp(escapeRegex(safeQuery), 'i');

    // Build the filter
    const filter: Record<string, unknown> = {
      $or: [
        { 'metadata.description': { $regex: regex } },
        { 'metadata.tags': { $elemMatch: { $regex: regex } } },
        { 'metadata.filename': { $regex: regex } },
      ],
    };

    if (source) {
      filter.source = source;
    }

    if (tagsParam) {
      const tags = tagsParam.split(',').map(t => t.trim()).filter(Boolean).slice(0, 20);
      if (tags.length > 0) {
        filter['metadata.tags'] = { $all: tags };
      }
    }

    const photos = await Photo.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .exec();

    return NextResponse.json({ photos });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
