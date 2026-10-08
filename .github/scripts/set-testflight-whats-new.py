#!/usr/bin/env python3
"""Set TestFlight What to Test from merged PR titles (fallback: commit subjects)."""
from __future__ import annotations

import base64
import json
import os
import subprocess
import sys
import time
from typing import Any

import jwt
import requests

API_BASE = "https://api.appstoreconnect.apple.com/v1"
MAX_WHATS_NEW = 4000
WORKFLOW_FILE = "ios-testflight.yml"


def env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def require(name: str) -> str:
    value = env(name)
    if not value:
        print(f"Missing env {name}", file=sys.stderr)
        sys.exit(1)
    return value


def make_token(key_id: str, issuer_id: str, key_bytes: bytes) -> str:
    now = int(time.time())
    return jwt.encode(
        {"iss": issuer_id, "exp": now + 1200, "aud": "appstoreconnect-v1"},
        key_bytes,
        algorithm="ES256",
        headers={"kid": key_id, "typ": "JWT"},
    )


def asc_request(
    session: requests.Session,
    method: str,
    path: str,
    *,
    params: dict | None = None,
    json_body: dict | None = None,
) -> requests.Response:
    url = f"{API_BASE}{path}"
    resp = session.request(method, url, params=params, json=json_body, timeout=60)
    return resp


def asc_json(session: requests.Session, method: str, path: str, **kwargs: Any) -> dict:
    resp = asc_request(session, method, path, **kwargs)
    if resp.status_code >= 400:
        print(resp.text, file=sys.stderr)
        resp.raise_for_status()
    if not resp.text:
        return {}
    return resp.json()


def find_app_id(session: requests.Session, bundle_id: str) -> str:
    data = asc_json(
        session,
        "GET",
        "/apps",
        params={"filter[bundleId]": bundle_id, "limit": "1"},
    )
    apps = data.get("data") or []
    if not apps:
        raise RuntimeError(f"No app for bundle id {bundle_id}")
    return apps[0]["id"]


def find_build_id(
    session: requests.Session, app_id: str, version: str, build_number: str
) -> str:
    data = asc_json(
        session,
        "GET",
        "/builds",
        params={
            "filter[app]": app_id,
            "filter[version]": version,
            "filter[buildNumber]": build_number,
            "limit": "1",
        },
    )
    builds = data.get("data") or []
    if not builds:
        raise RuntimeError("Build not found for whats-new update")
    return builds[0]["id"]


def gh_api(path: str) -> Any:
    token = require("GITHUB_TOKEN")
    repo = require("GITHUB_REPOSITORY")
    url = f"https://api.github.com/repos/{repo}{path}"
    resp = requests.get(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
        timeout=60,
    )
    if resp.status_code >= 400:
        print(resp.text, file=sys.stderr)
        resp.raise_for_status()
    return resp.json()


def last_successful_run_sha() -> str | None:
    repo = require("GITHUB_REPOSITORY")
    try:
        out = subprocess.check_output(
            [
                "gh",
                "run",
                "list",
                "--repo",
                repo,
                "--workflow",
                WORKFLOW_FILE,
                "--status",
                "success",
                "--json",
                "headSha,createdAt",
                "--limit",
                "2",
            ],
            text=True,
        )
        runs = json.loads(out)
        if len(runs) < 2:
            return None
        return runs[1]["headSha"]
    except (subprocess.CalledProcessError, json.JSONDecodeError, KeyError):
        return None


def commit_subjects_between(base: str, head: str) -> list[str]:
    compare = gh_api(f"/compare/{base}...{head}")
    subjects: list[str] = []
    for item in compare.get("commits") or []:
        subject = (item.get("commit") or {}).get("message", "").split("\n")[0].strip()
        if subject:
            subjects.append(subject)
    return subjects


def pr_titles_for_commits(commits: list[dict]) -> list[str]:
    titles: list[str] = []
    seen: set[str] = set()
    for item in commits:
        sha = item.get("sha")
        if not sha:
            continue
        try:
            pulls = gh_api(f"/commits/{sha}/pulls")
        except requests.HTTPError:
            continue
        for pr in pulls:
            title = (pr.get("title") or "").strip()
            if title and title not in seen:
                seen.add(title)
                titles.append(title)
    return titles


def collect_whats_new() -> str:
    head = require("GITHUB_SHA")
    since_sha = last_successful_run_sha()
    base = since_sha or env("GITHUB_EVENT_BEFORE") or head

    lines: list[str] = []
    try:
        compare = gh_api(f"/compare/{base}...{head}")
        commits = compare.get("commits") or []
        lines = pr_titles_for_commits(commits)
        if not lines:
            lines = commit_subjects_between(base, head)
    except requests.HTTPError:
        before = env("GITHUB_EVENT_BEFORE")
        if before:
            try:
                lines = commit_subjects_between(before, head)
            except requests.HTTPError:
                lines = []

    if not lines:
        lines = ["Money Tracker build"]

    text = "\n".join(dict.fromkeys(lines))
    return text[:MAX_WHATS_NEW]


def patch_beta_localization(session: requests.Session, build_id: str, whats_new: str) -> None:
    data = asc_json(
        session,
        "GET",
        "/betaBuildLocalizations",
        params={"filter[build]": build_id, "filter[locale]": "en-US", "limit": "1"},
    )
    items = data.get("data") or []
    if not items:
        created = asc_json(
            session,
            "POST",
            "/betaBuildLocalizations",
            json_body={
                "data": {
                    "type": "betaBuildLocalizations",
                    "attributes": {"locale": "en-US", "whatsNew": whats_new},
                    "relationships": {
                        "build": {"data": {"type": "builds", "id": build_id}}
                    },
                }
            },
        )
        loc_id = created["data"]["id"]
        print(f"Created beta localization {loc_id}")
        return

    loc_id = items[0]["id"]
    asc_json(
        session,
        "PATCH",
        f"/betaBuildLocalizations/{loc_id}",
        json_body={"data": {"type": "betaBuildLocalizations", "id": loc_id, "attributes": {"whatsNew": whats_new}}},
    )
    print(f"Updated whatsNew on {loc_id}")


def ensure_internal_group(session: requests.Session, app_id: str) -> None:
    data = asc_json(
        session,
        "GET",
        "/betaGroups",
        params={"filter[app]": app_id, "limit": "200"},
    )
    groups = data.get("data") or []
    for group in groups:
        name = (group.get("attributes") or {}).get("name", "")
        if name.lower() == "internal":
            print("Internal beta group already exists")
            return

    resp = asc_request(
        session,
        "POST",
        "/betaGroups",
        json_body={
            "data": {
                "type": "betaGroups",
                "attributes": {"name": "Internal", "hasAccessToAllBuilds": True},
                "relationships": {"app": {"data": {"type": "apps", "id": app_id}}},
            }
        },
    )
    if resp.status_code == 403:
        print(
            "Could not create Internal beta group (403 — App Manager API key cannot manage groups). Skipping.",
            file=sys.stderr,
        )
        return
    if resp.status_code >= 400:
        print(resp.text, file=sys.stderr)
        resp.raise_for_status()
    print("Created Internal beta group with hasAccessToAllBuilds")


def main() -> None:
    key_id = require("APP_STORE_CONNECT_API_KEY_ID")
    issuer_id = require("APP_STORE_CONNECT_ISSUER_ID")
    key_b64 = require("APP_STORE_CONNECT_API_KEY_P8_BASE64")
    bundle_id = require("IOS_BUNDLE_ID")
    version = require("MARKETING_VERSION")
    build_number = require("BUILD_NUMBER")

    key_bytes = base64.b64decode(key_b64)
    session = requests.Session()
    session.headers["Authorization"] = f"Bearer {make_token(key_id, issuer_id, key_bytes)}"
    session.headers["Content-Type"] = "application/json"

    whats_new = collect_whats_new()
    print(f"whatsNew ({len(whats_new)} chars):\n{whats_new}")

    app_id = find_app_id(session, bundle_id)
    build_id = find_build_id(session, app_id, version, build_number)
    patch_beta_localization(session, build_id, whats_new)
    ensure_internal_group(session, app_id)


if __name__ == "__main__":
    main()
