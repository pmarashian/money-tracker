# iOS TestFlight (CI)

GitHub Actions workflow [`.github/workflows/ios-testflight.yml`](../.github/workflows/ios-testflight.yml) uploads **main** builds to TestFlight when the required secrets are configured. Pull requests only run the secret gate (no upload).

## Repository secrets

Configure these in the repo (or organization) **Settings → Secrets and variables → Actions**:

| Secret | Notes |
| --- | --- |
| `APP_STORE_CONNECT_API_KEY_ID` | Shared team secret (same value as Clans / Ripple) |
| `APP_STORE_CONNECT_ISSUER_ID` | Shared team secret |
| `APP_STORE_CONNECT_API_KEY_P8_BASE64` | Shared team secret |
| `IOS_DISTRIBUTION_CERTIFICATE_P12_BASE64` | Shared team secret |
| `IOS_DISTRIBUTION_CERTIFICATE_PASSWORD` | Shared team secret |
| `MONEY_TRACKER_IOS_PROVISIONING_PROFILE_BASE64` | **Money Tracker only** — App Store distribution profile for `com.phillipmarashian.moneytracker` |

Until all six are present, the workflow logs **TestFlight skipped** and exits successfully.

## Local splash asset

Regenerate the iOS splash from `retroCoinArt.ts`:

```bash
python3 scripts/generate-ios-splash.py
```
