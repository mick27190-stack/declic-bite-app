// Regenerates a consistent cache-busting version (?v=<hash>) for favicons,
// manifest and share images. Run: node scripts/update-icon-version.mjs
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const ICONS = [
  "public/favicon.ico",
  "public/favicon.png",
  "public/icon-192.png",
  "public/icon-512.png",
  "public/apple-touch-icon.png",
];

const hash = createHash("sha256");
for (const f of ICONS) hash.update(readFileSync(f));
const version = hash.digest("hex").slice(0, 8);

for (const file of ["index.html", "public/site.webmanifest"]) {
  const src = readFileSync(file, "utf8");
  const out = src
    .replace(/\?v=[a-z0-9]+/g, `?v=${version}`)
    .replace(/href="\/site\.webmanifest"/g, `href="/site.webmanifest?v=${version}"`);
  if (out !== src) writeFileSync(file, out);
}
console.log(`icon cache-busting version: ${version}`);
