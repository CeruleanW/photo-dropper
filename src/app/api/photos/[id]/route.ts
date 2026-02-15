import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import Photo from '@/models/Photo';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> } // In Next 15/16 params is a Promise
) {
  try {
    const { id } = await params;
    await connectToDatabase();
    const photo = await Photo.findById(id);
    if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ photo });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectToDatabase();
    const body = await req.json();
    
    // Whitelist allowed fields to update
    const allowedUpdates = ['metadata', 'tags']; // tags might be in metadata or root depending on schema choice
    // My schema has 'metadata', let's assume tags are inside metadata.tags or we can add 'tags' to schema.
    // For now, let's update 'metadata'.
    
    // Logic: If body has tags, update metadata.tags
    // Or if I change schema to have 'tags' array at root.
    // Let's stick to 'metadata' as defined in existing model, but maybe efficient to have explicit tags?
    
    // Let's check what I wrote in src/models/Photo.ts:
    // metadata: { type: Map, of: Schema.Types.Mixed, default: {} }
    
    // I can put tags in metadata.
    
    const updateData: Record<string, any> = {};
    
    // Explicitly handle description and tags
    if (typeof body.description === 'string') {
       updateData['metadata.description'] = body.description.trim();
    }
    
    if (Array.isArray(body.tags)) {
       updateData['metadata.tags'] = body.tags;
    }
    
    // If we want to support generic metadata updates:
    if (body.metadata) {
        // caution: this might overwrite entire map if not careful with dot notation
        // For simplicity, let's just allow passing { tags: [...] } in body and we map it.
    }
    
    const photo = await Photo.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true }
    );
    
    if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    
    return NextResponse.json({ photo });
  } catch (error) {
    console.error('Error updating photo:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
