import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import Interaction from '@/models/Interaction';

type CommentDoc = {
  _id: unknown;
  userId?: unknown;
  metadata?: { text?: string } | null;
  createdAt?: Date | string;
};

function readText(metadata: unknown): string {
  if (!metadata) return '';
  if (metadata instanceof Map) {
    const v = (metadata as Map<string, unknown>).get('text');
    return typeof v === 'string' ? v : '';
  }
  if (typeof metadata === 'object') {
    const v = (metadata as { text?: unknown }).text;
    return typeof v === 'string' ? v : '';
  }
  return '';
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectToDatabase();

    const docs = (await Interaction
      .find({ photoId: id, type: 'COMMENT' })
      .sort({ createdAt: 1 })
      .lean()) as CommentDoc[];

    const comments = docs.map((d) => ({
      _id: String(d._id),
      userId: d.userId ? String(d.userId) : '',
      text: readText(d.metadata),
      createdAt: d.createdAt,
    }));

    return NextResponse.json({ comments });
  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}