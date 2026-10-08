#!/usr/bin/env python3
"""Set en-US TestFlight "What to Test" (whatsNew) for the uploaded build."""

from __future__ import annotations

import base64
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import jwt

API = "https://api.appstoreconnect.apple.com"
LOCALE = "en-US"
ROOT = Path(__file__).resolve().parents[2]
NOTES_PATH = ROOT / "WHAT_TO_TEST.txt"


def env(name: str) -> str:
    value = os.environ.get(name, "")
    if not value:
        print(f"Missing {name}.", file=sys.stderr)
        sys.exit(1)
    return value


def load_private_key() -> str:
    raw = base64.b64decode("".join(env("APP_STORE_CONNECT_API_KEY_P8_BASE64").split()))
    text = raw.decode("utf-8")
    if "PRIVATE KEY" not in text:
        print("p8 did not decode to a PEM private key.", file=sys.stderr)
        sys.exit(1)
    return text


PRIVATE_KEY = load_private_key()
KEY_ID = env("APP_STORE_CONNECT_API_KEY_ID")
ISSUER_ID = env("APP_STORE_CONNECT_ISSUER_ID")
BUILD_NUMBER = env("BUILD_NUMBER")
BUNDLE_ID = env("IOS_BUNDLE_ID")


def token() -> str:
    now = int(time.time())
    encoded = jwt.encode(
        {"iss": ISSUER_ID, "iat": now, "exp": now + 15 * 60, "aud": "appstoreconnect-v1"},
        PRIVATE_KEY,
        algorithm="ES256",
        headers={"kid": KEY_ID, "typ": "JWT"},
    )
    return encoded.decode("utf-8") if isinstance(encoded, bytes) else encoded


def api(method: str, path: str, body: dict | None = None) -> tuple[int, dict | None]:
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        API + path,
        data=data,
        method=method,
        headers={
            "Authorization": "Bearer " + token(),
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            raw = res.read().decode("utf-8")
            return res.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as err:
        raw = err.read().decode("utf-8", errors="replace")
        try:
            return err.code, json.loads(raw) if raw else None
        except json.JSONDecodeError:
            return err.code, None


def find_app_id() -> str:
    query = "filter[bundleId]=" + urllib.parse.quote(BUNDLE_ID, safe="") + "&limit=1"
    status, payload = api("GET", "/v1/apps?" + query)
    if status != 200 or not payload:
        print(f"App lookup failed (HTTP {status}).", file=sys.stderr)
        sys.exit(1)
    apps = payload.get("data") or []
    if not apps:
        print(f"No app for bundle id {BUNDLE_ID}.", file=sys.stderr)
        sys.exit(1)
    return str(apps[0]["id"])


def find_build_id(app_id: str) -> str:
    path = (
        "/v1/builds?filter[app]="
        + urllib.parse.quote(app_id, safe="")
        + "&filter[version]="
        + urllib.parse.quote(BUILD_NUMBER, safe="")
        + "&limit=1"
    )
    status, payload = api("GET", path)
    if status != 200 or not payload:
        print(f"Build lookup failed (HTTP {status}).", file=sys.stderr)
        sys.exit(1)
    builds = payload.get("data") or []
    if not builds:
        print(f"Build {BUILD_NUMBER} not found yet.", file=sys.stderr)
        sys.exit(1)
    return str(builds[0]["id"])


def load_whats_new() -> str:
    if not NOTES_PATH.is_file():
        print(f"Missing {NOTES_PATH}.", file=sys.stderr)
        sys.exit(1)
    text = NOTES_PATH.read_text(encoding="utf-8")
    if text != text.strip("\n") or not text.strip():
        print("WHAT_TO_TEST.txt must be non-empty with no leading/trailing blank lines.", file=sys.stderr)
        sys.exit(1)
    return text


def upsert_localization(build_id: str, whats_new: str) -> None:
    status, payload = api("GET", f"/v1/builds/{urllib.parse.quote(build_id, safe='')}/betaBuildLocalizations")
    existing_id: str | None = None
    if status == 200 and payload:
        for row in payload.get("data") or []:
            attrs = row.get("attributes") or {}
            if attrs.get("locale") == LOCALE:
                existing_id = str(row["id"])
                break

    if existing_id:
        status, _ = api(
            "PATCH",
            f"/v1/betaBuildLocalizations/{urllib.parse.quote(existing_id, safe='')}",
            {"data": {"type": "betaBuildLocalizations", "id": existing_id, "attributes": {"whatsNew": whats_new}}},
        )
        if status not in (200, 201):
            print(f"PATCH betaBuildLocalizations failed (HTTP {status}).", file=sys.stderr)
            sys.exit(1)
        print(f"Updated {LOCALE} whatsNew for build {BUILD_NUMBER}.")
        return

    status, _ = api(
        "POST",
        "/v1/betaBuildLocalizations",
        {
            "data": {
                "type": "betaBuildLocalizations",
                "attributes": {"locale": LOCALE, "whatsNew": whats_new},
                "relationships": {"build": {"data": {"type": "builds", "id": build_id}}},
            }
        },
    )
    if status not in (200, 201):
        print(f"POST betaBuildLocalizations failed (HTTP {status}).", file=sys.stderr)
        sys.exit(1)
    print(f"Created {LOCALE} whatsNew for build {BUILD_NUMBER}.")


def main() -> int:
    whats_new = load_whats_new()
    app_id = find_app_id()
    build_id = find_build_id(app_id)
    upsert_localization(build_id, whats_new)
    return 0


if __name__ == "__main__":
    sys.exit(main())
