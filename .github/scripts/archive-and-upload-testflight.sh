#!/usr/bin/env bash
# Archive Capacitor iOS app and upload to TestFlight (manual signing + ASC API key).
set -euo pipefail

: "${APP_STORE_CONNECT_API_KEY_ID:?}"
: "${APP_STORE_CONNECT_ISSUER_ID:?}"
: "${APP_STORE_CONNECT_API_KEY_P8_BASE64:?}"
: "${IOS_DISTRIBUTION_CERTIFICATE_P12_BASE64:?}"
: "${IOS_DISTRIBUTION_CERTIFICATE_PASSWORD:?}"
: "${IOS_PROVISIONING_PROFILE_BASE64:?}"
: "${IOS_BUNDLE_ID:?}"
: "${DEVELOPMENT_TEAM:?}"
: "${IOS_PROJECT:?}"
: "${IOS_SCHEME:?}"
: "${BUILD_NUMBER:?}"
: "${MARKETING_VERSION:?}"

IOS_REQUIRES_PUSH="${IOS_REQUIRES_PUSH:-false}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
IOS_PROJECT_PATH="${REPO_ROOT}/${IOS_PROJECT}"
PACKAGES_DIR="${RUNNER_TEMP:-/tmp}/SourcePackages"
ARCHIVE_PATH="${RUNNER_TEMP:-/tmp}/MoneyTracker.xcarchive"
EXPORT_DIR="${RUNNER_TEMP:-/tmp}/export"
KEYCHAIN_PATH="${RUNNER_TEMP:-/tmp}/app-signing.keychain-db"
API_KEY_PATH="${RUNNER_TEMP:-/tmp}/AuthKey_${APP_STORE_CONNECT_API_KEY_ID}.p8"
PROFILE_PATH="${RUNNER_TEMP:-/tmp}/profile.mobileprovision"
P12_PATH="${RUNNER_TEMP:-/tmp}/distribution.p12"

mkdir -p "$PACKAGES_DIR" "$EXPORT_DIR"
mkdir -p "$HOME/Library/MobileDevice/Provisioning Profiles"

echo "$APP_STORE_CONNECT_API_KEY_P8_BASE64" | base64 --decode > "$API_KEY_PATH"
echo "$IOS_PROVISIONING_PROFILE_BASE64" | base64 --decode > "$PROFILE_PATH"
echo "$IOS_DISTRIBUTION_CERTIFICATE_P12_BASE64" | base64 --decode > "$P12_PATH"

PROFILE_PLIST="$(security cms -D -i "$PROFILE_PATH")"
PROFILE_UUID="$(/usr/libexec/PlistBuddy -c 'Print UUID' /dev/stdin <<<"$PROFILE_PLIST")"
PROFILE_NAME="$(/usr/libexec/PlistBuddy -c 'Print Name' /dev/stdin <<<"$PROFILE_PLIST")"
cp "$PROFILE_PATH" "$HOME/Library/MobileDevice/Provisioning Profiles/${PROFILE_UUID}.mobileprovision"

security create-keychain -p "" "$KEYCHAIN_PATH"
security set-keychain-settings -lut 21600 "$KEYCHAIN_PATH"
security unlock-keychain -p "" "$KEYCHAIN_PATH"
security import "$P12_PATH" -k "$KEYCHAIN_PATH" -P "$IOS_DISTRIBUTION_CERTIFICATE_PASSWORD" \
  -T /usr/bin/codesign -T /usr/bin/security
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "" "$KEYCHAIN_PATH"
EXISTING_KEYCHAINS="$(security list-keychains -d user | tr -d '"')"
# shellcheck disable=SC2086
security list-keychains -d user -s "$KEYCHAIN_PATH" $EXISTING_KEYCHAINS

echo "Resolving Swift packages in ${PACKAGES_DIR}"
xcodebuild -resolvePackageDependencies \
  -project "$IOS_PROJECT_PATH" \
  -scheme "$IOS_SCHEME" \
  -clonedSourcePackagesDirPath "$PACKAGES_DIR" \
  -disableAutomaticPackageResolution

SIGN_APP_ONLY=(
  "CODE_SIGN_STYLE=Manual"
  "CODE_SIGN_IDENTITY=Apple Distribution"
  "DEVELOPMENT_TEAM=${DEVELOPMENT_TEAM}"
  "PROVISIONING_PROFILE_SPECIFIER=${PROFILE_NAME}"
  "CURRENT_PROJECT_VERSION=${BUILD_NUMBER}"
  "MARKETING_VERSION=${MARKETING_VERSION}"
  "CODE_SIGNING_ALLOWED=NO"
  "CODE_SIGNING_ALLOWED[sdk=iphoneos*][arch=*][target=App]=YES"
  "CODE_SIGN_STYLE[sdk=iphoneos*][arch=*][target=App]=Manual"
  "CODE_SIGN_IDENTITY[sdk=iphoneos*][arch=*][target=App]=Apple Distribution"
  "PROVISIONING_PROFILE_SPECIFIER[sdk=iphoneos*][arch=*][target=App]=${PROFILE_NAME}"
  "DEVELOPMENT_TEAM[sdk=iphoneos*][arch=*][target=App]=${DEVELOPMENT_TEAM}"
)

echo "Archiving ${IOS_SCHEME} (build ${BUILD_NUMBER}, version ${MARKETING_VERSION})"
xcodebuild archive \
  -project "$IOS_PROJECT_PATH" \
  -scheme "$IOS_SCHEME" \
  -configuration Release \
  -destination "generic/platform=iOS" \
  -archivePath "$ARCHIVE_PATH" \
  -clonedSourcePackagesDirPath "$PACKAGES_DIR" \
  -disableAutomaticPackageResolution \
  -skipPackagePluginValidation \
  OTHER_CODE_SIGN_FLAGS="--keychain ${KEYCHAIN_PATH}" \
  "${SIGN_APP_ONLY[@]}"

EXPORT_PLIST="${EXPORT_DIR}/ExportOptions.plist"
EXPORT_PLIST="$EXPORT_PLIST" \
  IOS_BUNDLE_ID="$IOS_BUNDLE_ID" \
  DEVELOPMENT_TEAM="$DEVELOPMENT_TEAM" \
  PROFILE_NAME="$PROFILE_NAME" \
  IOS_REQUIRES_PUSH="$IOS_REQUIRES_PUSH" \
  /usr/bin/python3 - <<'PY'
import os
import plistlib

plist = {
    "method": "app-store-connect",
    "destination": "upload",
    "signingStyle": "manual",
    "teamID": os.environ["DEVELOPMENT_TEAM"],
    "uploadSymbols": True,
    "signingCertificate": "Apple Distribution",
    "provisioningProfiles": {
        os.environ["IOS_BUNDLE_ID"]: os.environ["PROFILE_NAME"]
    },
}
if os.environ.get("IOS_REQUIRES_PUSH", "false").lower() != "true":
    plist["manageAppVersionAndBuildNumber"] = False
with open(os.environ["EXPORT_PLIST"], "wb") as fh:
    plistlib.dump(plist, fh)
PY

echo "Exporting and uploading to App Store Connect"
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_DIR" \
  -exportOptionsPlist "$EXPORT_PLIST" \
  -authenticationKeyPath "$API_KEY_PATH" \
  -authenticationKeyID "$APP_STORE_CONNECT_API_KEY_ID" \
  -authenticationKeyIssuerID "$APP_STORE_CONNECT_ISSUER_ID" \
  OTHER_CODE_SIGN_FLAGS="--keychain ${KEYCHAIN_PATH}"

echo "Upload complete for ${MARKETING_VERSION} (${BUILD_NUMBER})"
