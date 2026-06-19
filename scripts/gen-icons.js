#!/usr/bin/env node
/** Generate PWA PNG icons (192 + 512) — no dependencies */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'icons');

function crc32(buf) {
  let c = 0xffffffff;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c;
    }
    return t;
  })());
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function colorAt(x, y, size) {
  const pad = Math.floor(size * 0.12);
  const gap = Math.floor(size * 0.04);
  const tile = Math.floor((size - pad * 2 - gap) / 2);
  const colors = [
    [255, 71, 87], [46, 213, 115], [55, 66, 250], [255, 165, 2]
  ];
  const cols = [
    [pad, pad], [pad + tile + gap, pad],
    [pad, pad + tile + gap], [pad + tile + gap, pad + tile + gap]
  ];
  for (let i = 0; i < 4; i++) {
    const [cx, cy] = cols[i];
    if (x >= cx && x < cx + tile && y >= cy && y < cy + tile) return [...colors[i], 255];
  }
  const r = 108 + Math.floor((x / size) * 20);
  const g = 92 + Math.floor((y / size) * 30);
  const b = 231;
  return [r, g, b, 255];
}

function createPng(size) {
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    row[0] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = colorAt(x, y, size);
      const i = 1 + x * 4;
      row[i] = r; row[i + 1] = g; row[i + 2] = b; row[i + 3] = a;
    }
    rows.push(row);
  }
  const raw = Buffer.concat(rows);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'icon-192.png'), createPng(192));
fs.writeFileSync(path.join(OUT, 'icon-512.png'), createPng(512));
console.log('Icons written to', OUT);