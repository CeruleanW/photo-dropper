import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import Photo from '@/models/Photo';

/**
 * GET /api/photos/filters
 *
 * Returns available filter options (distinct sources and tags)
 * for populating the filter UI.
 */
export async function GET() {
  try {
    await connectToDatabase();

    const [sources, tags] = await Promise.all([
      Photo.distinct('source'),
      Photo.distinct('metadata.tags'),
    ]);

    // Sort tags alphabetically, filter out empty/null values
    const cleanTags = (tags as string[])
      .filter(t => t && typeof t === 'string')
      .sort((a, b) => a.localeCompare(b));

    return NextResponse.json({
      sources: sources.filter(Boolean).sort(),
      tags: cleanTags,
    });
  } catch (error) {
    console.error('Error fetching filters:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
