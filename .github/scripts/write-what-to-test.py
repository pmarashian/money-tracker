#!/usr/bin/env python3
"""Write WHAT_TO_TEST.txt for set-testflight-whats-new.py (Ripple pipeline)."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

MAX_CHARS = 4000
WORKFLOW_FILE = "ios-testflight.yml"
ROOT = Path(__file__).resolve().parents[2]
OUT_PATH = ROOT / "WHAT_TO_TEST.txt"


def env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        print(f"Missing {name}.", file=sys.stderr)
        sys.exit(1)
    return value


def gh_api(path: str) -> dict | list:
    token = env("GITHUB_TOKEN")
    repo = env("GITHUB_REPOSITORY")
    url = f"https://api.github.com/repos/{repo}{path}"
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            return json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as err:
        print(err.read().decode("utf-8", errors="replace"), file=sys.stderr)
        raise


def last_successful_run_sha() -> str | None:
    repo = env("GITHUB_REPOSITORY")
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


def pr_titles_between(base: str, head: str) -> list[str]:
    compare = gh_api(f"/compare/{base}...{head}")
    titles: list[str] = []
    seen: set[str] = set()
    for item in compare.get("commits") or []:
        sha = item.get("sha")
        if not sha:
            continue
        try:
            pulls = gh_api(f"/commits/{sha}/pulls")
        except urllib.error.HTTPError:
            continue
        if not isinstance(pulls, list):
            continue
        for pr in pulls:
            title = (pr.get("title") or "").strip()
            if title and title not in seen:
                seen.add(title)
                titles.append(title)
    return titles


def commit_subjects_between(base: str, head: str) -> list[str]:
    compare = gh_api(f"/compare/{base}...{head}")
    subjects: list[str] = []
    for item in compare.get("commits") or []:
        subject = (item.get("commit") or {}).get("message", "").split("\n")[0].strip()
        if subject:
            subjects.append(subject)
    return subjects


def main() -> int:
    head = env("GITHUB_SHA")
    base = last_successful_run_sha() or os.environ.get("GITHUB_EVENT_BEFORE", "").strip() or head
    lines: list[str] = []
    try:
        lines = pr_titles_between(base, head)
        if not lines:
            lines = commit_subjects_between(base, head)
    except urllib.error.HTTPError:
        before = os.environ.get("GITHUB_EVENT_BEFORE", "").strip()
        if before:
            try:
                lines = commit_subjects_between(before, head)
            except urllib.error.HTTPError:
                lines = []
    if not lines:
        lines = ["Money Tracker build"]
    text = "\n".join(dict.fromkeys(lines))[:MAX_CHARS]
    OUT_PATH.write_text(text, encoding="utf-8")
    print(f"Wrote {OUT_PATH} ({len(text)} chars)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
