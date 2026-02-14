import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import connectToDatabase from '@/lib/db';
import Photo from '@/models/Photo';
import fs from 'fs';
import path from 'path';

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    // 1. Find all photos with source: 'GOOGLE'
    const photos = await Photo.find({ source: 'GOOGLE' });

    if (photos.length === 0) {
        return NextResponse.json({ success: true, count: 0, message: 'No photos to clear' });
    }

    let deletedFiles = 0;
    const errors: string[] = [];

    // 2. Delete files from filesystem
    for (const photo of photos) {
        if (photo.url && photo.url.startsWith('/uploads/')) {
            const filepath = path.join(process.cwd(), 'public', photo.url);
            try {
                if (fs.existsSync(filepath)) {
                    fs.unlinkSync(filepath);
                    deletedFiles++;
                }
            } catch (err: unknown) {
                console.error(`Failed to delete file ${filepath}`, err);
                if (err instanceof Error) {
                    errors.push(err.message);
                }
            }
        }
    }

    // 3. Delete records from database
    const deleteResult = await Photo.deleteMany({ source: 'GOOGLE' });

    return NextResponse.json({ 
        success: true, 
        count: deleteResult.deletedCount, 
        filesDeleted: deletedFiles,
        errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Error clearing Google photos:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
