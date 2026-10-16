import { colors } from '../theme/colors';

export type LineMode = 'normal' | 'ink' | 'neon';

export type StencilPiece = {
  id: string;
  label: string;
  paths: string;
};

export type Reel = {
  key: 'subject' | 'plant' | 'frame' | 'quote';
  label: string;
  viewBox: string;
  items: StencilPiece[];
};

export const lineModes: { id: LineMode; label: string }[] = [
  { id: 'normal', label: 'Normal' },
  { id: 'ink', label: 'Ink' },
  { id: 'neon', label: 'Neon' },
];

export function strokeForMode(mode: LineMode): string {
  if (mode === 'ink') return '#000000';
  if (mode === 'neon') return colors.neon;
  return colors.ink;
}

function paint(paths: string, stroke: string): string {
  const colored = paths.split('{{stroke}}').join(stroke);
  return colored.replace(
    /<(path|ellipse|circle|rect|polygon|polyline)\b(?![^>]*\bfill=)/g,
    '<$1 fill="none"',
  );
}

const subjects: StencilPiece[] = [
  {
    id: 'sitting-cat',
    label: 'Sitting cat',
    paths: `
      <path d="M68 82 L46 30 L80 66 L100 16 L120 66 L154 30 L132 82"/>
      <path d="M58 54 L78 70 M142 54 L122 70"/>
      <ellipse cx="100" cy="104" rx="48" ry="38"/>
      <path d="M76 100 Q84 92 92 100 M108 100 Q116 92 124 100"/>
      <circle cx="84" cy="100" r="1.7" fill="{{stroke}}" stroke="none"/>
      <circle cx="116" cy="100" r="1.7" fill="{{stroke}}" stroke="none"/>
      <path d="M100 112 L94 118 L106 118 Z"/>
      <path d="M94 118 Q100 126 106 118"/>
      <path d="M100 118 V130"/>
      <path d="M62 186 Q58 168 70 158"/>
      <path d="M138 186 Q142 168 130 158"/>
      <path d="M56 132 Q44 184 76 204 Q100 216 124 204 Q156 184 144 132"/>
      <path d="M144 162 Q184 154 174 102 Q166 76 144 94"/>
      <path d="M74 204 H98 M112 204 H136"/>
      <path d="M78 204 Q82 212 90 204 M116 204 Q122 212 130 204"/>
    `,
  },
  {
    id: 'teacup',
    label: 'Teacup',
    paths: `
      <path d="M78 52 Q70 32 84 20 M100 48 Q92 26 104 12 M122 52 Q114 32 128 20"/>
      <ellipse cx="100" cy="72" rx="54" ry="14"/>
      <path d="M46 74 L58 150 Q100 174 142 150 L154 74"/>
      <path d="M62 96 Q100 108 138 96"/>
      <ellipse cx="100" cy="150" rx="44" ry="12"/>
      <path d="M154 96 Q190 108 154 136"/>
      <ellipse cx="100" cy="178" rx="72" ry="14"/>
      <path d="M32 178 Q100 202 168 178"/>
    `,
  },
  {
    id: 'sparrow',
    label: 'Sparrow',
    paths: `
      <path d="M36 128 Q70 62 124 74 Q162 82 176 58 L168 84 Q196 96 158 116 Q124 156 66 146 Q24 138 36 128"/>
      <path d="M92 100 Q118 124 154 116"/>
      <path d="M48 118 Q70 108 96 112"/>
      <path d="M36 124 L12 102 M38 130 L10 130 M40 138 L16 154"/>
      <circle cx="150" cy="82" r="3.2"/>
      <circle cx="151" cy="82" r="1.2" fill="{{stroke}}" stroke="none"/>
      <path d="M176 58 L202 66 L172 78"/>
      <path d="M96 146 L90 174 M90 174 L78 182 M90 174 L100 184"/>
      <path d="M124 148 L126 174 M126 174 L114 182 M126 174 L138 184"/>
    `,
  },
  {
    id: 'moth',
    label: 'Moth',
    paths: `
      <path d="M100 108 Q28 36 58 108 Q24 176 100 138 Q176 176 142 108 Q172 36 100 108"/>
      <path d="M100 112 Q36 92 58 132 Q78 154 100 132"/>
      <path d="M100 112 Q164 92 142 132 Q122 154 100 132"/>
      <path d="M86 96 Q70 78 78 64 M114 96 Q130 78 122 64"/>
      <ellipse cx="100" cy="112" rx="9" ry="32"/>
      <path d="M94 82 Q78 52 66 40 M106 82 Q122 52 134 40"/>
      <circle cx="66" cy="38" r="3.2"/>
      <circle cx="134" cy="38" r="3.2"/>
      <path d="M100 96 V132"/>
    `,
  },
  {
    id: 'fox',
    label: 'Fox',
    paths: `
      <path d="M52 96 L34 28 L84 72 L100 36 L116 72 L166 28 L148 96 Q100 158 52 96"/>
      <path d="M62 70 L80 78 M138 70 L120 78"/>
      <path d="M74 102 Q82 94 90 102 M110 102 Q118 94 126 102"/>
      <circle cx="82" cy="102" r="1.6" fill="{{stroke}}" stroke="none"/>
      <circle cx="118" cy="102" r="1.6" fill="{{stroke}}" stroke="none"/>
      <path d="M88 122 Q100 132 112 122"/>
      <path d="M100 122 V136 M92 136 Q100 144 108 136"/>
      <path d="M68 150 Q56 196 100 208 Q144 196 132 150"/>
      <path d="M132 168 Q182 156 170 108 Q152 96 140 118"/>
      <path d="M162 118 Q174 112 170 124"/>
    `,
  },
  {
    id: 'snail',
    label: 'Snail',
    paths: `
      <path d="M118 150 Q156 150 156 118 Q156 82 118 82 Q80 82 80 112 Q80 138 112 138 Q132 138 132 116 Q132 102 116 102"/>
      <path d="M104 118 Q116 108 128 118"/>
      <path d="M112 154 Q78 162 36 150 Q14 144 26 134 Q52 140 92 136"/>
      <path d="M36 148 Q24 118 16 104 M46 144 Q58 118 66 102"/>
      <circle cx="16" cy="102" r="3.4"/>
      <circle cx="66" cy="100" r="3.4"/>
      <path d="M30 150 Q24 158 18 154"/>
    `,
  },
  {
    id: 'rabbit',
    label: 'Rabbit',
    paths: `
      <path d="M72 96 Q62 22 86 16 Q104 12 94 96"/>
      <path d="M112 96 Q104 12 122 16 Q146 22 132 96"/>
      <path d="M78 88 Q72 42 86 34 Q96 30 90 88"/>
      <path d="M114 88 Q110 30 120 34 Q134 42 126 88"/>
      <ellipse cx="100" cy="118" rx="42" ry="34"/>
      <circle cx="84" cy="116" r="2.4" fill="{{stroke}}" stroke="none"/>
      <circle cx="116" cy="116" r="2.4" fill="{{stroke}}" stroke="none"/>
      <path d="M100 126 L96 132 L104 132 Z"/>
      <path d="M96 132 Q100 140 104 132"/>
      <path d="M78 142 Q62 150 70 158 M122 142 Q138 150 130 158"/>
      <ellipse cx="100" cy="176" rx="50" ry="34"/>
      <ellipse cx="76" cy="206" rx="18" ry="8"/>
      <ellipse cx="124" cy="206" rx="18" ry="8"/>
    `,
  },
  {
    id: 'koi',
    label: 'Koi',
    paths: `
      <path d="M28 112 Q78 58 140 78 Q186 96 164 124 Q188 154 140 158 Q78 176 28 122 Q52 116 28 112"/>
      <path d="M28 112 L6 82 L22 116 L6 150 L28 122"/>
      <path d="M104 82 L92 48 L126 80"/>
      <path d="M108 152 L98 184 L132 150"/>
      <circle cx="150" cy="108" r="4"/>
      <circle cx="151" cy="108" r="1.4" fill="{{stroke}}" stroke="none"/>
      <path d="M78 114 Q96 102 112 114 Q96 126 78 114"/>
      <path d="M114 120 Q132 108 146 122"/>
      <path d="M70 100 Q90 92 104 100"/>
    `,
  },
];

const plants: StencilPiece[] = [
  {
    id: 'lilies',
    label: 'Lilies',
    paths: `
      <path d="M70 132 V46 M140 132 V34 M210 132 V54"/>
      <path d="M70 100 Q36 78 46 52 Q70 74 70 100"/>
      <path d="M140 92 Q104 70 116 46 Q140 68 140 92"/>
      <path d="M210 104 Q246 78 234 52 Q210 78 210 104"/>
      <path d="M70 46 Q54 28 62 12 Q78 26 70 46 Q86 28 78 12 Q62 26 70 46"/>
      <path d="M70 46 Q52 36 46 22 M70 46 Q88 36 94 22"/>
      <path d="M140 34 Q122 16 132 2 Q148 16 140 34 Q158 16 148 2 Q132 16 140 34"/>
      <path d="M140 34 Q122 24 116 10 M140 34 Q158 24 164 10"/>
      <path d="M210 54 Q194 36 204 22 Q218 36 210 54 Q226 36 216 22 Q202 36 210 54"/>
      <circle cx="70" cy="42" r="2" fill="{{stroke}}" stroke="none"/>
      <circle cx="140" cy="30" r="2" fill="{{stroke}}" stroke="none"/>
      <circle cx="210" cy="50" r="2" fill="{{stroke}}" stroke="none"/>
    `,
  },
  {
    id: 'fern',
    label: 'Fern',
    paths: `
      <path d="M140 132 C140 90 138 48 140 16"/>
      <path d="M140 112 C112 104 92 88 74 66"/>
      <path d="M140 112 C168 104 188 88 206 66"/>
      <path d="M140 92 C116 84 100 70 86 52"/>
      <path d="M140 92 C164 84 180 70 194 52"/>
      <path d="M140 72 C120 66 108 56 98 42"/>
      <path d="M140 72 C160 66 172 56 182 42"/>
      <path d="M140 52 C126 48 118 40 110 30"/>
      <path d="M140 52 C154 48 162 40 170 30"/>
      <path d="M122 100 l-8 -6 M128 90 l-6 -6 M156 100 l8 -6 M152 90 l6 -6"/>
      <path d="M118 80 l-7 -5 M160 80 l7 -5 M124 62 l-6 -4 M156 62 l6 -4"/>
    `,
  },
  {
    id: 'olive-sprig',
    label: 'Olive sprig',
    paths: `
      <path d="M28 118 C90 96 150 70 252 28"/>
      <path d="M62 104 Q48 88 66 80 Q82 92 62 104"/>
      <path d="M92 94 Q78 78 96 70 Q112 82 92 94"/>
      <path d="M122 82 Q108 66 126 58 Q142 70 122 82"/>
      <path d="M152 70 Q138 54 156 46 Q172 58 152 70"/>
      <path d="M182 58 Q168 42 186 34 Q202 46 182 58"/>
      <path d="M74 108 Q88 122 70 128 Q56 116 74 108"/>
      <path d="M108 96 Q122 110 104 118 Q90 104 108 96"/>
      <path d="M142 84 Q156 98 138 106 Q124 92 142 84"/>
      <path d="M176 70 Q190 84 172 92 Q158 78 176 70"/>
      <path d="M208 56 Q220 68 204 76 Q190 64 208 56"/>
    `,
  },
  {
    id: 'wild-rose',
    label: 'Wild rose',
    paths: `
      <path d="M110 132 C108 96 112 70 140 48"/>
      <path d="M110 108 Q74 96 70 70 Q96 78 112 96"/>
      <path d="M116 86 Q150 74 168 90 Q140 98 118 90"/>
      <circle cx="168" cy="46" r="28"/>
      <path d="M168 18 Q176 34 196 36 Q178 44 176 62 Q164 46 148 58 Q156 40 140 34 Q158 30 168 18"/>
      <circle cx="168" cy="40" r="4"/>
      <path d="M196 46 Q214 40 220 28"/>
    `,
  },
  {
    id: 'dandelion',
    label: 'Dandelion',
    paths: `
      <path d="M92 132 C96 96 100 70 104 48"/>
      <path d="M92 108 Q60 100 48 82 Q72 88 90 100"/>
      <circle cx="112" cy="36" r="26"/>
      <path d="M112 10 V4 M112 62 V68 M86 36 H78 M138 36 H146"/>
      <path d="M94 18 L86 10 M130 18 L138 10 M94 54 L86 62 M130 54 L138 62"/>
      <path d="M150 28 Q166 22 170 12 M156 48 Q174 52 184 46"/>
      <path d="M168 14 l4 6 M182 44 l5 4"/>
      <circle cx="172" cy="12" r="2" fill="{{stroke}}" stroke="none"/>
      <circle cx="188" cy="44" r="2" fill="{{stroke}}" stroke="none"/>
    `,
  },
  {
    id: 'ivy',
    label: 'Ivy',
    paths: `
      <path d="M36 120 C70 110 90 80 120 72 C160 60 190 78 230 40"/>
      <path d="M70 112 Q52 92 70 78 Q92 90 78 112 Q64 124 70 112"/>
      <path d="M112 78 Q96 56 118 48 Q140 62 124 84 Q108 96 112 78"/>
      <path d="M168 70 Q156 48 180 42 Q202 58 186 80 Q166 90 168 70"/>
      <path d="M214 48 Q206 28 228 24 Q246 40 230 56 Q214 64 214 48"/>
      <path d="M70 90 V104 M116 60 V76 M176 54 V70 M222 34 V48"/>
    `,
  },
  {
    id: 'tulip',
    label: 'Tulip',
    paths: `
      <path d="M140 132 V58"/>
      <path d="M140 100 Q86 86 70 48 Q112 70 140 92"/>
      <path d="M140 108 Q196 90 214 52 Q170 78 140 100"/>
      <path d="M140 58 Q112 50 108 28 Q128 36 140 22 Q152 36 172 28 Q168 50 140 58"/>
      <path d="M140 58 V24"/>
      <path d="M124 40 Q140 34 156 40"/>
    `,
  },
  {
    id: 'eucalyptus',
    label: 'Eucalyptus',
    paths: `
      <path d="M140 132 C136 100 132 70 140 18"/>
      <ellipse cx="112" cy="112" rx="22" ry="12" transform="rotate(-40 112 112)"/>
      <ellipse cx="168" cy="104" rx="22" ry="12" transform="rotate(36 168 104)"/>
      <ellipse cx="108" cy="84" rx="20" ry="11" transform="rotate(-32 108 84)"/>
      <ellipse cx="170" cy="76" rx="20" ry="11" transform="rotate(40 170 76)"/>
      <ellipse cx="116" cy="56" rx="18" ry="10" transform="rotate(-28 116 56)"/>
      <ellipse cx="164" cy="50" rx="18" ry="10" transform="rotate(34 164 50)"/>
      <ellipse cx="128" cy="32" rx="14" ry="8" transform="rotate(-24 128 32)"/>
      <ellipse cx="156" cy="28" rx="14" ry="8" transform="rotate(30 156 28)"/>
    `,
  },
];

function laurel(): string {
  const leaves: string[] = [];
  for (let i = 0; i < 8; i += 1) {
    const y = 78 + i * 54;
    leaves.push(
      `<path d="M46 ${y} Q28 ${y - 16} 18 ${y + 2} Q30 ${y + 10} 46 ${y + 16}"/>`,
      `<path d="M314 ${y} Q332 ${y - 16} 342 ${y + 2} Q330 ${y + 10} 314 ${y + 16}"/>`,
    );
  }
  return `
    <path d="M46 70 V500 M314 70 V500"/>
    <path d="M46 70 Q180 24 314 70"/>
    <path d="M46 500 Q180 536 314 500"/>
    ${leaves.join('')}
  `;
}

function scallops(): string {
  const bumps: string[] = [];
  for (let x = 36; x <= 300; x += 36) {
    bumps.push(`Q${x + 18} 16 ${x + 36} 40`);
  }
  return `
    <path d="M36 40 ${bumps.join(' ')}"/>
    <path d="M36 40 V506 Q180 540 324 506 V40"/>
  `;
}

const frames: StencilPiece[] = [
  {
    id: 'simple-border',
    label: 'Simple border',
    paths: `<rect x="24" y="24" width="312" height="512" rx="18"/>`,
  },
  {
    id: 'double-line',
    label: 'Double line',
    paths: `
      <rect x="18" y="18" width="324" height="524" rx="22"/>
      <rect x="34" y="34" width="292" height="492" rx="14"/>
    `,
  },
  {
    id: 'arch',
    label: 'Arch',
    paths: `
      <path d="M44 524 V196 Q44 48 180 48 Q316 48 316 196 V524"/>
      <path d="M44 524 H316"/>
      <path d="M72 524 V214 Q72 86 180 86 Q288 86 288 214 V524"/>
    `,
  },
  {
    id: 'round-window',
    label: 'Round window',
    paths: `
      <rect x="28" y="28" width="304" height="504" rx="16"/>
      <circle cx="180" cy="196" r="112"/>
      <path d="M68 196 H292 M180 84 V308"/>
    `,
  },
  {
    id: 'ticket',
    label: 'Ticket',
    paths: `
      <rect x="28" y="28" width="304" height="504" rx="12"/>
      <circle cx="28" cy="280" r="16"/>
      <circle cx="332" cy="280" r="16"/>
      <path d="M52 280 H308" stroke-dasharray="6 8"/>
    `,
  },
  {
    id: 'corner-marks',
    label: 'Corner marks',
    paths: `
      <path d="M36 92 V36 H92"/>
      <path d="M268 36 H324 V92"/>
      <path d="M324 468 V524 H268"/>
      <path d="M92 524 H36 V468"/>
      <path d="M56 56 H72 M304 56 H288 M56 504 H72 M304 504 H288"/>
    `,
  },
  {
    id: 'laurel',
    label: 'Laurel',
    paths: laurel(),
  },
  {
    id: 'scallops',
    label: 'Scallops',
    paths: scallops(),
  },
];

function quotePaths(phrase: string): string {
  return `
    <path d="M164 10 l16 10 l-16 10 l-16 -10 Z"/>
    <text x="180" y="52" text-anchor="middle" font-size="24" font-family="Georgia, serif" fill="{{stroke}}" stroke="none">${phrase}</text>
  `;
}

const quotes: StencilPiece[] = [
  { id: 'stay-curious', label: 'Stay curious', paths: quotePaths('Stay curious') },
  { id: 'draw-the-quiet', label: 'Draw the quiet', paths: quotePaths('Draw the quiet') },
  { id: 'one-more-line', label: 'One more line', paths: quotePaths('One more line') },
  { id: 'soft-light', label: 'Soft light', paths: quotePaths('Soft light') },
  { id: 'begin-again', label: 'Begin again', paths: quotePaths('Begin again') },
  { id: 'keep-going', label: 'Keep going', paths: quotePaths('Keep going') },
  { id: 'look-closer', label: 'Look closer', paths: quotePaths('Look closer') },
  { id: 'make-it-yours', label: 'Make it yours', paths: quotePaths('Make it yours') },
];

export const reels: Reel[] = [
  { key: 'subject', label: 'Subject', viewBox: '0 0 200 220', items: subjects },
  { key: 'plant', label: 'Plant', viewBox: '0 0 280 140', items: plants },
  { key: 'frame', label: 'Frame', viewBox: '0 0 360 560', items: frames },
  { key: 'quote', label: 'Words', viewBox: '0 0 360 72', items: quotes },
];

export function pieceById(items: StencilPiece[], id: string): StencilPiece {
  return items.find((item) => item.id === id) ?? items[0];
}

export function pieceSvg(paths: string, viewBox: string, mode: LineMode = 'normal'): string {
  const stroke = strokeForMode(mode);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="none"><g fill="none" stroke="${stroke}" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round">${paint(paths, stroke)}</g></svg>`;
}

export function composeStencil(
  subject: StencilPiece,
  plant: StencilPiece,
  frame: StencilPiece,
  quote: StencilPiece,
  mode: LineMode = 'normal',
): string {
  const stroke = strokeForMode(mode);
  const group = `fill="none" stroke="${stroke}" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 560" fill="none"><g id="frame" ${group}>${paint(frame.paths, stroke)}</g><g id="subject" ${group} transform="translate(80,52)">${paint(subject.paths, stroke)}</g><g id="plant" ${group} transform="translate(40,318)">${paint(plant.paths, stroke)}</g><g id="quote" ${group} transform="translate(0,482)">${paint(quote.paths, stroke)}</g></svg>`;
}

export function stencilTitle(
  subject: StencilPiece,
  plant: StencilPiece,
  frame: StencilPiece,
  quote: StencilPiece,
): string {
  return `${subject.label} · ${plant.label} · ${frame.label} · ${quote.label}`;
}
