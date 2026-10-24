import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import {
  bytesToBase64,
  decodeBase64,
  decodeRaster,
  downscale,
  encodePng,
  isNeonEdge,
  paintEdges,
  toGray,
} from './raster';

const MAX_EDGE = 420;
const INK = '#111118';
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

type Prepared = {
  gray: Float32Array;
  width: number;
  height: number;
};

const prepared = new Map<string, Promise<Prepared>>();

/**
 * Photo mode is the original image. Ink is dark #111118 edges on a transparent
 * field. Neon is a different treatment: luminous #00E5FF lines with a glow, also
 * on a transparent field. Web uses canvas pixels. Native decodes the file and
 * runs the same edge pass, because SVG/CSS filters do not run there.
 */
export async function toLineArt(uri: string, edge: string = INK): Promise<string> {
  try {
    const neon = isNeonEdge(edge);
    const rgb = parseHex(neon ? '#00E5FF' : edge);
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      return await webLineArt(uri, rgb, neon);
    }
    const source = await prepareNative(uri);
    const rgba = paintEdges(source.gray, source.width, source.height, rgb, neon);
    return `data:image/png;base64,${bytesToBase64(encodePng(rgba, source.width, source.height))}`;
  } catch {
    return uri;
  }
}

async function prepareNative(uri: string): Promise<Prepared> {
  const existing = prepared.get(uri);
  if (existing) return existing;
  const job = (async () => {
    const image = downscale(await decodeRaster(await readImageBytes(uri)), MAX_EDGE);
    return { gray: toGray(image.data, image.width, image.height), width: image.width, height: image.height };
  })();
  prepared.set(uri, job);
  job.catch(() => {
    if (prepared.get(uri) === job) prepared.delete(uri);
  });
  return job;
}

async function readImageBytes(uri: string): Promise<Uint8Array> {
  if (uri.startsWith('data:')) {
    const comma = uri.indexOf(',');
    if (comma < 0) throw new Error('The photo could not be read.');
    const meta = uri.slice(0, comma);
    const payload = uri.slice(comma + 1);
    if (/;base64/i.test(meta)) return decodeBase64(payload);
    return new TextEncoder().encode(decodeURIComponent(payload));
  }
  if (/^https?:/i.test(uri)) {
    return fetchImageBytes(uri, 'The photo could not be read.');
  }
  return new File(uri).bytes();
}

async function fetchImageBytes(uri: string, message: string): Promise<Uint8Array> {
  const response = await fetch(uri);
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error(message);
  }
  return readBoundedResponse(response, message);
}

async function readBoundedResponse(response: Response, message: string): Promise<Uint8Array> {
  const header = response.headers.get('content-length');
  if (header) {
    const declared = Number(header);
    if (Number.isFinite(declared) && declared > MAX_IMAGE_BYTES) {
      await response.body?.cancel().catch(() => undefined);
      throw new Error(message);
    }
  }

  const reader = response.body?.getReader();
  if (!reader) {
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_IMAGE_BYTES) throw new Error(message);
    return new Uint8Array(buffer);
  }

  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const size = value?.byteLength ?? 0;
      if (!value || size === 0) continue;
      if (received + size > MAX_IMAGE_BYTES) throw new Error(message);
      chunks.push(value);
      received += size;
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // The reader lock was already released.
    }
  }

  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function webLineArt(uri: string, rgb: [number, number, number], neon: boolean): Promise<string> {
  const image = await loadImage(uri);
  const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height, 1));
  const width = Math.max(2, Math.round(image.width * scale));
  const height = Math.max(2, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return uri;
  context.drawImage(image, 0, 0, width, height);
  const source = context.getImageData(0, 0, width, height);
  const edges = paintEdges(toGray(new Uint8Array(source.data), width, height), width, height, rgb, neon);
  const output = context.createImageData(width, height);
  output.data.set(edges);
  context.putImageData(output, 0, 0);
  return canvas.toDataURL('image/png');
}

function parseHex(color: string): [number, number, number] {
  const hex = color.replace('#', '');
  const value = Number.parseInt(hex, 16);
  if (!Number.isFinite(value) || hex.length !== 6) return [17, 17, 24];
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function loadImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    if (/^https?:/i.test(uri)) image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The photo could not be read.'));
    image.src = uri;
  });
}
