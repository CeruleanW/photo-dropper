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
      const value = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, ''); // Remove quotes if present
      if (key && value && !key.startsWith('#')) {
        process.env[key] = value;
      }
    }
  });
}

// import connectToDatabase from '../src/lib/db';
// import Photo from '../src/models/Photo';

async function checkDescriptions() {
  const { default: connectToDatabase } = await import('../src/lib/db');
  const { default: Photo } = await import('../src/models/Photo');

  await connectToDatabase();
  
  const total = await Photo.countDocuments();
  const withDescription = await Photo.countDocuments({ 'metadata.description': { $exists: true, $ne: '' } });
  
  console.log(`Total Photos: ${total}`);
  console.log(`Photos with Description: ${withDescription}`);
  
  if (withDescription > 0) {
    const examples = await Photo.find({ 'metadata.description': { $exists: true, $ne: '' } }).limit(5);
    console.log('Examples:');
    examples.forEach(p => console.log(`- ${p.metadata.description}`));
  }
  
  process.exit(0);
}

checkDescriptions().catch(console.error);
