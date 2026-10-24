import { unzlibSync } from 'fflate';

import { decodeJpeg, type DecodedImage } from './jpeg';

const NEON = '00e5ff';
const INK_THRESHOLD = 48;
const NEON_CORE = 46;
const NEON_GLOW = 18;

export type RgbaImage = DecodedImage;

const CRC_TABLE = new Uint32Array(256);
for (let index = 0; index < 256; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  CRC_TABLE[index] = value >>> 0;
}

export function decodeBase64(value: string): Uint8Array {
  const clean = value.replace(/\s/g, '');
  if (clean.length === 0) return new Uint8Array();
  const pad = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const length = Math.floor((clean.length * 3) / 4) - pad;
  const out = new Uint8Array(length);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const map = new Uint8Array(128);
  map.fill(255);
  for (let index = 0; index < alphabet.length; index += 1) map[alphabet.charCodeAt(index)] = index;
  const codeAt = (index: number) => {
    const value = map[clean.charCodeAt(index)] ?? 255;
    return value === 255 ? 0 : value;
  };
  let offset = 0;
  for (let index = 0; index < clean.length; index += 4) {
    const a = codeAt(index);
    const b = index + 1 < clean.length ? codeAt(index + 1) : 0;
    const c = index + 2 < clean.length ? codeAt(index + 2) : 0;
    const d = index + 3 < clean.length ? codeAt(index + 3) : 0;
    const triple = (a << 18) | (b << 12) | (c << 6) | d;
    if (offset < length) out[offset++] = (triple >> 16) & 255;
    if (offset < length) out[offset++] = (triple >> 8) & 255;
    if (offset < length) out[offset++] = triple & 255;
  }
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index];
    const b = index + 1 < bytes.length ? bytes[index + 1] : 0;
    const c = index + 2 < bytes.length ? bytes[index + 2] : 0;
    const triple = (a << 16) | (b << 8) | c;
    out += alphabet[(triple >> 18) & 63];
    out += alphabet[(triple >> 12) & 63];
    out += index + 1 < bytes.length ? alphabet[(triple >> 6) & 63] : '=';
    out += index + 2 < bytes.length ? alphabet[triple & 63] : '=';
  }
  return out;
}

export async function decodeRaster(bytes: Uint8Array): Promise<RgbaImage> {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return decodePng(bytes);
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    return decodeJpeg(bytes);
  }
  throw new Error('The photo could not be read.');
}

export function downscale(image: RgbaImage, maxEdge: number): RgbaImage {
  const scale = Math.min(1, maxEdge / Math.max(image.width, image.height, 1));
  const width = Math.max(2, Math.round(image.width * scale));
  const height = Math.max(2, Math.round(image.height * scale));
  if (width === image.width && height === image.height) return image;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.min(image.height - 1, Math.floor(y / scale));
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(image.width - 1, Math.floor(x / scale));
      const from = (sourceY * image.width + sourceX) * 4;
      const to = (y * width + x) * 4;
      data[to] = image.data[from];
      data[to + 1] = image.data[from + 1];
      data[to + 2] = image.data[from + 2];
      data[to + 3] = image.data[from + 3];
    }
  }
  return { width, height, data };
}

export function toGray(data: Uint8Array, width: number, height: number): Float32Array {
  const gray = new Float32Array(width * height);
  for (let index = 0, pixel = 0; pixel < gray.length; index += 4, pixel += 1) {
    gray[pixel] = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
  }
  return gray;
}

export function isNeonEdge(edge: string): boolean {
  return edge.replace('#', '').trim().toLowerCase() === NEON;
}

/**
 * Ink is a 1px #111118 edge on a transparent field. Neon is the same edge
 * map drawn as luminous #00E5FF lines with a softer glow, so the two modes
 * are not a recolor of one sheet.
 */
export function paintEdges(
  gray: Float32Array,
  width: number,
  height: number,
  rgb: [number, number, number],
  neon: boolean,
): Uint8Array {
  const magnitude = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const center = y * width + x;
      const gx =
        -gray[center - width - 1] +
        gray[center - width + 1] +
        -2 * gray[center - 1] +
        2 * gray[center + 1] +
        -gray[center + width - 1] +
        gray[center + width + 1];
      const gy =
        -gray[center - width - 1] -
        2 * gray[center - width] -
        gray[center - width + 1] +
        gray[center + width - 1] +
        2 * gray[center + width] +
        gray[center + width + 1];
      magnitude[center] = Math.hypot(gx, gy);
    }
  }

  const dest = new Uint8Array(width * height * 4);
  const [red, green, blue] = rgb;
  const core = neon ? NEON_CORE : INK_THRESHOLD;
  for (let index = 0; index < magnitude.length; index += 1) {
    const strength = magnitude[index];
    if (strength < (neon ? NEON_GLOW : core)) continue;
    const offset = index * 4;
    dest[offset] = red;
    dest[offset + 1] = green;
    dest[offset + 2] = blue;
    if (!neon || strength >= core) dest[offset + 3] = 255;
    else dest[offset + 3] = Math.round(80 + ((strength - NEON_GLOW) / (core - NEON_GLOW)) * 150);
  }

  if (!neon) return dest;

  const cores = new Uint8Array(width * height);
  for (let index = 0; index < cores.length; index += 1) cores[index] = dest[index * 4 + 3] === 255 ? 1 : 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      if (!cores[y * width + x]) continue;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const offset = ((y + dy) * width + (x + dx)) * 4;
          if (dest[offset + 3] >= 220) continue;
          dest[offset] = red;
          dest[offset + 1] = green;
          dest[offset + 2] = blue;
          if (dest[offset + 3] < 150) dest[offset + 3] = 150;
        }
      }
    }
  }
  return dest;
}

export function encodePng(rgba: Uint8Array, width: number, height: number): Uint8Array {
  const stride = width * 4;
  const raw = new Uint8Array((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const dest = y * (stride + 1);
    raw[dest] = 0;
    raw.set(rgba.subarray(y * stride, (y + 1) * stride), dest + 1);
  }
  const ihdr = new Uint8Array(13);
  const header = new DataView(ihdr.buffer);
  header.setUint32(0, width);
  header.setUint32(4, height);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const signature = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);
  return concat([signature, pngChunk('IHDR', ihdr), pngChunk('IDAT', zlibStore(raw)), pngChunk('IEND', new Uint8Array())]);
}

function decodePng(bytes: Uint8Array): RgbaImage {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat: Uint8Array[] = [];
  while (pos + 8 <= bytes.length) {
    const length = view.getUint32(pos);
    const type = String.fromCharCode(bytes[pos + 4], bytes[pos + 5], bytes[pos + 6], bytes[pos + 7]);
    const data = bytes.subarray(pos + 8, pos + 8 + length);
    pos += 12 + length;
    if (type === 'IHDR' && data.length >= 13) {
      const header = new DataView(data.buffer, data.byteOffset, data.byteLength);
      width = header.getUint32(0);
      height = header.getUint32(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }
  if (width < 2 || height < 2 || bitDepth !== 8 || interlace !== 0) {
    throw new Error('The photo could not be read.');
  }
  if (width * height > 20_000_000) throw new Error('The photo could not be read.');
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 4 ? 2 : colorType === 0 ? 1 : 0;
  if (!channels) throw new Error('The photo could not be read.');
  const compressed = concat(idat);
  const inflated = unzlibSync(compressed);
  const samples = unfilter(inflated, width, height, channels);
  const rgba = new Uint8Array(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    const from = index * channels;
    const to = index * 4;
    if (colorType === 6) {
      rgba[to] = samples[from];
      rgba[to + 1] = samples[from + 1];
      rgba[to + 2] = samples[from + 2];
      rgba[to + 3] = samples[from + 3];
    } else if (colorType === 2) {
      rgba[to] = samples[from];
      rgba[to + 1] = samples[from + 1];
      rgba[to + 2] = samples[from + 2];
      rgba[to + 3] = 255;
    } else if (colorType === 4) {
      rgba[to] = samples[from];
      rgba[to + 1] = samples[from];
      rgba[to + 2] = samples[from];
      rgba[to + 3] = samples[from + 1];
    } else {
      rgba[to] = samples[from];
      rgba[to + 1] = samples[from];
      rgba[to + 2] = samples[from];
      rgba[to + 3] = 255;
    }
  }
  return { width, height, data: rgba };
}

function unfilter(raw: Uint8Array, width: number, height: number, channels: number): Uint8Array {
  const stride = width * channels;
  const out = new Uint8Array(stride * height);
  let offset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[offset];
    offset += 1;
    const rowStart = y * stride;
    for (let x = 0; x < stride; x += 1) {
      const left = x >= channels ? out[rowStart + x - channels] : 0;
      const up = y > 0 ? out[rowStart - stride + x] : 0;
      const upLeft = y > 0 && x >= channels ? out[rowStart - stride + x - channels] : 0;
      const value = raw[offset + x];
      if (filter === 0) out[rowStart + x] = value;
      else if (filter === 1) out[rowStart + x] = (value + left) & 255;
      else if (filter === 2) out[rowStart + x] = (value + up) & 255;
      else if (filter === 3) out[rowStart + x] = (value + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) out[rowStart + x] = (value + paeth(left, up, upLeft)) & 255;
      else throw new Error('The photo could not be read.');
    }
    offset += stride;
  }
  return out;
}

function paeth(left: number, up: number, upLeft: number): number {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const diagonal = Math.abs(estimate - upLeft);
  if (leftDistance <= upDistance && leftDistance <= diagonal) return left;
  if (upDistance <= diagonal) return up;
  return upLeft;
}

function zlibStore(data: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = [Uint8Array.of(0x78, 0x01)];
  let offset = 0;
  while (offset < data.length || data.length === 0) {
    const remaining = data.length - offset;
    const size = Math.min(65535, remaining);
    const last = offset + size >= data.length;
    const block = new Uint8Array(5 + size);
    block[0] = last ? 1 : 0;
    block[1] = size & 255;
    block[2] = (size >> 8) & 255;
    const complement = size ^ 0xffff;
    block[3] = complement & 255;
    block[4] = (complement >> 8) & 255;
    block.set(data.subarray(offset, offset + size), 5);
    parts.push(block);
    offset += size;
    if (last) break;
  }
  const sum = adler32(data);
  parts.push(Uint8Array.of((sum >>> 24) & 255, (sum >>> 16) & 255, (sum >>> 8) & 255, sum & 255));
  return concat(parts);
}

function adler32(data: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let index = 0; index < data.length; index += 1) {
    a = (a + data[index]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc = CRC_TABLE[(crc ^ bytes[index]) & 255] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out[4] = type.charCodeAt(0);
  out[5] = type.charCodeAt(1);
  out[6] = type.charCodeAt(2);
  out[7] = type.charCodeAt(3);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

function concat(parts: Uint8Array[]): Uint8Array {
  let length = 0;
  for (const part of parts) length += part.length;
  const out = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}
