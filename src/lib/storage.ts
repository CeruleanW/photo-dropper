import fs from 'fs';
import path from 'path';

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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    let response: Response;
    try {
        response = await fetch(url, { headers, signal: controller.signal });
    } finally {
        clearTimeout(timeout);
    }

    if (!response.ok) {
        throw new Error(`Failed to fetch image from ${url}: ${response.status} ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    fs.writeFileSync(filepath, Buffer.from(buffer));

    // Return the public URL path
    return `/uploads/${filename}`;
}
