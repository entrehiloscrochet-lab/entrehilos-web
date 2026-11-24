#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

has_env_var() {
  local key="$1"
  if [[ -n "${!key:-}" ]]; then
    return 0
  fi
  for f in "${ROOT_DIR}/.env" "${ROOT_DIR}/.env.local"; do
    if [[ -f "$f" ]] && grep -qE "^[[:space:]]*(export[[:space:]]+)?${key}=" "$f"; then
      return 0
    fi
  done
  return 1
}

if ! has_env_var "NEXT_PUBLIC_SUPABASE_URL" || ! has_env_var "NEXT_PUBLIC_SUPABASE_ANON_KEY"; then
  echo "ERROR: Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env, .env.local o entorno." >&2
  exit 1
fi

export ANDROID_HOME="${ANDROID_HOME:-/home/mp/Android/Sdk}"
export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_HOME}"
export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-17-openjdk}"
export PATH="${JAVA_HOME}/bin:${ANDROID_HOME}/platform-tools:${PATH}"

echo "[build-admin-apk] Compilando APK Android 100% Nativo (Kotlin + Compose, 100% Supabase)..."
cd "${ROOT_DIR}/android"
./gradlew assembleRelease

SOURCE_APK="${ROOT_DIR}/android/app/build/outputs/apk/release/app-release.apk"
if [[ ! -f "$SOURCE_APK" ]]; then
  echo "ERROR: No se encontró el APK generado en ${SOURCE_APK}." >&2
  exit 1
fi

mkdir -p "${ROOT_DIR}/dist-apk" "${ROOT_DIR}/public/downloads"
DEST_APK="${ROOT_DIR}/dist-apk/entrehilos-admin-release.apk"
PUBLIC_APK="${ROOT_DIR}/public/downloads/entrehilos-admin.apk"
cp "$SOURCE_APK" "$DEST_APK"
cp "$SOURCE_APK" "$PUBLIC_APK"

echo "[build-admin-apk] APK compilado correctamente:"
ls -lh "$DEST_APK" "$PUBLIC_APK"
