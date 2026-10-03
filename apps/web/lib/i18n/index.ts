import en from './en';
import ptBR from './pt-BR';
export type { Dictionary } from './en';
export function getDictionary(locale: string | null | undefined) {
  return locale === 'pt-BR' ? ptBR : en;
}
export function supportedLocale(locale: string | null | undefined) {
  return locale === 'pt-BR' ? 'pt-BR' : 'en';
}
