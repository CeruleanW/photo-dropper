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

    if (!query || query.trim().length === 0) {
      return NextResponse.json({ photos: [] });
    }

    // Cap query length to prevent regex DoS
    const safeQuery = query.slice(0, 200);

    await connectToDatabase();

    // Escape metacharacters so user input is matched literally
    const regex = new RegExp(escapeRegex(safeQuery), 'i');

    const photos = await Photo.find({
      $or: [
        { 'metadata.description': { $regex: regex } },
        { 'metadata.tags': { $elemMatch: { $regex: regex } } },
        // Also search filename if description is missing
        { 'metadata.filename': { $regex: regex } }
      ]
    })
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
