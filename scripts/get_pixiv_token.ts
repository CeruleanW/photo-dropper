/**
 * Pixiv OAuth Refresh Token Script
 *
 * This script helps you obtain a Pixiv refresh token for the app.
 * 
 * Usage:
 *   pnpm tsx scripts/get_pixiv_token.ts
 *
 * Steps:
 *   1. The script generates an OAuth URL and opens it in your browser.
 *   2. Log in to Pixiv and authorize the app.
 *   3. After authorization, your browser will redirect to a URL starting with
 *      "pixiv://..." — the page won't load (that's expected).
 *   4. Copy the FULL URL from the browser address bar and paste it into the terminal.
 *   5. The script exchanges the code for a refresh token and prints it.
 *   6. Add the refresh token to your .env.local file.
 */

import crypto from 'crypto';
import readline from 'readline';

// Well-known Pixiv OAuth constants (community-reverse-engineered)
const CLIENT_ID = 'MOBrBDS8blbauoSck0ZfDbtuzpyT';
const CLIENT_SECRET = 'lsACyCD94FhDUtGTXi3QzcFE2uU1hqtDaKeqrdwj';
const LOGIN_URL = 'https://app-api.pixiv.net/web/v1/login';
const AUTH_TOKEN_URL = 'https://oauth.secure.pixiv.net/auth/token';
const REDIRECT_URI = 'https://app-api.pixiv.net/web/v1/users/auth/pixiv/callback';

function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('hex');
}

function generateCodeChallenge(verifier: string): string {
  return crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');
}

function buildLoginUrl(codeChallenge: string): string {
  const params = new URLSearchParams({
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    client: 'pixiv-android',
  });
  return `${LOGIN_URL}?${params.toString()}`;
}

async function exchangeCode(code: string, codeVerifier: string) {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code,
    code_verifier: codeVerifier,
    grant_type: 'authorization_code',
    include_policy: 'true',
    redirect_uri: REDIRECT_URI,
  });

  const response = await fetch(AUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'PixivAndroidApp/5.0.234 (Android 14; Pixel 8)',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token exchange failed (${response.status}): ${text}`);
  }

  return response.json();
}

function askQuestion(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log('=== Pixiv Refresh Token Helper ===\n');

  // Step 1: Generate PKCE codes
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  // Step 2: Build login URL
  const loginUrl = buildLoginUrl(codeChallenge);

  console.log('1. Open this URL in your browser:\n');
  console.log(`   ${loginUrl}\n`);

  // Try to open in browser
  const { exec } = await import('child_process');
  exec(`open "${loginUrl}"`);
  console.log('   (Attempting to open automatically...)\n');

  console.log('2. Log in to Pixiv and authorize the app.\n');
  console.log('3. After authorization, Pixiv will redirect to a URL like:');
  console.log('   pixiv://account/login?code=XXXX&via=login\n');
  console.log('   The page won\'t load — that\'s expected!\n');
  console.log('4. Copy the FULL redirect URL from your browser address bar.\n');

  // Step 3: Get the redirect URL from user
  const redirectUrl = await askQuestion('Paste the redirect URL here: ');

  if (!redirectUrl) {
    console.error('No URL provided. Exiting.');
    process.exit(1);
  }

  // Extract authorization code
  let code: string;
  try {
    const url = new URL(redirectUrl);
    code = url.searchParams.get('code') || '';
  } catch {
    // Sometimes the pixiv:// scheme doesn't parse well, try regex
    const match = redirectUrl.match(/code=([^&]+)/);
    code = match ? match[1] : '';
  }

  if (!code) {
    console.error('Could not extract authorization code from URL. Make sure you copied the full URL.');
    process.exit(1);
  }

  console.log(`\nExtracted code: ${code.substring(0, 10)}...`);
  console.log('Exchanging for tokens...\n');

  // Step 4: Exchange code for tokens
  try {
    const result = await exchangeCode(code, codeVerifier);
    const refreshToken = result.refresh_token;
    const accessToken = result.access_token;
    const user = result.user;

    console.log('✅ Success!\n');
    if (user) {
      console.log(`   Logged in as: ${user.name} (${user.account})`);
      console.log(`   User ID: ${user.id}\n`);
    }

    console.log('   Your refresh token:\n');
    console.log(`   ${refreshToken}\n`);
    console.log('   Add this to your .env.local:');
    console.log(`   PIXIV_REFRESH_TOKEN=${refreshToken}\n`);

    if (user) {
      console.log(`   And use this as your Pixiv User ID in the app: ${user.id}`);
    }
  } catch (error) {
    console.error('Failed to exchange code:', error);
    process.exit(1);
  }
}

main();
