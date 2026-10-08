#!/usr/bin/env python3
"""Poll App Store Connect until the uploaded build finishes processing."""
from __future__ import annotations

import os
import sys
import time

import jwt
import requests

API_BASE = "https://api.appstoreconnect.apple.com/v1"
POLL_INTERVAL_SEC = 30
TIMEOUT_SEC = 90 * 60


def env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        print(f"Missing env {name}", file=sys.stderr)
        sys.exit(1)
    return value


def make_token(key_id: str, issuer_id: str, key_path: str) -> str:
    with open(key_path, "rb") as fh:
        private_key = fh.read()
    now = int(time.time())
    return jwt.encode(
        {"iss": issuer_id, "exp": now + 1200, "aud": "appstoreconnect-v1"},
        private_key,
        algorithm="ES256",
        headers={"kid": key_id, "typ": "JWT"},
    )


def asc_get(session: requests.Session, path: str, params: dict | None = None) -> dict:
    url = f"{API_BASE}{path}"
    resp = session.get(url, params=params, timeout=60)
    if resp.status_code >= 400:
        print(resp.text, file=sys.stderr)
        resp.raise_for_status()
    return resp.json()


def find_app_id(session: requests.Session, bundle_id: str) -> str:
    data = asc_get(
        session,
        "/apps",
        {"filter[bundleId]": bundle_id, "limit": "1"},
    )
    apps = data.get("data") or []
    if not apps:
        raise RuntimeError(f"No App Store Connect app for bundle id {bundle_id}")
    return apps[0]["id"]


def find_build(
    session: requests.Session,
    app_id: str,
    version: str,
    build_number: str,
) -> dict:
    data = asc_get(
        session,
        "/builds",
        {
            "filter[app]": app_id,
            "filter[version]": version,
            "filter[buildNumber]": build_number,
            "limit": "1",
            "include": "preReleaseVersion",
        },
    )
    builds = data.get("data") or []
    if not builds:
        raise RuntimeError(
            f"Build not found yet for version {version} ({build_number})"
        )
    return builds[0]


def main() -> None:
    key_id = env("APP_STORE_CONNECT_API_KEY_ID")
    issuer_id = env("APP_STORE_CONNECT_ISSUER_ID")
    key_b64 = env("APP_STORE_CONNECT_API_KEY_P8_BASE64")
    bundle_id = env("IOS_BUNDLE_ID")
    version = env("MARKETING_VERSION")
    build_number = env("BUILD_NUMBER")

    key_path = os.path.join(os.environ.get("RUNNER_TEMP", "/tmp"), "asc_poll_key.p8")
    import base64

    with open(key_path, "wb") as fh:
        fh.write(base64.b64decode(key_b64))

    session = requests.Session()
    session.headers["Authorization"] = f"Bearer {make_token(key_id, issuer_id, key_path)}"
    session.headers["Content-Type"] = "application/json"

    app_id = find_app_id(session, bundle_id)
    deadline = time.time() + TIMEOUT_SEC
    build: dict | None = None

    while time.time() < deadline:
        try:
            build = find_build(session, app_id, version, build_number)
        except RuntimeError as exc:
            print(str(exc))
            time.sleep(POLL_INTERVAL_SEC)
            continue

        state = (build.get("attributes") or {}).get("processingState")
        print(f"processingState={state}")
        if state == "VALID":
            print("Build processing complete.")
            return
        if state == "INVALID":
            raise RuntimeError("Build processing failed (INVALID)")
        time.sleep(POLL_INTERVAL_SEC)

    raise TimeoutError("Timed out waiting for TestFlight processing")


if __name__ == "__main__":
    main()
