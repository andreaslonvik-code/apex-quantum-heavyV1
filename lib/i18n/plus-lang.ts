export const PLUS_LANGS = ['no', 'en', 'de', 'es', 'zh'] as const;
export type PlusLang = (typeof PLUS_LANGS)[number];

export const PLUS_LANG_LABELS: Record<PlusLang, string> = {
  no: 'NO',
  en: 'EN',
  de: 'DE',
  es: 'ES',
  zh: '中',
};

export const PLUS_LANG_FULL: Record<PlusLang, string> = {
  no: 'Norsk',
  en: 'English',
  de: 'Deutsch',
  es: 'Español',
  zh: '中文',
};

export function isPlusLang(v: unknown): v is PlusLang {
  return typeof v === 'string' && (PLUS_LANGS as readonly string[]).includes(v);
}
