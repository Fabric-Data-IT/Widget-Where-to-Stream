export type Locale = 'en' | 'es' | 'pt';

export const LOCALES: readonly Locale[] = ['en', 'es', 'pt'];

/** `{c}` = país; `{x}` = atributo faltante. */
const STRINGS = {
  en: {
    title: 'Where to stream',
    subscription: 'Stream',
    free: 'Free',
    rent: 'Rent',
    buy: 'Buy',
    ads: 'with ads',
    empty: 'Not available to stream in {c} right now.',
    error: 'Streaming options are unavailable right now.',
    config: 'Widget not configured: missing “{x}”.',
    newTab: 'opens in a new tab',
    on: 'Watch on',
    powered: 'Powered by',
    loading: 'Loading streaming options',
  },
  es: {
    title: 'Dónde ver',
    subscription: 'Suscripción',
    free: 'Gratis',
    rent: 'Alquiler',
    buy: 'Compra',
    ads: 'con anuncios',
    empty: 'Por ahora no está disponible en {c}.',
    error: 'No pudimos cargar dónde verlo.',
    config: 'Widget sin configurar: falta “{x}”.',
    newTab: 'se abre en una pestaña nueva',
    on: 'Ver en',
    powered: 'Con datos de',
    loading: 'Cargando dónde ver',
  },
  pt: {
    title: 'Onde assistir',
    subscription: 'Assinatura',
    free: 'Grátis',
    rent: 'Aluguel',
    buy: 'Compra',
    ads: 'com anúncios',
    empty: 'Não disponível em {c} no momento.',
    error: 'Não foi possível carregar onde assistir.',
    config: 'Widget não configurado: falta “{x}”.',
    newTab: 'abre em uma nova aba',
    on: 'Assistir em',
    powered: 'Dados de',
    loading: 'Carregando onde assistir',
  },
} as const;

export type Key = keyof (typeof STRINGS)['en'];

export function locale(value: string | null): Locale {
  const l = (value || '').slice(0, 2).toLowerCase();
  return (LOCALES as readonly string[]).includes(l) ? (l as Locale) : 'en';
}

export function t(l: Locale, key: Key, vars: Record<string, string> = {}): string {
  return STRINGS[l][key].replace(/\{(\w)\}/g, (_, k: string) => vars[k] ?? '');
}

/** `US` → `United States` en el idioma del widget. Si no resuelve, el código. */
export function countryName(l: Locale, iso2: string): string {
  try {
    return new Intl.DisplayNames([l], { type: 'region' }).of(iso2) ?? iso2;
  } catch {
    return iso2;
  }
}

export function formatPrice(l: Locale, amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(l, { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}
