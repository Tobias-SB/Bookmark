// https://docs.expo.dev/guides/using-eslint/
// Architecture red flags from CLAUDE.md and spec §16. Rules lint cannot express stay with review and tests.
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

const SYNCED_TABLES = 'readables|notes|shelves|shelf_items|reading_events|covers';
const PALETTE =
  'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black';
const COLOUR_UTILITIES = 'bg|text|border|ring|fill|stroke|from|via|to|outline|decoration|divide|placeholder|shadow|accent|caret';

// Each restriction may be allowed in one zone. Flat config replaces (does not merge) a rule's
// options per file, so every zone below re-lists all the restrictions except its own.
const syntax = [
  {
    zone: 'platform',
    selector: "MemberExpression[object.name='Platform'][property.name='OS']",
    message: 'Platform.OS only in src/platform/; use PlatformCapabilities or an adapter (spec §5.2).',
  },
  {
    zone: 'http',
    selector: "MemberExpression[object.name=/^(globalThis|window|self)$/][property.name='fetch']",
    message: 'fetch only in src/shared/http/ (spec §13.1).',
  },
  {
    selector: 'MemberExpression[property.name=/^(localStorage|sessionStorage)$/]',
    message: 'No localStorage or sessionStorage: all persistence is SQLite (spec §4).',
  },
  ...['Literal[value', 'TemplateElement[value.raw'].flatMap((node) => [
    {
      zone: 'repository',
      selector: `${node}=/DELETE\\s+FROM\\s+["\`]?(${SYNCED_TABLES})\\b/i]`,
      message: 'Synced rows are tombstoned. DELETE FROM only in a repository purgeTombstonesOlderThan (spec §8.6).',
    },
    {
      selector: `${node}=/DELETE\\s+FROM\\s+["\`]?id_aliases\\b/i]`,
      message: 'id_aliases rows are never deleted (spec §8.3).',
    },
    {
      zone: 'theme',
      selector: `${node}=/(^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$)|\\b(rgba?|hsla?)\\(|\\[#[0-9a-f]+\\]|\\b(${COLOUR_UTILITIES})-(${PALETTE})(-\\d{2,3})?\\b/i]`,
      message: 'No raw colours: use semantic token classes (spec §14).',
    },
    {
      zone: 'web',
      selector: `${node}=/ko-?fi/i]`,
      message: 'Ko-fi only in .web.ts(x) files; it must never reach native builds (spec §12.12).',
    },
  ]),
  {
    zone: 'theme',
    selector:
      "Property[key.name=/[cC]olou?r$/] > Literal.value[value=/^(?!transparent$|currentColor$|inherit$)[a-zA-Z]+$/]",
    message: 'No named colours: use semantic tokens (spec §14).',
  },
  {
    zone: 'web',
    selector: "Identifier[name='KOFI_URL']",
    message: 'KOFI_URL only in .web.ts(x) files (spec §12.12).',
  },
];

const ZONES = {
  platform: ['src/platform/**'],
  http: ['src/shared/http/**'],
  repository: ['src/features/*/data/*Repository.ts'],
  // app.config.ts: the Android adaptive-icon background must be a literal colour.
  theme: ['src/app/theme/**', 'app.config.ts'],
  web: ['**/*.web.ts', '**/*.web.tsx'],
};

const restrictedSyntax = (zone) => [
  'error',
  ...syntax.filter((r) => r.zone !== zone).map(({ selector, message }) => ({ selector, message })),
];

const storageGlobals = ['localStorage', 'sessionStorage'].map((name) => ({
  name,
  message: 'No localStorage or sessionStorage: all persistence is SQLite (spec §4).',
}));
const fetchGlobal = { name: 'fetch', message: 'fetch only in src/shared/http/ (spec §13.1).' };

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*', 'src/uniwind-types.d.ts', 'expo-env.d.ts'],
  },
  {
    rules: {
      'no-restricted-syntax': restrictedSyntax(null),
      'no-restricted-globals': ['error', fetchGlobal, ...storageGlobals],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@react-native-async-storage/async-storage',
              message: 'No AsyncStorage: all persistence is SQLite (spec §4).',
            },
          ],
          patterns: [
            {
              regex: '^react-native-paper($|/)|blur|^victory|chart|^d3($|-)',
              message: 'No styled component, blur or chart libraries (spec §4).',
            },
          ],
        },
      ],
    },
  },
  ...Object.entries(ZONES).map(([zone, files]) => ({
    files,
    rules: { 'no-restricted-syntax': restrictedSyntax(zone) },
  })),
  {
    files: ZONES.http,
    rules: { 'no-restricted-globals': ['error', ...storageGlobals] },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': 'error',
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        { assertionStyle: 'as', objectLiteralTypeAssertions: 'never' },
      ],
    },
  },
  {
    // These files hold the red flags as data: rule messages and lint fixtures.
    files: ['eslint.config.js', 'src/__tests__/lint/**'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  {
    files: ['**/*.tsx'],
    ignores: ['**/__tests__/**'],
    rules: { 'react/jsx-no-literals': ['error', { noStrings: true, ignoreProps: true }] },
  },
]);
