/**
 * Premium consumer palette.
 * Primary #FF3366, background #F8F9FA, cards #FFFFFF.
 * Headings Plus Jakarta Sans. Body Inter.
 */
export const colors = {
  canvas: '#F8F9FA',
  card: '#FFFFFF',
  white: '#FFFFFF',
  stroke: '#E6E6EB',
  brand: '#FF3366',
  accent: '#FF3366',
  ink: '#1C1C1E',
  muted: '#8E8E93',
  hud: 'rgba(28, 28, 30, 0.92)',
  neon: '#00E5FF',
  paywall: '#1C1C1E',
} as const;

export const layout = {
  cardRadius: 24,
  pillHeight: 56,
  pillRadius: 24,
} as const;

/** Every white card and container. */
export const shadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.08,
  shadowRadius: 16,
  elevation: 10,
} as const;

/** Magenta actions lift off the page. */
export const buttonShadow = {
  shadowColor: '#FF3366',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.32,
  shadowRadius: 16,
  elevation: 10,
} as const;

export const fonts = {
  heading: 'PlusJakartaSans_800ExtraBold',
  headingBold: 'PlusJakartaSans_700Bold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
} as const;
