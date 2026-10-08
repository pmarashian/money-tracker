#!/bin/bash
# Archive a signed iOS build and upload it to TestFlight (Money Tracker).
set -euo pipefail
umask 077
: "${APP_STORE_CONNECT_API_KEY_ID:?}"
: "${APP_STORE_CONNECT_ISSUER_ID:?}"
: "${APP_STORE_CONNECT_API_KEY_P8_BASE64:?}"
: "${IOS_DISTRIBUTION_CERTIFICATE_P12_BASE64:?}"
: "${IOS_DISTRIBUTION_CERTIFICATE_PASSWORD:?}"
: "${IOS_PROVISIONING_PROFILE_BASE64:?}"
: "${IOS_BUNDLE_ID:?}"

IOS_REQUIRES_PUSH="${IOS_REQUIRES_PUSH:-false}"

BUNDLE_ID="$IOS_BUNDLE_ID"
TEAM_ID="DEW8E9PGR8"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WORK="${RUNNER_TEMP}/testflight"
KEYCHAIN_PATH="${WORK}/signing.keychain-db"
KEYCHAIN_PASSWORD="$(openssl rand -base64 32)"
: "${BUILD_NUMBER:?BUILD_NUMBER is required (GitHub Actions run number)}"
mkdir -p "$WORK"
P8_PATH="${WORK}/AuthKey.p8"
P12_PATH="${WORK}/distribution.p12"
PROFILE_PATH="${WORK}/profile.mobileprovision"
EXPORT_PLIST="${WORK}/ExportOptions.plist"
ARCHIVE_PATH="${WORK}/MoneyTracker.xcarchive"
EXPORT_DIR="${WORK}/export"

cleanup() {
  if [ -n "${APP_STORE_CONNECT_API_KEY_ID:-}" ]; then
    rm -f "${HOME}/.appstoreconnect/private_keys/AuthKey_${APP_STORE_CONNECT_API_KEY_ID}.p8"
  fi
  if [ -f "$KEYCHAIN_PATH" ]; then
    security delete-keychain "$KEYCHAIN_PATH" >/dev/null 2>&1 || true
  fi
  rm -rf "$WORK"
}
trap cleanup EXIT

decode_b64() {
  local dest="$1"
  local value="$2"
  printf '%s' "$value" | tr -d '[:space:]' | base64 -D > "$dest"
}

decode_b64 "$P8_PATH" "$APP_STORE_CONNECT_API_KEY_P8_BASE64"
decode_b64 "$P12_PATH" "$IOS_DISTRIBUTION_CERTIFICATE_P12_BASE64"
decode_b64 "$PROFILE_PATH" "$IOS_PROVISIONING_PROFILE_BASE64"

if ! grep -q "PRIVATE KEY" "$P8_PATH"; then
  echo "p8 did not decode to a PEM private key."
  exit 1
fi

PROFILE_PLIST="${WORK}/profile.plist"
security cms -D -i "$PROFILE_PATH" -o "$PROFILE_PLIST"
PROFILE_NAME="$(plutil -extract Name raw "$PROFILE_PLIST")"
PROFILE_UUID="$(plutil -extract UUID raw "$PROFILE_PLIST")"
APP_IDENTIFIER="$(plutil -extract Entitlements.application-identifier raw "$PROFILE_PLIST")"
GET_TASK_ALLOW="$(plutil -extract Entitlements.get-task-allow raw "$PROFILE_PLIST")"

if [ "$APP_IDENTIFIER" != "${TEAM_ID}.${BUNDLE_ID}" ]; then
  echo "Profile is for ${APP_IDENTIFIER}, expected ${TEAM_ID}.${BUNDLE_ID}."
  exit 1
fi
if [ "$GET_TASK_ALLOW" != "false" ]; then
  echo "Profile looks like a development profile."
  exit 1
fi

if [ "$IOS_REQUIRES_PUSH" = "true" ]; then
  PROFILE_APS="$(plutil -extract Entitlements.aps-environment raw "$PROFILE_PLIST" 2>/dev/null || true)"
  if [ "$PROFILE_APS" != "production" ]; then
    echo "Profile aps-environment is '${PROFILE_APS:-missing}', expected production."
    exit 1
  fi
fi

install -d "${HOME}/.appstoreconnect/private_keys"
install -m 600 "$P8_PATH" "${HOME}/.appstoreconnect/private_keys/AuthKey_${APP_STORE_CONNECT_API_KEY_ID}.p8"
install -d "${HOME}/Library/MobileDevice/Provisioning Profiles"
install -m 600 "$PROFILE_PATH" "${HOME}/Library/MobileDevice/Provisioning Profiles/${PROFILE_UUID}.mobileprovision"

curl -fsSL -o "${WORK}/AppleWWDRCAG3.cer" "https://www.apple.com/certificateauthority/AppleWWDRCAG3.cer"
curl -fsSL -o "${WORK}/AppleWWDRCAG4.cer" "https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer"

security create-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"
security set-keychain-settings -lut 21600 "$KEYCHAIN_PATH"
security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"
security import "${WORK}/AppleWWDRCAG3.cer" -k "$KEYCHAIN_PATH" -t cert -T /usr/bin/codesign
security import "${WORK}/AppleWWDRCAG4.cer" -k "$KEYCHAIN_PATH" -t cert -T /usr/bin/codesign

if ! security import "$P12_PATH" -k "$KEYCHAIN_PATH" -P "$IOS_DISTRIBUTION_CERTIFICATE_PASSWORD" -f pkcs12 -T /usr/bin/codesign -T /usr/bin/security; then
  echo "macOS could not import the distribution .p12."
  exit 1
fi

security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH" >/dev/null
default_keychain="$(security default-keychain | tr -d '"' | xargs)"
security list-keychains -d user -s "$KEYCHAIN_PATH" "$default_keychain"

IDENTITY="$(security find-identity -v -p codesigning "$KEYCHAIN_PATH" | sed -n 's/.*"\(Apple Distribution:.*\)"/\1/p' | head -1)"
if [ -z "$IDENTITY" ]; then
  IDENTITY="$(security find-identity -v -p codesigning "$KEYCHAIN_PATH" | sed -n 's/.*"\(iPhone Distribution:.*\)"/\1/p' | head -1)"
fi
if [ -z "$IDENTITY" ]; then
  echo "No Apple Distribution identity in the .p12."
  exit 1
fi

cat > "$EXPORT_PLIST" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict/></plist>
EOF
/usr/libexec/PlistBuddy -c "Add :method string app-store-connect" "$EXPORT_PLIST"
/usr/libexec/PlistBuddy -c "Add :teamID string ${TEAM_ID}" "$EXPORT_PLIST"
/usr/libexec/PlistBuddy -c "Add :signingStyle string manual" "$EXPORT_PLIST"
/usr/libexec/PlistBuddy -c "Add :signingCertificate string Apple Distribution" "$EXPORT_PLIST"
/usr/libexec/PlistBuddy -c "Add :uploadSymbols bool true" "$EXPORT_PLIST"
/usr/libexec/PlistBuddy -c "Add :manageAppVersionAndBuildNumber bool false" "$EXPORT_PLIST"
/usr/libexec/PlistBuddy -c "Add :provisioningProfiles dict" "$EXPORT_PLIST"
/usr/libexec/PlistBuddy -c "Add :provisioningProfiles:${BUNDLE_ID} string ${PROFILE_NAME}" "$EXPORT_PLIST"

ARCHIVE_ARGS=(
  -project "$ROOT/frontend/ios/App/App.xcodeproj"
  -scheme App
  -configuration Release
  -destination "generic/platform=iOS"
  -archivePath "$ARCHIVE_PATH"
  -derivedDataPath "${WORK}/DerivedData"
  CODE_SIGN_STYLE=Manual
  DEVELOPMENT_TEAM="$TEAM_ID"
  CODE_SIGN_IDENTITY="$IDENTITY"
  PROVISIONING_PROFILE_SPECIFIER="$PROFILE_NAME"
  CURRENT_PROJECT_VERSION="$BUILD_NUMBER"
  OTHER_CODE_SIGN_FLAGS="--keychain ${KEYCHAIN_PATH}"
)

if [ "$IOS_REQUIRES_PUSH" = "true" ]; then
  PROD_ENTITLEMENTS="${WORK}/App-production.entitlements"
  cp "$ROOT/frontend/ios/App/App/App.entitlements" "$PROD_ENTITLEMENTS"
  plutil -replace aps-environment -string production "$PROD_ENTITLEMENTS"
  ARCHIVE_ARGS+=(CODE_SIGN_ENTITLEMENTS="$PROD_ENTITLEMENTS")
fi

cd "$ROOT"
xcodebuild "${ARCHIVE_ARGS[@]}" archive
xcodebuild -exportArchive -archivePath "$ARCHIVE_PATH" -exportPath "$EXPORT_DIR" -exportOptionsPlist "$EXPORT_PLIST"

IPA="$(find "$EXPORT_DIR" -name '*.ipa' -print -quit)"
if [ -z "$IPA" ]; then
  echo "Export did not produce an .ipa."
  exit 1
fi

if [ "$IOS_REQUIRES_PUSH" = "true" ]; then
  UNZIP_DIR="${WORK}/ipa-inspect"
  mkdir -p "$UNZIP_DIR"
  unzip -q "$IPA" -d "$UNZIP_DIR"
  APP_PLIST="$(find "$UNZIP_DIR" -path '*/Payload/*.app/embedded.mobileprovision' -print -quit)"
  if [ -z "$APP_PLIST" ]; then
    echo "Could not find embedded.mobileprovision in exported IPA."
    exit 1
  fi
  EMBED_PLIST="${WORK}/embedded-profile.plist"
  security cms -D -i "$APP_PLIST" -o "$EMBED_PLIST"
  EMBED_APS="$(plutil -extract Entitlements.aps-environment raw "$EMBED_PLIST" 2>/dev/null || true)"
  if [ "$EMBED_APS" != "production" ]; then
    echo "Signed app aps-environment is '${EMBED_APS:-missing}', expected production."
    exit 1
  fi
fi

xcrun altool --upload-app --type ios --file "$IPA" --apiKey "$APP_STORE_CONNECT_API_KEY_ID" --apiIssuer "$APP_STORE_CONNECT_ISSUER_ID"

if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    echo "### TestFlight upload accepted"
    echo "Build number \`${BUILD_NUMBER}\` uploaded for \`${BUNDLE_ID}\`."
  } >> "$GITHUB_STEP_SUMMARY"
fi
