import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(join(__dirname, '../../../../global.css'), 'utf8');

function parseThemes(source: string): Record<string, Record<string, string>> {
  const themes: Record<string, Record<string, string>> = {};
  for (const [, name, body] of source.matchAll(/@variant\s+([\w-]+)\s*\{([^}]*)\}/g)) {
    themes[name] = Object.fromEntries(
      [...body.matchAll(/--color-([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map(([, token, hex]) => [token, hex]),
    );
  }
  return themes;
}

function luminance(hex: string): number {
  const channel = (offset: number) => {
    const c = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// [foreground, background, minimum]: 4.5 for text (WCAG 1.4.3), 3 for UI boundaries and focus rings (1.4.11).
const PAIRS: [string, string, number][] = [
  ['on-surface', 'surface', 4.5],
  ['on-surface-variant', 'surface', 4.5],
  ['on-surface', 'surface-variant', 4.5],
  ['on-surface-variant', 'surface-variant', 4.5],
  ['primary', 'surface', 4.5],
  ['on-primary', 'primary', 4.5],
  ['on-warning', 'warning', 4.5],
  ['error', 'surface', 4.5],
  ['on-error', 'error', 4.5],
  ['outline', 'surface', 3],
  ['focus', 'surface', 3],
];

const themes = parseThemes(css);

it('defines light, dark and black with the same tokens', () => {
  expect(Object.keys(themes).sort()).toEqual(['black', 'dark', 'light']);
  expect(Object.keys(themes.dark).sort()).toEqual(Object.keys(themes.light).sort());
  expect(Object.keys(themes.black).sort()).toEqual(Object.keys(themes.light).sort());
});

it('computes the reference contrast of black on white', () => {
  expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
});

describe.each(['light', 'dark', 'black'])('%s theme', (name) => {
  it.each(PAIRS)('%s on %s meets %s:1', (fg, bg, min) => {
    const theme = themes[name];
    expect(theme[fg]).toBeDefined();
    expect(theme[bg]).toBeDefined();
    expect(contrast(theme[fg], theme[bg])).toBeGreaterThanOrEqual(min);
  });
});
