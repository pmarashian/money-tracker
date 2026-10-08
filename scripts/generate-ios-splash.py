#!/usr/bin/env python3
"""Generate iOS splash PNG from retroCoinArt frame 0 (nearest-neighbor scale)."""
from __future__ import annotations

import re
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ART_TS = ROOT / "frontend" / "src" / "components" / "retroCoinArt.ts"
OUT_DIR = (
    ROOT
    / "frontend"
    / "ios"
    / "App"
    / "App"
    / "Assets.xcassets"
    / "Splash.imageset"
)
SIZE = 2732
BG = (0x00, 0x00, 0x20, 255)
GOLD = (0xf8, 0xb8, 0x00, 255)

# 5×7 pixel font (A-Z, space)
FONT: dict[str, list[str]] = {
    " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
    "A": [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
    "C": [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
    "E": ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
    "K": ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
    "M": ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
    "N": ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
    "O": [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
    "R": ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
    "T": ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
    "Y": ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
}


def parse_palette_and_frame(ts_text: str) -> tuple[dict[str, tuple[int, int, int, int]], list[str]]:
    palette_block = re.search(
        r"export const COIN_PALETTE.*?=\s*\{([^}]+)\}", ts_text, re.S
    )
    if not palette_block:
        raise SystemExit("COIN_PALETTE not found")
    palette: dict[str, tuple[int, int, int, int]] = {".": (0, 0, 0, 0)}
    for line in palette_block.group(1).splitlines():
        m = re.match(r"\s*(\w):\s*'([^']*)'", line)
        if not m:
            continue
        key, hex_color = m.group(1), m.group(2)
        if not hex_color:
            palette[key] = (0, 0, 0, 0)
        else:
            palette[key] = (
                int(hex_color[1:3], 16),
                int(hex_color[3:5], 16),
                int(hex_color[5:7], 16),
                255,
            )

    frames_block = re.search(
        r"export const FRAME_PIXELS\s*=\s*\[\s*frame\(\[\s*(.*?)\s*\]\),",
        ts_text,
        re.S,
    )
    if not frames_block:
        raise SystemExit("FRAME_PIXELS[0] not found")
    rows = re.findall(r"'([^']*)'", frames_block.group(1))
    if len(rows) != 16:
        raise SystemExit(f"Expected 16 coin rows, got {len(rows)}")
    return palette, rows


def write_png(path: Path, width: int, height: int, rgba: bytes) -> None:
    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff)
        )

    raw = b"".join(b"\x00" + rgba[y * width * 4 : (y + 1) * width * 4] for y in range(height))
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(png)


def blit_rect(
    buf: bytearray,
    width: int,
    x0: int,
    y0: int,
    w: int,
    h: int,
    color: tuple[int, int, int, int],
) -> None:
    for y in range(h):
        for x in range(w):
            px = x0 + x
            py = y0 + y
            if 0 <= px < width and 0 <= py < width:
                i = (py * width + px) * 4
                if color[3]:
                    buf[i : i + 4] = bytes(color)


def blit_coin(
    buf: bytearray,
    width: int,
    palette: dict[str, tuple[int, int, int, int]],
    rows: list[str],
    scale: int,
    cx: int,
    cy: int,
) -> None:
    art = 16
    w = art * scale
    h = art * scale
    x0 = cx - w // 2
    y0 = cy - h // 2
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            color = palette.get(ch, (0, 0, 0, 0))
            if not color[3]:
                continue
            blit_rect(buf, width, x0 + x * scale, y0 + y * scale, scale, scale, color)


def blit_text(buf: bytearray, width: int, text: str, scale: int, cx: int, y: int) -> None:
    glyphs = [FONT[c] for c in text if c in FONT]
    if not glyphs:
        return
    glyph_w = 5
    gap = scale
    total_w = len(glyphs) * glyph_w * scale + (len(glyphs) - 1) * gap
    x = cx - total_w // 2
    for glyph in glyphs:
        for gy, row in enumerate(glyph):
            for gx, ch in enumerate(row):
                if ch == "#":
                    blit_rect(buf, width, x + gx * scale, y + gy * scale, scale, scale, GOLD)
        x += glyph_w * scale + gap


def main() -> None:
    ts_text = ART_TS.read_text(encoding="utf-8")
    palette, frame0 = parse_palette_and_frame(ts_text)
    rgba = bytearray([BG[0], BG[1], BG[2], BG[3]] * (SIZE * SIZE))

    coin_scale = 24
    blit_coin(rgba, SIZE, palette, frame0, coin_scale, SIZE // 2, SIZE // 2 - 80)
    blit_text(rgba, SIZE, "MONEY TRACKER", 6, SIZE // 2, SIZE // 2 + 220)

    out = OUT_DIR / "splash.png"
    write_png(out, SIZE, SIZE, bytes(rgba))
    print(f"Wrote {out}")


if __name__ == "__main__":
    main()
