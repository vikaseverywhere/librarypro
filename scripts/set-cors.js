/**
 * One-time script to set CORS on Firebase Storage bucket.
 *
 * Usage:
 *   1. Go to Firebase Console → Project Settings → Service Accounts
 *   2. Click "Generate new private key" → save as service-account-key.json in project root
 *   3. Run:  node scripts/set-cors.js
 *
 * This only needs to be done ONCE per bucket.
 */
const admin = require('../firebase/functions/node_modules/firebase-admin');
const path = require('path');
const fs = require('fs');

const KEY_PATH = path.resolve(__dirname, '..', 'service-account-key.json');
const CORS_PATH = path.resolve(__dirname, '..', 'cors.json');

// Try both the new and old bucket name formats
const BUCKET_NAMES = [
  'library-app-prod.firebasestorage.app',
  'library-app-prod.appspot.com'
];

async function main() {
  if (!fs.existsSync(KEY_PATH)) {
    console.error('\n❌  service-account-key.json not found in project root.');
    console.error('    → Go to Firebase Console → Project Settings → Service Accounts');
    console.error('    → Click "Generate new private key"');
    console.error('    → Save the file as service-account-key.json in the project root\n');
    process.exit(1);
  }

  const corsConfig = JSON.parse(fs.readFileSync(CORS_PATH, 'utf8'));

  const serviceAccount = require(KEY_PATH);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: BUCKET_NAMES[0]
  });

  for (const bucketName of BUCKET_NAMES) {
    try {
      console.log(`Trying bucket: ${bucketName} ...`);
      const bucket = admin.storage().bucket(bucketName);
      await bucket.setCorsConfiguration(corsConfig);
      console.log(`✅  CORS set successfully on ${bucketName}!`);
      console.log('    Configuration:', JSON.stringify(corsConfig, null, 2));
      return;
    } catch (err) {
      console.log(`    ⚠ ${bucketName} → ${err.message || err}`);
    }
  }

  console.error('\n❌  Could not set CORS on any bucket. Check your service account key and bucket names.');
  process.exit(1);
}

main();
