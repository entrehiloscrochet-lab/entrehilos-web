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

NODE_BIN="$(command -v node || ls -1 "${HOME}/.nvm/versions/node/"*/bin/node 2>/dev/null | tail -n 1 || true)"
if [[ -n "$NODE_BIN" ]]; then
  ROOT_DIR="$ROOT_DIR" PUBLIC_APK="$PUBLIC_APK" "$NODE_BIN" - <<'EOF'
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const rootDir = process.env.ROOT_DIR;
const apkPath = process.env.PUBLIC_APK;
const gradlePath = path.join(rootDir, "android", "app", "build.gradle");
const metaOutPath = path.join(rootDir, "src", "lib", "admin-apk-meta.json");

const gradleTxt = fs.readFileSync(gradlePath, "utf8");
const verCodeMatch = gradleTxt.match(/versionCode\s+(\d+)/);
const verNameMatch = gradleTxt.match(/versionName\s+"([^"]+)"/);

const buf = fs.readFileSync(apkPath);
const stat = fs.statSync(apkPath);
const sha256 = crypto.createHash("sha256").update(buf).digest("hex");
const sizeBytes = stat.size;
const sizeLabel = `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;

const now = new Date();
const parts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Lima",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
}).formatToParts(now);

const getPart = (t) => parts.find((p) => p.type === t)?.value || "00";
const yyyy = getPart("year");
const mm = getPart("month");
const dd = getPart("day");
const hh24 = Number(getPart("hour")) % 24;
const min = getPart("minute");
const sec = getPart("second");

const suffix = hh24 < 12 ? "a.m." : "p.m.";
const h12 = hh24 === 0 ? 12 : hh24 > 12 ? hh24 - 12 : hh24;
const hhStr = String(hh24).padStart(2, "0");

const meta = {
  versionName: verNameMatch ? verNameMatch[1] : "1.0.0",
  versionCode: verCodeMatch ? Number(verCodeMatch[1]) : 1,
  updatedAtIso: `${yyyy}-${mm}-${dd}T${hhStr}:${min}:${sec}-05:00`,
  updatedAtLabel: `${dd}/${mm}/${yyyy} · ${h12}:${min} ${suffix}`,
  updatedAtShort: `${dd}/${mm} · ${h12}:${min} ${suffix}`,
  sizeBytes,
  sizeLabel,
  sha256,
};

fs.writeFileSync(metaOutPath, JSON.stringify(meta, null, 2) + "\n", "utf8");
console.log("[build-admin-apk] Metadata actualizada:", metaOutPath, meta.versionName, meta.updatedAtLabel);
EOF
fi

echo "[build-admin-apk] APK compilado correctamente:"
ls -lh "$DEST_APK" "$PUBLIC_APK"
