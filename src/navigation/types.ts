export type DeckParams = {
  title: string;
  prompts: string[];
  /** One photo fills the stencil. A spread uses the four polaroid slots. */
  mode?: 'single' | 'spread';
  /** Line-art image for each prompt. Missing slots are null. */
  slots?: (string | null)[];
  imageUri?: string;
};

export type PaywallParams = DeckParams & {
  intent?: 'deck' | 'trace';
};

export type RevealParams = {
  title: string;
  /** Saved sketch id. Absent until the drawing is stored in the sketchbook. */
  id?: string;
  /** Line-art stencil from a live trace. Omitted when a saved sketch has no stencil. */
  svg?: string;
  photoUri: string;
  /** Seconds spent drawing. Live traces pass this; saved sketches pass `duration`. */
  seconds?: number;
  duration?: number;
  timestamp?: string;
  /** Original reference from a live trace, before it is copied into the document directory. */
  imageUri?: string;
  /** Permanent reference image. Shown on the Reference tab when present. */
  referenceUri?: string;
};

export type RootStackParamList = {
  Welcome: undefined;
  Studio: undefined;
  Settings: undefined;
  Canvas: DeckParams;
  Paywall: PaywallParams;
  Trace: DeckParams;
  Reveal: RevealParams;
  Sketchbook: undefined;
};
