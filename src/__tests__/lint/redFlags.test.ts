import { ESLint, type Linter } from 'eslint';
import { join } from 'node:path';

const root = join(__dirname, '../../..');
// eslint-disable-next-line @typescript-eslint/no-require-imports -- loads the real CommonJS config under test
const config: Linter.Config[] = require(join(root, 'eslint.config.js'));
const eslint = new ESLint({ cwd: root, overrideConfigFile: true, overrideConfig: config });

const RED_FLAG_RULES = new Set([
  'no-restricted-syntax',
  'no-restricted-globals',
  'no-restricted-imports',
  '@typescript-eslint/no-explicit-any',
  '@typescript-eslint/ban-ts-comment',
  '@typescript-eslint/consistent-type-assertions',
  'react/jsx-no-literals',
]);

async function redFlags(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: join(root, filePath) });
  const fatal = result.messages.find((m) => m.fatal);
  if (fatal) throw new Error(`Fixture does not parse: ${fatal.message}`);
  return result.messages.flatMap((m) => (m.ruleId && RED_FLAG_RULES.has(m.ruleId) ? [m.ruleId] : []));
}

jest.setTimeout(60_000);

const FEATURE = 'src/features/readables/services/example.ts';
const COMPONENT = 'src/shared/components/Example.tsx';

describe.each<[string, string, string, string]>([
  // [red flag, code, flagged path, allowed path]
  ['Platform.OS', "import { Platform } from 'react-native';\nexport const os = Platform.OS;", FEATURE, 'src/platform/capabilities.ts'],
  ['global fetch', "export const get = () => fetch('https://example.org');", FEATURE, 'src/shared/http/httpClient.ts'],
  ['window.fetch', "export const get = () => window.fetch('https://example.org');", FEATURE, 'src/shared/http/httpClient.ts'],
  [
    'DELETE FROM a synced table',
    "export const purge = (cutoff: string) => ['DELETE FROM readables WHERE deleted_at < ?', cutoff];",
    FEATURE,
    'src/features/readables/data/readableRepository.ts',
  ],
  [
    'DELETE FROM in a template',
    'export const sql = `DELETE FROM shelf_items WHERE deleted_at < ${0}`;',
    'src/features/shelves/data/shelfService.ts',
    'src/features/shelves/data/shelfRepository.ts',
  ],
  ['hex colour', "export const tint = '#ffffff';", COMPONENT, 'src/app/theme/palette.ts'],
  ['rgb colour', "export const tint = 'rgb(0, 0, 0)';", COMPONENT, 'src/app/theme/palette.ts'],
  ['palette class', "export const cls = 'flex-1 bg-red-500';", COMPONENT, 'src/app/theme/palette.ts'],
  ['arbitrary colour class', "export const cls = 'text-[#123456]';", COMPONENT, 'src/app/theme/palette.ts'],
  ['named colour on a style key', "export const s = { backgroundColor: 'red' };", COMPONENT, 'src/app/theme/palette.ts'],
  ['Ko-fi link', "export const link = 'https://ko-fi.com/bookmark';", 'src/platform/support.ts', 'src/platform/support.web.ts'],
  ['KOFI_URL', 'const KOFI_URL = 1;\nexport default KOFI_URL;', 'src/platform/support.ts', 'src/platform/support.web.ts'],
  [
    'JSX text outside t()',
    "import { Text } from 'react-native';\nexport const C = () => <Text>Hello</Text>;",
    COMPONENT,
    'src/shared/components/__tests__/Example.test.tsx',
  ],
])('%s', (_flag, code, flaggedPath, allowedPath) => {
  it('is flagged outside its allowed place', async () => {
    expect(await redFlags(code, flaggedPath)).not.toEqual([]);
  });

  it('is allowed in its place', async () => {
    expect(await redFlags(code, allowedPath)).toEqual([]);
  });
});

describe.each<[string, string]>([
  ['DELETE FROM id_aliases, even in a repository', "export const sql = 'DELETE FROM id_aliases';"],
  ['localStorage', "export const v = localStorage.getItem('k');"],
  ['window.sessionStorage', "export const v = window.sessionStorage.getItem('k');"],
  ['AsyncStorage', "import AsyncStorage from '@react-native-async-storage/async-storage';\nexport default AsyncStorage;"],
  ['react-native-paper', "import { Button } from 'react-native-paper';\nexport default Button;"],
  ['a blur library', "import { BlurView } from 'expo-blur';\nexport default BlurView;"],
  ['a chart library', "import { LineChart } from 'react-native-chart-kit';\nexport default LineChart;"],
  ['d3', "import { scaleLinear } from 'd3-scale';\nexport default scaleLinear;"],
  ['any', 'export const f = (x: any) => x;'],
  ['@ts-ignore', '// @ts-ignore\nexport const n: number = 1;'],
  ['an object literal assertion', 'type P = { a: number };\nexport const p = {} as P;'],
])('%s is flagged everywhere', (_flag, code) => {
  it.each([
    'src/features/readables/data/readableRepository.ts',
    'src/shared/http/httpClient.ts',
    'src/app/theme/palette.ts',
    'src/platform/support.web.ts',
  ])('in %s', async (path) => {
    expect(await redFlags(code, path)).not.toEqual([]);
  });
});

describe('does not flag ordinary code', () => {
  it.each<[string, string]>([
    ['token classes', "export const cls = 'bg-surface text-on-surface border-outline';"],
    ['a hash that is not a colour', "export const label = '#1 pick';"],
    ['transparent', "export const s = { backgroundColor: 'transparent' };"],
    ['as const', "export const tabs = ['a', 'b'] as const;"],
    ['a DELETE on a device-local table', "export const sql = 'DELETE FROM wip_updates WHERE is_read = 1';"],
    ['JSX through t()', "import { Text } from 'react-native';\nconst t = (k: string) => k;\nexport const C = () => <Text>{t('k')}</Text>;"],
  ])('%s', async (_label, code) => {
    expect(await redFlags(code, COMPONENT)).toEqual([]);
  });
});
