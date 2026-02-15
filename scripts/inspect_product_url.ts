
import fs from 'fs';
import path from 'path';

// Load .env.local manually
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  envConfig.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const value = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
      if (key && value && !key.startsWith('#')) {
        process.env[key] = value;
      }
    }
  });
}

async function inspectProductUrl() {
  const { default: connectToDatabase } = await import('../src/lib/db');
  const { default: Photo } = await import('../src/models/Photo');

  await connectToDatabase();
  
  // Get last 5 photos
  const photos = await Photo.find().sort({ createdAt: -1 }).limit(5);
  
  console.log(`Found ${photos.length} photos.`);
  
  photos.forEach((p, i) => {
    console.log(`\n--- Photo ${i + 1} ---`);
    console.log(`ID: ${p._id}`);
    console.log(`Product URL: "${p.metadata?.productUrl}"`);
    console.log(`Description: "${p.metadata?.description}"`);
  });

  process.exit(0);
}

inspectProductUrl().catch(console.error);
