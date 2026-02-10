#!/usr/bin/env node
/**
 * Create an app icon via PixelLab v2 create-image-pixflux API and save as PNG.
 * Usage: node scripts/create-app-icon.mjs [output.png] [description]
 * Env: PIXELLAB_API_TOKEN (required), ICON_DESCRIPTION (optional, overridden by CLI)
 */

import fs from "fs";
import path from "path";

const BASE = "https://api.pixellab.ai/v2";
const DEFAULT_DESCRIPTION =
  "minimalist app icon for a money tracker, coin and chart, pixel art";

function getOutputPath() {
  const arg = process.argv[2];
  return arg
    ? path.resolve(process.cwd(), arg)
    : path.resolve(process.cwd(), "app-icon.png");
}

function getDescription() {
  if (process.env.ICON_DESCRIPTION) return process.env.ICON_DESCRIPTION;
  const descArg = process.argv[3];
  return descArg ?? DEFAULT_DESCRIPTION;
}

function getBase64FromData(data) {
  if (!data) return null;
  if (data.base64) return data.base64;
  if (data.image?.base64) return data.image.base64;
  if (Array.isArray(data.images)?.[0]?.base64) return data.images[0].base64;
  if (typeof data.images?.[0] === "string") return data.images[0];
  return null;
}

async function main() {
  const token = process.env.PIXELLAB_API_TOKEN;
  if (!token) {
    console.error(
      "Missing PIXELLAB_API_TOKEN. Get a token at https://pixellab.ai/account"
    );
    process.exit(1);
  }

  const outputPath = getOutputPath();
  const description = getDescription();

  const body = {
    description,
    image_size: { width: 256, height: 256 },
    no_background: true,
  };

  console.log("starting fetch", body);

  const res = await fetch(`${BASE}/create-image-pixflux`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  console.log("fetch complete");

  const json = await res.json();

  if (!res.ok) {
    console.error("API error:", res.status, json.error ?? json);
    process.exit(1);
  }

  if (!json.success || json.error) {
    console.error("API returned error:", json.error ?? json);
    process.exit(1);
  }

  const base64 = getBase64FromData(json.data);
  if (base64) {
    const dir = path.dirname(outputPath);
    if (dir !== "." && !fs.existsSync(dir))
      fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outputPath, Buffer.from(base64, "base64"));
    console.log("Saved:", outputPath);
    return;
  }

  const url =
    json.data?.url ??
    json.data?.image?.url ??
    json.data?.images?.[0]?.url ??
    json.data?.images?.[0];
  if (typeof url === "string" && url.startsWith("http")) {
    const imgRes = await fetch(url);
    if (!imgRes.ok) {
      console.error("Failed to download image:", imgRes.status);
      process.exit(1);
    }
    const dir = path.dirname(outputPath);
    if (dir !== "." && !fs.existsSync(dir))
      fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outputPath, Buffer.from(await imgRes.arrayBuffer()));
    console.log("Saved:", outputPath);
    return;
  }

  console.error(
    "Could not find image in response. data keys:",
    json.data ? Object.keys(json.data) : "none"
  );
  process.exit(1);
}

main();
