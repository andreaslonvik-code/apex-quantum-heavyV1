import sharp from "sharp";
import { writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "public", "aq-logo.png");
const appDir = join(root, "app");

// Source is 784x1168 portrait — crop centered square, then pad slightly so
// the AQ glyph sits well inside the icon viewport at small sizes.
const meta = await sharp(source).metadata();
const side = Math.min(meta.width, meta.height);
const left = Math.floor((meta.width - side) / 2);
const top = Math.floor((meta.height - side) / 2);

const square = await sharp(source)
  .extract({ left, top, width: side, height: side })
  .toBuffer();

async function pngAt(size) {
  return sharp(square)
    .resize(size, size, { fit: "cover", kernel: "lanczos3" })
    .ensureAlpha()
    .png({ compressionLevel: 9, force: true })
    .toBuffer();
}

// 1) Main icon for Google + browsers (Next.js picks this up via file convention)
writeFileSync(join(appDir, "icon.png"), await pngAt(512));

// 2) Apple touch icon
writeFileSync(join(appDir, "apple-icon.png"), await pngAt(180));

// 3) Multi-size favicon.ico embedding PNGs at 16, 32, 48
const sizes = [16, 32, 48];
const pngs = await Promise.all(sizes.map((s) => pngAt(s)));

const headerSize = 6;
const entrySize = 16;
const dirSize = headerSize + entrySize * sizes.length;
let offset = dirSize;

const header = Buffer.alloc(headerSize);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: 1 = icon
header.writeUInt16LE(sizes.length, 4); // image count

const entries = Buffer.alloc(entrySize * sizes.length);
sizes.forEach((s, i) => {
  const e = entries.subarray(i * entrySize, (i + 1) * entrySize);
  e.writeUInt8(s === 256 ? 0 : s, 0); // width (0 means 256)
  e.writeUInt8(s === 256 ? 0 : s, 1); // height
  e.writeUInt8(0, 2); // palette
  e.writeUInt8(0, 3); // reserved
  e.writeUInt16LE(1, 4); // color planes
  e.writeUInt16LE(32, 6); // bit depth
  e.writeUInt32LE(pngs[i].length, 8); // size
  e.writeUInt32LE(offset, 12); // offset
  offset += pngs[i].length;
});

const ico = Buffer.concat([header, entries, ...pngs]);
writeFileSync(join(appDir, "favicon.ico"), ico);

console.log("Wrote:");
console.log("  app/icon.png         512x512 (" + (await pngAt(512)).length + " bytes)");
console.log("  app/apple-icon.png   180x180");
console.log("  app/favicon.ico      16+32+48 (" + ico.length + " bytes)");
