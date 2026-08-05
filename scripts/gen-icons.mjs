/**
 * Genera los íconos de la PWA sin dependencias: dibuja los píxeles a mano y
 * los codifica en PNG con el zlib de Node.
 *
 *   node scripts/gen-icons.mjs
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

// ------------------------------------------------------------------ PNG

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** rgba: Buffer de size*size*4 */
function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  // 10-12: compression, filter, interlace = 0

  // Cada scanline lleva un byte de filtro adelante; usamos 0 (sin filtro).
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------ dibujo

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** Distancia con signo a un rectángulo redondeado, para bordes con antialias. */
function roundedRectSdf(px, py, cx, cy, halfW, halfH, radius) {
  const dx = Math.abs(px - cx) - (halfW - radius);
  const dy = Math.abs(py - cy) - (halfH - radius);
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  return outside + Math.min(Math.max(dx, dy), 0) - radius;
}

function draw(size, { bleed }) {
  const rgba = Buffer.alloc(size * size * 4);
  // `bleed` = ícono maskable: el arte se achica para sobrevivir al recorte
  // circular de Android (safe zone del 80%).
  const scale = bleed ? 0.68 : 0.86;
  const cornerRadius = bleed ? size * 0.5 : size * 0.22;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const t = y / size;

      // Fondo: degradé violeta -> fucsia.
      let r = lerp(0x6d, 0xc0, t);
      let g = lerp(0x28, 0x26, t);
      let b = lerp(0xd9, 0xd3, t);
      let a = 255;

      if (!bleed) {
        // Recorte redondeado con antialias de 1px.
        const d = roundedRectSdf(x + 0.5, y + 0.5, size / 2, size / 2, size / 2, size / 2, cornerRadius);
        a = Math.round(255 * clamp01(0.5 - d));
      }

      // Tres barras blancas: un titular y dos líneas de bajada.
      const barX = size * (0.5 - scale / 2);
      const barW = size * scale;
      const unit = size * scale;
      const bars = [
        { y: size * 0.5 - unit * 0.30, h: unit * 0.17, w: barW },
        { y: size * 0.5 - unit * 0.04, h: unit * 0.10, w: barW },
        { y: size * 0.5 + unit * 0.15, h: unit * 0.10, w: barW * 0.62 },
      ];

      for (const bar of bars) {
        const d = roundedRectSdf(
          x + 0.5,
          y + 0.5,
          barX + bar.w / 2,
          bar.y + bar.h / 2,
          bar.w / 2,
          bar.h / 2,
          bar.h / 2,
        );
        const cover = clamp01(0.5 - d);
        if (cover > 0) {
          r = lerp(r, 255, cover);
          g = lerp(g, 255, cover);
          b = lerp(b, 255, cover);
        }
      }

      rgba[i] = Math.round(r);
      rgba[i + 1] = Math.round(g);
      rgba[i + 2] = Math.round(b);
      rgba[i + 3] = a;
    }
  }

  return rgba;
}

mkdirSync(OUT, { recursive: true });

const targets = [
  ["icon-192.png", 192, { bleed: false }],
  ["icon-512.png", 512, { bleed: false }],
  ["icon-maskable-512.png", 512, { bleed: true }],
  ["apple-touch-icon.png", 180, { bleed: true }],
];

for (const [name, size, opts] of targets) {
  writeFileSync(join(OUT, name), encodePng(size, draw(size, opts)));
  console.log(`${name} (${size}x${size})`);
}
