#!/usr/bin/env bash
# Builds ClaudeMap.apk without Gradle, using aapt2 + javac + d8 + apksigner.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
BUILD="$ROOT/build"
SDK="${ANDROID_HOME:-/opt/android-sdk-extra/android-sdk}"
BT="${BUILD_TOOLS:-/opt/android-sdk-extra/build-tools/34.0.4}"
PLATFORM="$SDK/platforms/android-33/android.jar"
PKG=com.claudemap.app

AAPT2="$BT/aapt2"
D8="$BT/d8"
ZIPALIGN="$BT/zipalign"
APKSIGNER="$BT/apksigner"

[ -x "$AAPT2" ]    || { echo "missing aapt2 at $AAPT2"; exit 1; }
[ -x "$D8" ]       || { echo "missing d8 at $D8"; exit 1; }
[ -x "$ZIPALIGN" ] || { echo "missing zipalign at $ZIPALIGN"; exit 1; }
[ -f "$PLATFORM" ] || { echo "missing android.jar at $PLATFORM"; exit 1; }

rm -rf "$BUILD"
mkdir -p "$BUILD/compiled-res" "$BUILD/classes" "$BUILD/dex" "$BUILD/gen"

echo "==> aapt2 compile resources"
"$AAPT2" compile --dir "$ROOT/res" -o "$BUILD/compiled-res.zip"

echo "==> aapt2 link (generate R.java + base APK)"
"$AAPT2" link \
    -o "$BUILD/base.apk" \
    -I "$PLATFORM" \
    --manifest "$ROOT/AndroidManifest.xml" \
    --java "$BUILD/gen" \
    --min-sdk-version 21 \
    --target-sdk-version 34 \
    -A "$ROOT/assets" \
    -R "$BUILD/compiled-res.zip" \
    --auto-add-overlay

echo "==> javac"
JAVA_SRCS=$(find "$ROOT/src" "$BUILD/gen" -name '*.java')
javac -source 1.8 -target 1.8 \
      -bootclasspath "$PLATFORM" \
      -classpath "$PLATFORM" \
      -d "$BUILD/classes" \
      $JAVA_SRCS

echo "==> d8 (dex)"
CLASS_FILES=$(find "$BUILD/classes" -name '*.class')
"$D8" --min-api 21 --lib "$PLATFORM" --output "$BUILD/dex" $CLASS_FILES

echo "==> assemble unsigned APK"
cp "$BUILD/base.apk" "$BUILD/unsigned.apk"
( cd "$BUILD/dex" && zip -q -r "$BUILD/unsigned.apk" classes.dex )

echo "==> zipalign"
"$ZIPALIGN" -f -p 4 "$BUILD/unsigned.apk" "$BUILD/aligned.apk"

echo "==> ensure debug keystore"
KEYSTORE="$ROOT/build/debug.keystore"
if [ ! -f "$KEYSTORE" ]; then
    keytool -genkeypair -v \
        -keystore "$KEYSTORE" \
        -storepass android \
        -keypass android \
        -alias androiddebugkey \
        -dname "CN=Android Debug,O=Android,C=US" \
        -keyalg RSA -keysize 2048 -validity 10000 >/dev/null
fi

echo "==> apksigner sign"
"$APKSIGNER" sign \
    --ks "$KEYSTORE" \
    --ks-pass pass:android \
    --key-pass pass:android \
    --ks-key-alias androiddebugkey \
    --out "$ROOT/ClaudeMap.apk" \
    "$BUILD/aligned.apk"

echo "==> verify"
"$APKSIGNER" verify --print-certs "$ROOT/ClaudeMap.apk" | head -3

echo "==> done: $ROOT/ClaudeMap.apk ($(du -h "$ROOT/ClaudeMap.apk" | cut -f1))"
