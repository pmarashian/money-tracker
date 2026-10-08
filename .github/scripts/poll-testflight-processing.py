#!/usr/bin/env python3
"""Poll App Store Connect for this build and ensure an internal beta group.

Uses the App Store Connect API key (ES256 JWT via PyJWT). Never prints secrets.
"""

from __future__ import annotations

import base64
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

import jwt

API = "https://api.appstoreconnect.apple.com"
POLL_SECONDS = 25 * 60
POLL_INTERVAL_SECONDS = 20


def env(name: str) -> str:
    value = os.environ.get(name, "")
    if not value:
        print(f"Missing {name}.", file=sys.stderr)
        sys.exit(1)
    return value


def load_private_key() -> str:
    raw = base64.b64decode("".join(env("APP_STORE_CONNECT_API_KEY_P8_BASE64").split()))
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        print("p8 did not decode to a PEM private key.", file=sys.stderr)
        sys.exit(1)
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
        {
            "iss": ISSUER_ID,
            "iat": now,
            "exp": now + 15 * 60,
            "aud": "appstoreconnect-v1",
        },
        PRIVATE_KEY,
        algorithm="ES256",
        headers={"kid": KEY_ID, "typ": "JWT"},
    )
    if isinstance(encoded, bytes):
        return encoded.decode("utf-8")
    return encoded


def api(method: str, path: str, body: dict | None = None) -> tuple[int, dict | None, str]:
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
            parsed = json.loads(raw) if raw else None
            return res.status, parsed if isinstance(parsed, dict) else None, ""
    except urllib.error.HTTPError as err:
        raw = err.read().decode("utf-8", errors="replace")
        parsed: dict | None
        try:
            loaded = json.loads(raw) if raw else None
            parsed = loaded if isinstance(loaded, dict) else None
        except json.JSONDecodeError:
            parsed = None
        detail = error_detail(parsed) if parsed else ""
        return err.code, parsed, detail


def error_detail(payload: dict) -> str:
    errors = payload.get("errors")
    if not isinstance(errors, list) or not errors:
        return ""
    first = errors[0]
    if not isinstance(first, dict):
        return ""
    title = str(first.get("title") or "")
    detail = str(first.get("detail") or "")
    status = str(first.get("status") or "")
    return " ".join(part for part in (status, title, detail) if part).strip()


def write_summary(lines: list[str]) -> None:
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    text = "\n".join(lines) + "\n"
    if path:
        with open(path, "a", encoding="utf-8") as handle:
            handle.write(text)
    sys.stdout.write(text)


def ensure_internal_group(app_id: str) -> str:
    status, payload, detail = api("GET", f"/v1/apps/{urllib.parse.quote(app_id)}/betaGroups?limit=200")
    if status == 403:
        message = (
            "App Store Connect returned 403 listing beta groups. "
            "The API key may not be allowed to manage TestFlight groups. Continuing."
        )
        print(f"::warning title=Internal beta group::{message}")
        print(message)
        return "list skipped (403)"
    if status != 200 or payload is None:
        message = f"Could not list beta groups (HTTP {status}). {detail}".strip()
        print(f"::warning title=Internal beta group::{message}")
        print(message)
        return f"list failed (HTTP {status})"

    groups = payload.get("data")
    if isinstance(groups, list):
        for group in groups:
            if not isinstance(group, dict):
                continue
            attributes = group.get("attributes")
            if isinstance(attributes, dict) and attributes.get("isInternalGroup") is True:
                name = attributes.get("name") or "internal"
                print(f"Internal beta group already present ({name}).")
                return f"already present ({name})"

    # JSON:API envelope. Attributes match the requested Internal group.
    created, _, create_detail = api(
        "POST",
        "/v1/betaGroups",
        {
            "data": {
                "type": "betaGroups",
                "attributes": {
                    "name": "Internal",
                    "isInternalGroup": True,
                    "hasAccessToAllBuilds": True,
                },
                "relationships": {
                    "app": {"data": {"type": "apps", "id": app_id}},
                },
            }
        },
    )
    if created in (201, 200):
        print("Created internal beta group Internal.")
        return "created Internal"
    if created == 403:
        message = (
            "App Store Connect returned 403 creating the Internal beta group. "
            "The API key may not be allowed to manage TestFlight groups. "
            "This does not fail the run."
        )
        print(f"::warning title=Internal beta group::{message}")
        print(message)
        return "create skipped (403)"
    if created == 409:
        print("Internal beta group already exists (409).")
        return "already exists (409)"
    message = f"Creating the Internal beta group returned HTTP {created}. {create_detail}".strip()
    print(f"::warning title=Internal beta group::{message}")
    print(message)
    return f"create failed (HTTP {created})"


def find_app_id() -> str:
    query = "filter[bundleId]=" + urllib.parse.quote(BUNDLE_ID, safe="") + "&limit=2"
    status, payload, detail = api("GET", "/v1/apps?" + query)
    if status != 200 or payload is None:
        print(f"Could not look up app {BUNDLE_ID} (HTTP {status}). {detail}".strip(), file=sys.stderr)
        sys.exit(1)
    apps = payload.get("data")
    if not isinstance(apps, list) or not apps:
        print(f"No App Store Connect app for bundle id {BUNDLE_ID}.", file=sys.stderr)
        sys.exit(1)
    app_id = apps[0].get("id") if isinstance(apps[0], dict) else None
    if not isinstance(app_id, str) or not app_id:
        print(f"App Store Connect app id missing for {BUNDLE_ID}.", file=sys.stderr)
        sys.exit(1)
    return app_id


def poll_processing(app_id: str) -> tuple[str, int]:
    path = (
        "/v1/builds?filter[app]="
        + urllib.parse.quote(app_id, safe="")
        + "&filter[version]="
        + urllib.parse.quote(BUILD_NUMBER, safe="")
        + "&limit=10"
    )
    deadline = time.monotonic() + POLL_SECONDS
    last_state = "not listed"
    while True:
        status, payload, detail = api("GET", path)
        if status != 200 or payload is None:
            print(f"Build query failed (HTTP {status}). {detail}".strip(), file=sys.stderr)
            return f"query failed (HTTP {status})", 1
        builds = payload.get("data")
        state = None
        if isinstance(builds, list):
            for build in builds:
                if not isinstance(build, dict):
                    continue
                attributes = build.get("attributes")
                if isinstance(attributes, dict) and attributes.get("processingState"):
                    state = str(attributes["processingState"])
                    break
        if state:
            last_state = state
            print(f"processingState={state}")
            if state == "VALID":
                return state, 0
            if state in ("FAILED", "INVALID"):
                return state, 1
        else:
            print(f"processingState=not listed yet for build {BUILD_NUMBER}")
        if time.monotonic() >= deadline:
            return last_state, 0
        time.sleep(POLL_INTERVAL_SECONDS)


def main() -> int:
    app_id = find_app_id()
    print(f"App Store Connect app id {app_id} for {BUNDLE_ID}.")
    group_result = ensure_internal_group(app_id)
    state, code = poll_processing(app_id)
    write_summary(
        [
            "### App Store Connect processing",
            f"App `{app_id}` (`{BUNDLE_ID}`), build `{BUILD_NUMBER}`.",
            f"processingState: `{state}`.",
            f"Internal beta group: {group_result}.",
        ]
    )
    return code


if __name__ == "__main__":
    sys.exit(main())
