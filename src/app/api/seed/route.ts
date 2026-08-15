import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import Photo from '@/models/Photo';
import { ANONYMOUS_USER_ID } from '@/lib/auth';

export async function POST() {
  try {
    await connectToDatabase();

    // Check if we already have photos
    const count = await Photo.countDocuments();
    if (count > 0) {
        return NextResponse.json({ message: 'Database already seeded', count });
    }

    const samplePhotos = Array.from({ length: 20 }).map((_, i) => ({
      userId: ANONYMOUS_USER_ID,
      source: 'LOCAL',
      externalId: `seed-${i}`,
      url: `https://picsum.photos/seed/${i}/800/600`, // Use lorem picsum for placeholders
      thumbnailUrl: `https://picsum.photos/seed/${i}/200/200`,
      metadata: { prompt: `Sample Photo ${i}` },
    }));

    await Photo.insertMany(samplePhotos);

    return NextResponse.json({ message: 'Database seeded successfully', count: 20 });
  } catch (error) {
    console.error('Error seeding database:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
