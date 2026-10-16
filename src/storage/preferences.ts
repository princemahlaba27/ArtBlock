import AsyncStorage from '@react-native-async-storage/async-storage';

const FLAGS_KEY = '@artblock/flags';
const LATER_KEY = '@artblock/draw-later';
const FEEDBACK_KEY = '@artblock/feedback';

export type AppFlags = {
  sessions: number;
  firstSketchSession: number | null;
  attAsked: boolean;
  paywallPassed: boolean;
  premium: boolean;
};

export type DrawLaterIdea = {
  id: string;
  title: string;
  subjectId: string;
  plantId: string;
  frameId: string;
  quoteId: string;
  savedAt: string;
};

const emptyFlags = (): AppFlags => ({
  sessions: 0,
  firstSketchSession: null,
  attAsked: false,
  paywallPassed: false,
  premium: false,
});

function readFlags(value: unknown): AppFlags {
  const flags = emptyFlags();
  if (!value || typeof value !== 'object') return flags;
  const raw = value as Partial<AppFlags>;
  if (typeof raw.sessions === 'number') flags.sessions = raw.sessions;
  if (typeof raw.firstSketchSession === 'number') flags.firstSketchSession = raw.firstSketchSession;
  if (typeof raw.attAsked === 'boolean') flags.attAsked = raw.attAsked;
  if (typeof raw.paywallPassed === 'boolean') flags.paywallPassed = raw.paywallPassed;
  if (typeof raw.premium === 'boolean') flags.premium = raw.premium;
  else flags.premium = flags.paywallPassed;
  return flags;
}

async function loadFlags(): Promise<AppFlags> {
  const raw = await AsyncStorage.getItem(FLAGS_KEY);
  if (!raw) return emptyFlags();
  return readFlags(JSON.parse(raw) as unknown);
}

async function storeFlags(flags: AppFlags): Promise<void> {
  await AsyncStorage.setItem(FLAGS_KEY, JSON.stringify(flags));
}

export async function bumpSession(): Promise<AppFlags> {
  const flags = await loadFlags();
  flags.sessions += 1;
  await storeFlags(flags);
  return flags;
}

export async function currentFlags(): Promise<AppFlags> {
  return loadFlags();
}

export async function shouldAskTracking(): Promise<boolean> {
  const flags = await loadFlags();
  return (
    flags.firstSketchSession != null &&
    flags.sessions > flags.firstSketchSession &&
    !flags.attAsked
  );
}

export async function markTrackingAsked(): Promise<void> {
  const flags = await loadFlags();
  flags.attAsked = true;
  await storeFlags(flags);
}

export async function markPaywallPassed(): Promise<void> {
  const flags = await loadFlags();
  flags.paywallPassed = true;
  await storeFlags(flags);
}

export async function isPaywallPassed(): Promise<boolean> {
  const flags = await loadFlags();
  return flags.paywallPassed || flags.premium;
}

/** Local stand-in for a store subscription. Also opens the paywall gate. */
export async function grantPremium(): Promise<void> {
  const flags = await loadFlags();
  flags.premium = true;
  flags.paywallPassed = true;
  await storeFlags(flags);
}

export async function isPremium(): Promise<boolean> {
  const flags = await loadFlags();
  return flags.premium || flags.paywallPassed;
}

/** Remember which visit the first saved drawing happened on. */
export async function noteSketchSaved(): Promise<void> {
  const flags = await loadFlags();
  if (flags.firstSketchSession == null) {
    flags.firstSketchSession = Math.max(flags.sessions, 1);
    await storeFlags(flags);
  }
}

export async function saveDrawLater(idea: Omit<DrawLaterIdea, 'id' | 'savedAt'>): Promise<void> {
  const raw = await AsyncStorage.getItem(LATER_KEY);
  const existing: DrawLaterIdea[] = raw ? (JSON.parse(raw) as DrawLaterIdea[]) : [];
  const next: DrawLaterIdea = {
    ...idea,
    id: `${Date.now().toString(36)}`,
    savedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(LATER_KEY, JSON.stringify([next, ...existing].slice(0, 40)));
}

export async function saveFeedback(note: string, stars: number): Promise<void> {
  const raw = await AsyncStorage.getItem(FEEDBACK_KEY);
  const existing: unknown[] = raw ? (JSON.parse(raw) as unknown[]) : [];
  existing.unshift({ note, stars, savedAt: new Date().toISOString() });
  await AsyncStorage.setItem(FEEDBACK_KEY, JSON.stringify(existing.slice(0, 40)));
}
