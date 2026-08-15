import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import Interaction from '@/models/Interaction';
import Photo from '@/models/Photo';
import User from '@/models/User'; // We might need this later for user-specific tracking
import { getServerUserId } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    
    const body = await req.json();
    const { photoId, type, metadata } = body;

    // Validate input
    if (!photoId || !type) {
      return NextResponse.json(
        { error: 'Missing required fields: photoId, type' },
        { status: 400 }
      );
    }

    const validTypes = ['VIEW', 'LIKE', 'DISLIKE', 'SKIP', 'FAVORITE', 'COMMENT'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: 'Invalid interaction type' },
        { status: 400 }
      );
    }

    const userId = await getServerUserId();

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

    // Toggle like state
    if (type === 'LIKE') {
      const photo = await Photo.findById(photoId);
      if (photo) {
        photo.isLiked = !photo.isLiked;
        await photo.save();
      }
    }

    // Toggle favorite state
    if (type === 'FAVORITE') {
      const photo = await Photo.findById(photoId);
      if (photo) {
        photo.isFavorited = !photo.isFavorited;
        await photo.save();
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
