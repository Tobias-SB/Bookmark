import { en } from './en';

export type TranslationKey = keyof typeof en;

export function t(key: TranslationKey): string {
  return en[key];
}
