// Generate the extension icons (16/48/128) as PNGs, with no image-library
// dependency: a tiny hand-rolled PNG encoder draws a clock on a mineral-teal
// tile (the app's default theme). Run once via "npm run icons"; output lands in
// public/icons and ships through the normal public/ copy.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i];
    for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function png(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function draw(size) {
  const buf = Buffer.alloc(size * size * 4);
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;
  const radius = size * 0.42;
  const handWidth = Math.max(1, size * 0.05);
  const minuteLen = size * 0.3;
  const hourLen = size * 0.21;
  const teal = [47, 122, 111, 255];
  const cream = [242, 239, 233, 255];
  const ink = [33, 36, 42, 255];

  const set = (x, y, color) => {
    const i = (y * size + x) * 4;
    buf[i] = color[0];
    buf[i + 1] = color[1];
    buf[i + 2] = color[2];
    buf[i + 3] = color[3];
  };

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.hypot(dx, dy);
      let color = teal;
      if (dist <= radius) {
        color = cream;
        if (Math.abs(dx) <= handWidth && dy <= 0 && dy >= -minuteLen) color = ink;
        if (Math.abs(dy) <= handWidth && dx >= 0 && dx <= hourLen) color = ink;
        if (dist <= handWidth * 1.2) color = ink;
      }
      set(x, y, color);
    }
  }
  return buf;
}

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "public", "icons");
mkdirSync(outDir, { recursive: true });
for (const size of [16, 48, 128]) {
  writeFileSync(join(outDir, `icon-${size}.png`), png(size, draw(size)));
}
console.log("Wrote public/icons/icon-{16,48,128}.png");
