#!/usr/bin/env python3
"""
Upscale a 64x64 (or any size) PNG to 1024x1024 with nearest-neighbor
and save as the iOS app icon.
Usage: python3 upscale-app-icon.py <path_or_url>
"""
import sys
import os
import tempfile
import urllib.request

try:
    from PIL import Image
except ImportError:
    print("Need Pillow: pip install Pillow", file=sys.stderr)
    sys.exit(1)

ICON_PATH = os.path.join(
    os.path.dirname(__file__),
    "..",
    "frontend",
    "ios",
    "App",
    "App",
    "Assets.xcassets",
    "AppIcon.appiconset",
    "AppIcon-512@2x.png",
)


def main():
    if len(sys.argv) != 2:
        print("Usage: python3 upscale-app-icon.py <path_or_url>", file=sys.stderr)
        sys.exit(1)
    src = sys.argv[1].strip()
    if src.startswith("http://") or src.startswith("https://"):
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
            urllib.request.urlretrieve(src, f.name)
            path = f.name
        try:
            img = Image.open(path).convert("RGBA")
        finally:
            os.unlink(path)
    else:
        path = os.path.abspath(src)
        if not os.path.isfile(path):
            print(f"Not a file: {path}", file=sys.stderr)
            sys.exit(1)
        img = Image.open(path).convert("RGBA")
    out_path = os.path.abspath(ICON_PATH)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    resized = img.resize((1024, 1024), Image.NEAREST)
    resized.save(out_path, "PNG")
    print(f"Saved 1024x1024 app icon to {out_path}")


if __name__ == "__main__":
    main()
