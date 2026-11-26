// Runs before `npm run dist`: says whether the Windows build will be code-signed.
// electron-builder signs automatically when a certificate is configured through environment variables:
//   CSC_LINK (or WIN_CSC_LINK)          path or https URL of a .pfx / .p12 code-signing certificate
//   CSC_KEY_PASSWORD (or WIN_CSC_KEY_PASSWORD)  its password
// Without one the .exe files still work, but Windows SmartScreen shows an "unknown publisher" warning.
// Set SIGN_REQUIRED=1 to make an unsigned build fail instead (for release builds).
import fs from 'fs';

const link = process.env.WIN_CSC_LINK || process.env.CSC_LINK;
const pass = process.env.WIN_CSC_KEY_PASSWORD || process.env.CSC_KEY_PASSWORD;
const required = process.env.SIGN_REQUIRED === '1';

if (link) {
  const local = !/^https?:\/\//.test(link) && !link.startsWith('data:');
  if (local && !fs.existsSync(link)) {
    console.error(`Code signing: certificate not found at ${link}`);
    process.exit(1);
  }
  if (!pass) console.warn('Code signing: CSC_KEY_PASSWORD is not set; signing will fail if the certificate has a password.');
  console.log('Code signing: certificate configured, the Windows .exe files will be signed.');
} else if (required) {
  console.error('Code signing: SIGN_REQUIRED=1 but no certificate is configured (set CSC_LINK and CSC_KEY_PASSWORD).');
  process.exit(1);
} else {
  console.log('Code signing: no certificate configured, building UNSIGNED .exe files (SmartScreen will warn). See README > Code signing.');
}
