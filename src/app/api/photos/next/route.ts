import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import connectToDatabase from '@/lib/db';
import Photo, { IPhoto } from '@/models/Photo';
// refreshMediaItems removed


export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    
    // We don't need session here anymore for refreshing, but keeping it for context/future use is fine.
    // const session = await getServerSession(authOptions);

    const searchParams = req.nextUrl.searchParams;
    const count = parseInt(searchParams.get('count') || '1', 10);
    const limit = Math.min(Math.max(count, 1), 50);

    const poolSize = limit * 5;

    // Fetch candidates
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
