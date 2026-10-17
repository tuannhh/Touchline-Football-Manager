#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -z "${JAVA_HOME:-}" ]; then
  for candidate in "$PWD"/.toolchains/jdk-*/Contents/Home; do
    if [ -x "$candidate/bin/java" ]; then export JAVA_HOME="$candidate"; break; fi
  done
fi
export ANDROID_HOME="${ANDROID_HOME:-$PWD/.toolchains/android-sdk}"
export GRADLE_USER_HOME="${GRADLE_USER_HOME:-$PWD/.toolchains/gradle}"
test -x "${JAVA_HOME:?Set JAVA_HOME to JDK 21}/bin/java"
test -d "$ANDROID_HOME/platforms/android-36"
printf 'sdk.dir=%s\n' "$ANDROID_HOME" > android/local.properties
npm run build:android:web
android/gradlew -p android assembleRelease --console=plain
mkdir -p .android-signing artifacts
chmod 700 .android-signing
if [ ! -f .android-signing/touchline.jks ]; then
  openssl rand -base64 32 > .android-signing/store.pass
  chmod 600 .android-signing/store.pass
  "$JAVA_HOME/bin/keytool" -genkeypair -keystore .android-signing/touchline.jks -alias touchline -keyalg RSA -keysize 3072 -validity 10000 -dname 'CN=Touchline Local Release' -storepass:file .android-signing/store.pass -keypass:file .android-signing/store.pass
  chmod 600 .android-signing/touchline.jks
fi
version=$(node -p "JSON.parse(require('fs').readFileSync('package.json')).version")
apk="artifacts/Touchline-$version-android.apk"
"$ANDROID_HOME/build-tools/36.0.0/zipalign" -f -p 4 android/app/build/outputs/apk/release/app-release-unsigned.apk artifacts/aligned.apk
"$ANDROID_HOME/build-tools/36.0.0/apksigner" sign --ks .android-signing/touchline.jks --ks-key-alias touchline --ks-pass file:.android-signing/store.pass --out "$apk" artifacts/aligned.apk
"$ANDROID_HOME/build-tools/36.0.0/apksigner" verify --verbose "$apk"
rm artifacts/aligned.apk
(cd artifacts && shasum -a 256 "Touchline-$version-android.apk" > "Touchline-$version-android.apk.sha256")
echo "APK: $apk"
