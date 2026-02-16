import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import Photo, { IPhoto } from '@/models/Photo';

/** Escape special regex characters so user input is treated as a literal string. */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * GET /api/photos/next?count=N&search=query
 *
 * Returns photos using weighted random selection that prioritizes:
 * 1. Photos never viewed (highest priority)
 * 2. Photos not viewed recently
 * 3. Photos with fewer total views
 * 4. Favorited photos get a small boost
 */
export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();

    const searchParams = req.nextUrl.searchParams;
    const count = parseInt(searchParams.get('count') || '1', 10);
    const limit = Math.min(Math.max(count, 1), 50);
    const search = searchParams.get('search') || '';
    const source = searchParams.get('source') || '';
    const tagsParam = searchParams.get('tags') || '';

    // Build query filter
    const filter: Record<string, unknown> = {};

    // Source filter
    if (source) {
      filter.source = source;
    }

    // Tags filter (comma-separated, match ALL specified tags)
    if (tagsParam) {
      const tags = tagsParam.split(',').map(t => t.trim()).filter(Boolean).slice(0, 20);
      if (tags.length > 0) {
        filter['metadata.tags'] = { $all: tags };
      }
    }

    // Text search filter
    if (search) {
      const safeSearch = search.slice(0, 200);
      const regex = { $regex: escapeRegex(safeSearch), $options: 'i' };
      filter.$or = [
        { 'metadata.description': regex },
        { 'metadata.title': regex },
        { 'metadata.tags': regex },
        { 'metadata.artist': regex },
      ];
    }

    // Fetch a larger pool of candidates to select from
    const poolSize = Math.max(limit * 10, 100);
    const totalPhotos = await Photo.countDocuments(filter);

    if (totalPhotos === 0) {
      return NextResponse.json({ photos: [] });
    }

    // Get candidates: mix of never-viewed + least-recently-viewed
    const candidates: IPhoto[] = [];

    // First: photos never viewed (highest priority)
    const neverViewed = await Photo.find({ ...filter, lastDisplayedAt: null })
      .limit(poolSize)
      .exec();
    candidates.push(...neverViewed);

    // Then: fill remaining pool with least-recently-viewed
    if (candidates.length < poolSize) {
      const remaining = poolSize - candidates.length;
      const neverViewedIds = candidates.map(c => c._id);
      const leastRecent = await Photo.find({
        ...filter,
        _id: { $nin: neverViewedIds },
        lastDisplayedAt: { $ne: null },
      })
        .sort({ lastDisplayedAt: 1 }) // oldest viewed first
        .limit(remaining)
        .exec();
      candidates.push(...leastRecent);
    }

    if (candidates.length === 0) {
      return NextResponse.json({ photos: [] });
    }

    // Calculate weights for each candidate
    const now = Date.now();
    const weighted = candidates.map(photo => {
      let weight = 1;

      // Never viewed → highest weight
      if (!photo.lastDisplayedAt) {
        weight = 100;
      } else {
        // Time since last viewed (in hours)
        const hoursSinceViewed = (now - photo.lastDisplayedAt.getTime()) / (1000 * 60 * 60);
        // More hours since viewed = higher weight (logarithmic scale)
        weight = Math.log2(hoursSinceViewed + 1) + 1;
      }

      // Penalize frequently viewed photos
      const viewPenalty = 1 / (1 + photo.displayCount * 0.1);
      weight *= viewPenalty;

      // Small boost for favorited photos
      if (photo.isFavorited) {
        weight *= 1.3;
      }

      return { photo, weight };
    });

    // Weighted random selection
    const selected: IPhoto[] = [];
    const pool = [...weighted];

    for (let i = 0; i < limit && pool.length > 0; i++) {
      const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
      let random = Math.random() * totalWeight;

      let chosenIndex = 0;
      for (let j = 0; j < pool.length; j++) {
        random -= pool[j].weight;
        if (random <= 0) {
          chosenIndex = j;
          break;
        }
      }

      selected.push(pool[chosenIndex].photo);
      pool.splice(chosenIndex, 1); // Remove to avoid duplicates
    }

    return NextResponse.json({ photos: selected });
  } catch (error) {
    console.error('Error fetching photos:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
