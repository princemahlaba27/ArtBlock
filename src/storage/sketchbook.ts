import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';

import { noteSketchSaved } from './preferences';

const STORAGE_KEY = '@artblock/sketches';
const FOLDER_NAME = 'sketches';

export type SketchRecord = {
  id: string;
  title: string;
  /** Seconds spent on the drawing. */
  duration: number;
  /** ISO time the sketch was saved. */
  timestamp: string;
  /** Camera capture copied into the document directory. */
  photoUri: string;
  /** Reference image copied into the document directory, when the trace had one. */
  referenceUri?: string;
};

function sketchesDirectory(): Directory {
  const root = FileSystem.documentDirectory ? new Directory(FileSystem.documentDirectory) : Paths.document;
  const directory = new Directory(root, FOLDER_NAME);
  if (!directory.exists) directory.create();
  return directory;
}

function sketchPhotoUri(filename: string): string {
  const root = FileSystem.documentDirectory ? new Directory(FileSystem.documentDirectory) : Paths.document;
  return new File(root, FOLDER_NAME, filename).uri;
}

function normalizeSketch(value: unknown): SketchRecord | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as {
    id?: unknown;
    title?: unknown;
    duration?: unknown;
    seconds?: unknown;
    timestamp?: unknown;
    date?: unknown;
    photoUri?: unknown;
    photoFilename?: unknown;
    referenceUri?: unknown;
    referenceFilename?: unknown;
  };
  if (typeof raw.id !== 'string' || typeof raw.title !== 'string') return null;
  const duration = typeof raw.duration === 'number' ? raw.duration : raw.seconds;
  const timestamp = typeof raw.timestamp === 'string' ? raw.timestamp : raw.date;
  const photoUri = typeof raw.photoUri === 'string' ? raw.photoUri : typeof raw.photoFilename === 'string' ? sketchPhotoUri(raw.photoFilename) : '';
  if (typeof duration !== 'number' || typeof timestamp !== 'string' || !photoUri) return null;
  const referenceUri =
    typeof raw.referenceUri === 'string' && raw.referenceUri.trim()
      ? raw.referenceUri
      : typeof raw.referenceFilename === 'string'
        ? sketchPhotoUri(raw.referenceFilename)
        : undefined;
  return {
    id: raw.id,
    title: raw.title,
    duration,
    timestamp,
    photoUri,
    ...(referenceUri ? { referenceUri } : {}),
  };
}

export async function listSketches(): Promise<SketchRecord[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error('Sketch list could not be read.');
  }
  return parsed.flatMap((item) => {
    const record = normalizeSketch(item);
    return record ? [record] : [];
  });
}

function extensionFor(uri: string): string {
  const head = uri.slice(0, 80).toLowerCase();
  if (head.startsWith('data:image/png')) return 'png';
  if (head.startsWith('data:image/webp')) return 'webp';
  if (head.startsWith('data:image/gif')) return 'gif';
  if (head.startsWith('data:image/heic') || head.startsWith('data:image/heif')) return 'heic';
  const path = uri.split('?')[0].split('#')[0].toLowerCase();
  const match = path.match(/\.([a-z0-9]+)$/);
  const ext = match?.[1];
  if (ext === 'jpeg') return 'jpg';
  if (ext && ['png', 'jpg', 'webp', 'heic', 'heif', 'gif'].includes(ext)) return ext;
  return 'jpg';
}

function assertDocumentUri(uri: string): string {
  const lower = uri.toLowerCase();
  if (!uri || lower.startsWith('blob:') || lower.startsWith('simulator:') || lower.includes('/caches/') || lower.includes('/tmp/')) {
    throw new Error('The sketch could not be stored.');
  }
  if (FileSystem.cacheDirectory && uri.startsWith(FileSystem.cacheDirectory)) throw new Error('The sketch could not be stored.');
  return uri;
}

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

function canonicalFilePath(uri: string): { host: string; path: string } | null {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return null;
  }
  if (url.protocol !== 'file:') return null;
  const decoded = fullyDecode(url.pathname);
  if (decoded == null) return null;
  const path = resolveAbsolutePath(decoded);
  if (path == null) return null;
  return { host: url.host, path };
}

function fullyDecode(value: string): string | null {
  let current = value;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (current.includes('\0')) return null;
    let next: string;
    try {
      next = decodeURIComponent(current);
    } catch {
      return null;
    }
    if (next.includes('\0')) return null;
    if (next === current) return next.replace(/\\/g, '/');
    current = next;
  }
  return null;
}

function resolveAbsolutePath(path: string): string | null {
  if (!path.startsWith('/')) return null;
  const segments: string[] = [];
  for (const segment of path.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      if (segments.length === 0) return null;
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  if (segments.length === 0) return null;
  return `/${segments.join('/')}`;
}

/** File URI whose resolved path is a file inside documentDirectory/sketches. */
function isUriInsideSketches(uri: string): boolean {
  const rootUri = FileSystem.documentDirectory;
  if (!rootUri) return false;
  let root: { host: string; path: string } | null = null;
  try {
    const base = new URL(rootUri.endsWith('/') ? rootUri : `${rootUri}/`);
    root = canonicalFilePath(new URL(`${FOLDER_NAME}/`, base).href);
  } catch {
    return false;
  }
  const target = canonicalFilePath(uri);
  if (!root || !target || target.host !== root.host) return false;
  return target.path.startsWith(`${root.path}/`);
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

async function fetchImageBytes(uri: string, message: string): Promise<Uint8Array> {
  const response = await fetch(uri);
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error(message);
  }
  return readBoundedResponse(response, message);
}

/** Copies an image into the app document directory and returns that permanent URI. */
async function persistImage(sourceUri: string, filename: string): Promise<string> {
  const destination = new File(sketchesDirectory(), filename);
  if (destination.exists) destination.delete();

  if (sourceUri.startsWith('data:')) {
    const comma = sourceUri.indexOf(',');
    if (comma < 0) throw new Error('The sketch could not be stored.');
    const meta = sourceUri.slice(0, comma);
    const payload = sourceUri.slice(comma + 1);
    destination.create();
    if (/;base64/i.test(meta)) destination.write(payload.replace(/\s/g, ''), { encoding: 'base64' });
    else destination.write(new TextEncoder().encode(decodeURIComponent(payload)));
    return assertDocumentUri(destination.uri);
  }

  if (/^https?:/i.test(sourceUri) || sourceUri.startsWith('blob:')) {
    const bytes = await fetchImageBytes(sourceUri, 'The sketch could not be stored.');
    destination.create();
    destination.write(bytes);
    return assertDocumentUri(destination.uri);
  }

  await new File(sourceUri).copy(destination);
  return assertDocumentUri(destination.uri);
}

export async function saveSketch(input: {
  title: string;
  duration?: number;
  seconds?: number;
  photoUri: string;
  referenceUri?: string;
  timestamp?: string;
}): Promise<{ record: SketchRecord; total: number; photoUri: string }> {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const duration = Math.max(0, Math.round(input.duration ?? input.seconds ?? 0));
  const parsedTime = input.timestamp ? Date.parse(input.timestamp) : Number.NaN;
  const timestamp = Number.isNaN(parsedTime) ? new Date().toISOString() : new Date(parsedTime).toISOString();
  const photoUri = await persistImage(input.photoUri, `${id}-photo.${extensionFor(input.photoUri)}`);
  const referenceSource = input.referenceUri?.trim();
  const referenceUri = referenceSource
    ? await persistImage(referenceSource, `${id}-reference.${extensionFor(referenceSource)}`)
    : undefined;

  const existing = await listSketches();
  const record: SketchRecord = {
    id,
    title: input.title,
    duration,
    timestamp,
    photoUri,
    ...(referenceUri ? { referenceUri } : {}),
  };
  const next = [record, ...existing];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  await noteSketchSaved();
  return { record, total: next.length, photoUri };
}

function storedId(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const id = (value as { id?: unknown }).id;
  return typeof id === 'string' ? id : null;
}

function storedUri(value: unknown, key: 'photoUri' | 'referenceUri'): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const uri = (value as Record<string, unknown>)[key];
  return typeof uri === 'string' && uri.trim() ? uri : undefined;
}

async function deleteStoredUri(uri: string | undefined): Promise<void> {
  const target = uri?.trim();
  if (!target) return;
  try {
    if (!isUriInsideSketches(target)) return;
    await FileSystem.deleteAsync(target, { idempotent: true });
  } catch {
    // A missing file, or a URI the filesystem cannot delete, must not block the record removal.
  }
}

/** Deletes the saved photo, the reference when one was stored, and the sketchbook record. */
export async function deleteSketch(sketchId: string): Promise<void> {
  const id = sketchId.trim();
  if (!id) return;
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  const parsed: unknown = raw ? JSON.parse(raw) : [];
  if (!Array.isArray(parsed)) throw new Error('Sketch list could not be read.');
  const stored = parsed.find((item) => storedId(item) === id);
  const record = normalizeSketch(stored);
  await deleteStoredUri(record?.photoUri ?? storedUri(stored, 'photoUri'));
  await deleteStoredUri(record?.referenceUri ?? storedUri(stored, 'referenceUri'));
  const next = parsed.filter((item) => storedId(item) !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function totalDrawingSeconds(sketches: SketchRecord[]): number {
  return sketches.reduce((sum, sketch) => sum + sketch.duration, 0);
}

function dayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Consecutive days with a drawing, counting back from today (or yesterday if today is still empty). */
export function sevenDayStreak(sketches: SketchRecord[]): number {
  const days = new Set<string>();
  for (const sketch of sketches) {
    const date = new Date(sketch.timestamp);
    if (!Number.isNaN(date.getTime())) days.add(dayKey(date));
  }

  const cursor = new Date();
  if (!days.has(dayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(dayKey(cursor))) return 0;
  }

  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  if (seconds < 60) return seconds === 1 ? '1 sec' : `${seconds} sec`;
  const minutes = Math.floor(seconds / 60);
  const remain = seconds % 60;
  if (minutes < 60) {
    if (remain === 0) return minutes === 1 ? '1 min' : `${minutes} min`;
    return `${minutes} min ${remain} sec`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return hours === 1 ? '1 hr' : `${hours} hr`;
  return `${hours} hr ${mins} min`;
}
