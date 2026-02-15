import Account from "@/models/Account";
import Photo from "@/models/Photo";
import connectToDatabase from "./db";
import { downloadImage } from '@/lib/storage';

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

export function calculateDimensions(originalWidth: number, originalHeight: number, maxDimension: number): { width: number, height: number } {
    let width = originalWidth;
    let height = originalHeight;

    if (originalWidth > maxDimension || originalHeight > maxDimension) {
        if (originalWidth > originalHeight) {
            width = maxDimension;
            height = Math.round((originalHeight / originalWidth) * maxDimension);
        } else {
            height = maxDimension;
            width = Math.round((originalWidth / originalHeight) * maxDimension);
        }
    }
    return { width, height };
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
    const errors: string[] = [];

    // Use Picker API to list items from the session
    
    // Loop incase there are multiple pages
    do {
        // ... (existing URL construction)
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
        console.log(`[listPickedMediaItems] API returned ${mediaItems.length} items. PageToken: ${!!data.nextPageToken}`);

        if (mediaItems.length > 0) {
            await connectToDatabase(); 
            
            // Process items one by one
            const ops = [];
            for (const item of mediaItems) {
                if (!item.mediaFile || !item.mediaFile.baseUrl) {
                    console.warn(`[listPickedMediaItems] Skipping item ${item.id} due to missing mediaFile or baseUrl`, item);
                    errors.push(`Item ${item.id} missing URL`);
                    continue;
                }
                
                try {
                    // Download full res image
                    const MAX_DIMENSION = 2048;
// ... (imports)
                    const originalWidth = parseInt(item.mediaFile.mediaWidth);
                    const originalHeight = parseInt(item.mediaFile.mediaHeight);
                    
                    let downloadUrl = item.mediaFile.baseUrl;
                    let width = 0;
                    let height = 0;

                    if (!isNaN(originalWidth) && !isNaN(originalHeight)) {
                        const dims = calculateDimensions(originalWidth, originalHeight, MAX_DIMENSION);
                        width = dims.width;
                        height = dims.height;
                        downloadUrl = `${item.mediaFile.baseUrl}=w${width}-h${height}`;
                    } else {
                        console.warn(`[listPickedMediaItems] Item ${item.id} has invalid dimensions: ${item.mediaFile.mediaWidth}x${item.mediaFile.mediaHeight}. Appending =d to enforce download.`);
                        // Try =d which is standard for "download"
                         downloadUrl = `${item.mediaFile.baseUrl}=d`;
                    }
                    const filename = `${item.id}.jpg`;
                    
                    const localPath = await downloadImage(downloadUrl, filename, accessToken);
                    
                    ops.push({
                        updateOne: {
                            filter: { externalId: item.id },
                            update: {
                                $set: {
                                    userId,
                                    externalId: item.id,
                                    source: 'GOOGLE' as const,
                                    url: localPath,
                                    metadata: {
                                        originalUrl: item.mediaFile.baseUrl,
                                        width,
                                        height,
                                        mimeType: item.mediaFile.mimeType,
                                        filename: item.mediaFile.filename,
                                        description: item.description || '', // Capture description/caption
                                        productUrl: item.productUrl, // Link to Google Photos
                                    },
                                    updatedAt: new Date(),
                                },
                                $setOnInsert: {
                                    displayCount: 0,
                                }
                            },
                            upsert: true
                        }
                    });
                } catch (err) {
                    console.error(`Failed to download item ${item.id}`, err);
                    errors.push(`Failed to download ${item.id}: ${err instanceof Error ? err.message : String(err)}`);
                }
            }

            if (ops.length > 0) {
                await Photo.bulkWrite(ops);
                totalSynced += ops.length;
            }
        }

        pageToken = data.nextPageToken;
    } while (pageToken);

    return { count: totalSynced, errors };
}
