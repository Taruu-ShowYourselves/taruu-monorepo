import type { Locale } from './config';

const dictionaries = {
  he: () => import('./dictionaries/he.json').then((module) => module.default),
  en: () => import('./dictionaries/en.json').then((module) => module.default),
};

export const getDictionary = async (locale: Locale) => {
  return dictionaries[locale]();
};
