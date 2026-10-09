# iOS TestFlight (CI)

GitHub Actions workflow [`.github/workflows/ios-testflight.yml`](../.github/workflows/ios-testflight.yml) uploads builds to TestFlight when the required secrets are configured. Uploads run only when explicitly requested:

- **workflow_dispatch** — run the workflow manually from the Actions tab.
- **Push to `testflight-request/**`** — automation creates a branch such as `testflight-request/<timestamp>` from `main` to request a build.

Pushes to `main` do **not** trigger a TestFlight upload. Pull requests only run the Linux **Check signing secrets** job (no macOS runners, no upload).

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

## What to Test notes

After upload, the workflow sets TestFlight **What to Test** (en-US) from merged pull request titles since the last **successful** run of this workflow (resolved via the GitHub Actions API). If none are found, it falls back to commit subjects on `main`.

## Request branch cleanup

When the run was triggered by a `testflight-request/**` branch, the workflow attempts to delete that branch after processing completes successfully (best effort; requires `contents: write` for `GITHUB_TOKEN` on the cleanup job).

## Local splash asset

Regenerate the iOS splash from `retroCoinArt.ts`:

```bash
python3 scripts/generate-ios-splash.py
```
