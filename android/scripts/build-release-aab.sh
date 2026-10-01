#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "${JAVA_HOME:-}" && -d "/Applications/Android Studio.app/Contents/jbr/Contents/Home" ]]; then
  export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
fi

./gradlew bundleRelease "$@"

OUT="$ROOT/app/build/outputs/bundle/release/app-release.aab"
DEST="$ROOT/../dist/android"
mkdir -p "$DEST"
cp "$OUT" "$DEST/rentados-$(grep versionName app/build.gradle.kts | head -1 | sed 's/.*"\(.*\)".*/\1/')-$(grep versionCode app/build.gradle.kts | head -1 | awk '{print $3}').aab"
echo "AAB listo en $DEST"
