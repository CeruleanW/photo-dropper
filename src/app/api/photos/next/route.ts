import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next"; // Correct import for App Router/NextAuth v4
import { authOptions } from "@/lib/auth";
import connectToDatabase from '@/lib/db';
import Photo, { IPhoto } from '@/models/Photo';

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    
    const session = await getServerSession(authOptions);
    // If authenticated with Google, optionally trigger sync or just rely on background/manual sync.
    // For now, let's just query the DB which should be populated by the sync route or initial import.
    // But to ensure we have fresh URLs (expiry!), we might need to refresh specific photos or re-sync.
    // A full re-sync on every 'next' call is too slow.
    // Ideally, we catch 403s on frontend and refresh, or use a proxy.
    // For MVP, if we notice we are serving Google photos, we might want to check expiry?
    // Let's assume the user hits "Sync" or we have a background job.
    // OR: trigger a lightweight sync (first page) here?
    
    // Uncomment to auto-sync on load (can be slow):
    /*
    if (session && session.user) {
         // @ts-expect-error - user id
         const userId = session.user.id;
         // await syncGooglePhotos(userId); // Import this from lib/googlePhotos
    }
    */

    const searchParams = req.nextUrl.searchParams;
    const count = parseInt(searchParams.get('count') || '1', 10);
    const limit = Math.min(Math.max(count, 1), 50);

    // Strategy:
    // 1. Find photos that have been displayed least recently.
    // 2. Mix of sources?
    
    const poolSize = limit * 5;

    // Get candidates sorted by lastDisplayedAt.
    // We prioritize keeping the Google Photos URLs fresh, so we might prefer those we just synced?
    // Actually, bulkWrite updated them.
    
    // Let's query broadly.
    const candidates = await Photo.find({})
      .sort({ lastDisplayedAt: 1, displayCount: 1 })
      .limit(poolSize)
      .exec();

    if (candidates.length === 0) {
      return NextResponse.json({ photos: [] });
    }

    // Shuffle and slice
    const shuffled = candidates.sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, limit);

    return NextResponse.json({ photos: selected });
  } catch (error) {
    console.error('Error fetching photos:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
