// Builds the signed Android release APK (run via `npm run android:build`, after `cap sync`).
// - finds JDK 21 and the Android SDK (env vars, or the default %LOCALAPPDATA%\Android locations)
// - creates a release signing key on first run (android/keystore/, password in android/keystore.properties)
// - runs Gradle and copies the APK to dist/
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFileSync, execSync } from 'child_process';

const local = process.env.LOCALAPPDATA || '';
const javaHome = process.env.SAKURA_JAVA_HOME || [process.env.JAVA_HOME, path.join(local, 'Android', 'jdk21')].find((p) => p && fs.existsSync(path.join(p, 'bin', process.platform === 'win32' ? 'java.exe' : 'java')));
const sdk = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT, path.join(local, 'Android', 'Sdk')].find((p) => p && fs.existsSync(path.join(p, 'platforms')));
if (!javaHome) { console.error('JDK 21 not found. Set JAVA_HOME (or SAKURA_JAVA_HOME) to a JDK 21.'); process.exit(1); }
if (!sdk) { console.error('Android SDK not found. Set ANDROID_HOME.'); process.exit(1); }
const env = { ...process.env, JAVA_HOME: javaHome, ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk };
const exe = (name) => path.join(javaHome, 'bin', process.platform === 'win32' ? `${name}.exe` : name);

// SDK location for Gradle
fs.writeFileSync('android/local.properties', `sdk.dir=${sdk.replace(/\\/g, '\\\\')}\n`);

// release key (generated once; keep android/keystore/ and keystore.properties safe and private)
const props = 'android/keystore.properties';
if (!fs.existsSync(props)) {
  fs.mkdirSync('android/keystore', { recursive: true });
  const pass = crypto.randomBytes(18).toString('base64url');
  execFileSync(exe('keytool'), ['-genkeypair', '-v', '-keystore', 'android/keystore/sakura-fortune-release.jks', '-alias', 'sakura',
    '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000', '-storepass', pass, '-keypass', pass,
    '-dname', 'CN=Sakura Fortune, OU=Games, O=Sakura Fortune, C=US'], { stdio: 'inherit', env });
  fs.writeFileSync(props, `storeFile=keystore/sakura-fortune-release.jks\nstorePassword=${pass}\nkeyAlias=sakura\nkeyPassword=${pass}\n`);
  console.log('Created release signing key in android/keystore/ (back it up; it is needed for future updates).');
}

// build
// full, quoted path: the project folder has a space, and some shells don't search the current directory
const gradlew = path.resolve('android', process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
execSync(`"${gradlew}" assembleRelease --no-daemon --console=plain`, { cwd: 'android', stdio: 'inherit', env });

const version = JSON.parse(fs.readFileSync('package.json', 'utf8')).version;
const apk = 'android/app/build/outputs/apk/release/app-release.apk';
fs.mkdirSync('dist', { recursive: true });
const out = `dist/Sakura Fortune-${version}-android.apk`;
fs.copyFileSync(apk, out);
console.log(`\nAPK ready: ${out} (${(fs.statSync(out).size / 1048576).toFixed(1)} MB)`);
