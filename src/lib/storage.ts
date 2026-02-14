import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream';
import { promisify } from 'util';

const streamPipeline = promisify(pipeline);

export async function downloadImage(url: string, filename: string, accessToken?: string): Promise<string> {
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filepath = path.join(uploadsDir, filename);
    
    const headers: HeadersInit = {};
    if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(url, { headers });
    if (!response.ok) {
        throw new Error(`Failed to fetch image from ${url}: ${response.status} ${response.statusText}`);
    }

    if (!response.body) {
        throw new Error('No response body');
    }

    // @ts-expect-error - node-fetch vs web fetch types mismatch, but pipeline works with web streams in node 18+
    await streamPipeline(response.body, fs.createWriteStream(filepath));

    // Return the public URL path
    return `/uploads/${filename}`;
}
