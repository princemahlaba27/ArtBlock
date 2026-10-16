import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';

import { noteSketchSaved } from './preferences';

const STORAGE_KEY = '@artblock/sketches';
const FOLDER_NAME = 'sketches';

export type SketchRecord = {
  id: string;
  title: string;
  seconds: number;
  date: string;
  photoFilename: string;
};

function sketchesDirectory(): Directory {
  const directory = new Directory(Paths.document, FOLDER_NAME);
  if (!directory.exists) {
    directory.create();
  }
  return directory;
}

function isRecord(value: unknown): value is SketchRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<SketchRecord>;
  return (
    typeof record.id === 'string' &&
    typeof record.title === 'string' &&
    typeof record.seconds === 'number' &&
    typeof record.date === 'string' &&
    typeof record.photoFilename === 'string'
  );
}

export async function listSketches(): Promise<SketchRecord[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error('Sketch list could not be read.');
  }
  return parsed.filter(isRecord);
}

export async function saveSketch(input: {
  title: string;
  seconds: number;
  photoUri: string;
}): Promise<{ record: SketchRecord; total: number; photoUri: string }> {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const photoFilename = `${id}.jpg`;
  const source = new File(input.photoUri);
  const destination = new File(sketchesDirectory(), photoFilename);
  await source.copy(destination);

  const existing = await listSketches();
  const record: SketchRecord = {
    id,
    title: input.title,
    seconds: Math.max(0, Math.round(input.seconds)),
    date: new Date().toISOString(),
    photoFilename,
  };
  const next = [record, ...existing];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  await noteSketchSaved();
  return { record, total: next.length, photoUri: destination.uri };
}

export function sketchPhotoUri(filename: string): string {
  return new File(Paths.document, FOLDER_NAME, filename).uri;
}

export function totalDrawingSeconds(sketches: SketchRecord[]): number {
  return sketches.reduce((sum, sketch) => sum + sketch.seconds, 0);
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
    const date = new Date(sketch.date);
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
