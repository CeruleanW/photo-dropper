import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createPickerSession, getPickerSession, listPickedMediaItems } from '@/lib/googlePhotos';

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const pickerSession = await createPickerSession(session.user.id);
        return NextResponse.json({ success: true, session: pickerSession });
    } catch (error) {
        console.error('Error creating picker session:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal Server Error' },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
        return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    try {
        const pickerSession = await getPickerSession(session.user.id, sessionId);
        
        let count = 0;
        if (pickerSession.mediaItemsSet) {
            // Picking is done, fetch items
            count = await listPickedMediaItems(session.user.id, sessionId);
        }

        return NextResponse.json({ 
            success: true, 
            session: pickerSession,
            mediaItemsSet: pickerSession.mediaItemsSet,
            count
        });
    } catch (error) {
        console.error('Error polling picker session:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal Server Error' },
            { status: 500 }
        );
    }
}
