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
  /** Line-art stencil from a live trace. Omitted when a saved sketch has no stencil. */
  svg?: string;
  photoUri: string;
  seconds: number;
  /** Original reference photo or line-art image, when one was stored with the trace. */
  imageUri?: string;
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
