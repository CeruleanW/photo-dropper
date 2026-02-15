import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import Interaction from '@/models/Interaction';
import Photo from '@/models/Photo';
import User from '@/models/User'; // We might need this later for user-specific tracking

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    
    const body = await req.json();
    const { userId, photoId, type, metadata } = body;

    // Validate input
    if (!userId || !photoId || !type) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, photoId, type' },
        { status: 400 }
      );
    }

    const validTypes = ['VIEW', 'LIKE', 'DISLIKE', 'SKIP', 'FAVORITE'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: 'Invalid interaction type' },
        { status: 400 }
      );
    }

    // Record interaction
    const interaction = await Interaction.create({
      userId,
      photoId,
      type,
      metadata,
    });

    // Update Photo stats if applicable
    if (type === 'VIEW') {
      await Photo.findByIdAndUpdate(photoId, {
        $set: { lastDisplayedAt: new Date() },
        $inc: { displayCount: 1 },
      });
    }

    // Toggle like/favorite state on the Photo document
    if (type === 'LIKE') {
      const photo = await Photo.findById(photoId);
      if (photo) {
        await Photo.findByIdAndUpdate(photoId, {
          $set: { isLiked: !photo.isLiked },
        });
      }
    }

    if (type === 'FAVORITE') {
      const photo = await Photo.findById(photoId);
      if (photo) {
        await Photo.findByIdAndUpdate(photoId, {
          $set: { isFavorited: !photo.isFavorited },
        });
      }
    }

    return NextResponse.json({ success: true, interaction });
  } catch (error) {
    console.error('Error recording interaction:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
