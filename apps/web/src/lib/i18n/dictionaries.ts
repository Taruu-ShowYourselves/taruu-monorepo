import type { Locale } from './config';

const dictionaries = {
  he: () => import('./dictionaries/he.json').then((module) => module.default),
};

// Hebrew-only site - locale param kept for call-site compatibility.
export const getDictionary = async (_locale: Locale) => {
  return dictionaries.he();
};
