import { NextRequest, NextResponse } from 'next/server';
import { importBookmarks } from '@/lib/pixiv';
import connectToDatabase from '@/lib/db';
import Photo from '@/models/Photo';

/**
 * POST /api/integrations/pixiv/bookmarks
 * Body: { pixivUserId: number }
 * Triggers import of all public bookmarks for the given Pixiv user.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { pixivUserId } = body;

    if (!pixivUserId) {
      return NextResponse.json(
        { error: 'Missing pixivUserId' },
        { status: 400 }
      );
    }

    // Use a dummy userId for now (single-user app)
    const userId = '507f1f77bcf86cd799439011';

    const result = await importBookmarks(userId, String(pixivUserId));

    // Clean up any previously imported restricted/placeholder entries
    await Photo.deleteMany({
      source: 'PIXIV',
      $or: [
        { url: { $regex: 'limit_unknown' } },
        { url: { $regex: 'limit_r18' } },
        { url: { $regex: 's.pximg.net/common/images/limit' } },
      ],
    });

    return NextResponse.json({
      success: true,
      imported: result.imported,
      skipped: result.skipped,
      total: result.total,
      errors: result.errors,
    });
  } catch (error) {
    console.error('Pixiv bookmark import error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/integrations/pixiv/bookmarks
 * Removes all Pixiv photos from the database.
 */
export async function DELETE() {
  try {
    await connectToDatabase();
    const result = await Photo.deleteMany({ source: 'PIXIV' });
    return NextResponse.json({
      success: true,
      count: result.deletedCount,
    });
  } catch (error) {
    console.error('Error clearing Pixiv storage:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
