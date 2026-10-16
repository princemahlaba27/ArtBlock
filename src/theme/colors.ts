/**
 * Cozy atelier palette. These nine values are the whole color theme.
 * Cards use a 20 radius. Main actions are 56 tall pills.
 */
export const colors = {
  canvas: '#FDFBF7',
  card: '#F4EFE6',
  stroke: '#E6DFD5',
  brand: '#7B61FF',
  accent: '#E06D53',
  ink: '#1E1E24',
  muted: '#6E6D7A',
  hud: 'rgba(22, 22, 26, 0.90)',
  neon: '#00E5FF',
} as const;

export const layout = {
  cardRadius: 20,
  pillHeight: 56,
  pillRadius: 28,
} as const;
