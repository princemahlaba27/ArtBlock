export type TraceParams = {
  title: string;
  subjectId: string;
  plantId: string;
  frameId: string;
  quoteId: string;
};

export type RevealParams = {
  title: string;
  svg: string;
  photoUri: string;
  seconds: number;
};

export type RootStackParamList = {
  Ideas: undefined;
  Paywall: TraceParams;
  Trace: TraceParams;
  Reveal: RevealParams;
  Sketchbook: undefined;
};
