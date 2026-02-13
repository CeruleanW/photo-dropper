import Account from "@/models/Account";
import Photo from "@/models/Photo";
import connectToDatabase from "./db";

const GOOGLE_PICKER_API_BASE = 'https://photospicker.googleapis.com/v1';

async function getGoogleAccessToken(userId: string): Promise<string> {
    await connectToDatabase();
    const account = await Account.findOne({ userId, provider: 'google' });
    if (!account) {
        throw new Error('Google account not found for user');
    }

    // Check if token is expired (or close to expiring)
    // expires_at is in seconds (unix timestamp)
    const now = Math.floor(Date.now() / 1000);
    if (account.expires_at && account.expires_at > now + 60) {
        return account.access_token || ''; // Handle potential undefined
    }

    // Refresh token
    if (!account.refresh_token) {
        throw new Error('No refresh token available');
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            grant_type: 'refresh_token',
            refresh_token: account.refresh_token,
        }),
    });

    const data = await response.json();
    if (!response.ok) {
        console.error('Token Refresh Error:', data);
        throw new Error(`Failed to refresh token: ${data.error_description || data.error}`);
    }

    // Update account with new token
    account.access_token = data.access_token;
    // expires_in is in seconds
    account.expires_at = Math.floor(Date.now() / 1000) + data.expires_in;
    
    // Some providers rotate refresh tokens, so update if provided
    if (data.refresh_token) {
        account.refresh_token = data.refresh_token;
    }
    await account.save();

    return data.access_token;
}

export async function createPickerSession(userId: string) {
    const accessToken = await getGoogleAccessToken(userId);

    const response = await fetch(`${GOOGLE_PICKER_API_BASE}/sessions`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            // polls config can be set here if needed
        })
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error('Create Picker Session Error:', errorBody);
        throw new Error(`Failed to create picker session: ${response.status} ${errorBody}`);
    }

    return response.json(); 
}

export async function getPickerSession(userId: string, sessionId: string) {
    const accessToken = await getGoogleAccessToken(userId);

    const response = await fetch(`${GOOGLE_PICKER_API_BASE}/sessions/${sessionId}`, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error('Get Picker Session Error:', errorBody);
        throw new Error(`Failed to get picker session: ${response.status} ${errorBody}`);
    }

    return response.json();
}

export async function listPickedMediaItems(userId: string, sessionId: string) {
    const accessToken = await getGoogleAccessToken(userId);
    let pageToken = '';
    let totalSynced = 0;

    // Loop incase there are multiple pages
    do {
        const url = new URL(`${GOOGLE_PICKER_API_BASE}/mediaItems`);
        url.searchParams.append('sessionId', sessionId);
        url.searchParams.append('pageSize', '100');
        if (pageToken) {
            url.searchParams.append('pageToken', pageToken);
        }

        const response = await fetch(url.toString(), {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error('List Picked Media Items Error:', errorBody);
            throw new Error(`Failed to list picked media items: ${response.status} ${errorBody}`);
        }

        const data = await response.json();
        const mediaItems = data.mediaItems || [];

        if (mediaItems.length > 0) {
            // Upsert into DB
            await connectToDatabase(); // ensure db connected for bulkWrite
            const ops = mediaItems
                .filter((item: any) => item.mediaFile && item.mediaFile.baseUrl)
                .map((item: any) => ({
                    updateOne: {
                        filter: { externalId: item.id }, // Use item.id as externalId
                        update: {
                            $set: {
                                userId,
                                externalId: item.id,
                                source: 'GOOGLE',
                                url: item.mediaFile.baseUrl,
                                // Note on BaseURL: It might expire. 
                                // Ideally we download bytes, but for now we store the URL.
                                // We store logic dimensions to help UI
                                metadata: {
                                    width: item.mediaFile.mediaWidth,
                                    height: item.mediaFile.mediaHeight,
                                    mimeType: item.mediaFile.mimeType,
                                    filename: item.mediaFile.filename,
                                },
                            }
                        },
                        upsert: true
                    }
                }));

            if (ops.length > 0) {
                await Photo.bulkWrite(ops);
                totalSynced += ops.length;
            }
        }

        pageToken = data.nextPageToken;
    } while (pageToken);

    return totalSynced;
}

export async function syncGooglePhotos(userId: string) {
    const accessToken = await getGoogleAccessToken(userId);
    let pageToken = '';
    let totalSynced = 0;

    // Use Library API to list items
    const GOOGLE_PHOTOS_API_BASE = 'https://photoslibrary.googleapis.com/v1';

    do {
        const url = new URL(`${GOOGLE_PHOTOS_API_BASE}/mediaItems`);
        url.searchParams.append('pageSize', '50');
        if (pageToken) {
            url.searchParams.append('pageToken', pageToken);
        }

        const response = await fetch(url.toString(), {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error('List library items error:', errorBody);
            throw new Error(`Failed to list library items: ${response.status} ${errorBody}`);
        }

        const data = await response.json();
        const mediaItems = data.mediaItems || [];

        if (mediaItems.length > 0) {
             await connectToDatabase();
             const ops = mediaItems
                .filter((item: any) => item.mimeType?.startsWith('image/'))
                .map((item: any) => ({
                    updateOne: {
                        filter: { externalId: item.id },
                        update: {
                            $set: {
                                userId, // Assuming Photo model has userId, or we add it (it should for multi-user)
                                source: 'GOOGLE' as const,
                                url: `${item.baseUrl}=w${item.mediaMetadata.width}-h${item.mediaMetadata.height}`,
                                thumbnailUrl: `${item.baseUrl}=w400-h400`,
                                metadata: {
                                    width: item.mediaMetadata.width,
                                    height: item.mediaMetadata.height,
                                    creationTime: item.mediaMetadata.creationTime,
                                    filename: item.filename,
                                    id: item.id
                                }
                            },
                            $setOnInsert: {
                                displayCount: 0,
                            }
                        },
                        upsert: true
                    }
                }));

            if (ops.length > 0) {
                await Photo.bulkWrite(ops);
                totalSynced += ops.length;
            }
        }

        pageToken = data.nextPageToken;
        // Limit to 100 items for now to avoid long syncs in this demo
        if (totalSynced >= 100) break;

    } while (pageToken);

    return totalSynced;
}
