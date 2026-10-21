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
  svg: string;
  photoUri: string;
  seconds: number;
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
