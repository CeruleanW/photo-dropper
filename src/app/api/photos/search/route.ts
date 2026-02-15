import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import Photo from '@/models/Photo';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    if (!query || query.trim().length === 0) {
      return NextResponse.json({ photos: [] });
    }

    await connectToDatabase();

    // Create a flexible regex that works for partial matches
    // 'i' flag for case-insensitive
    const regex = new RegExp(query, 'i');

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
