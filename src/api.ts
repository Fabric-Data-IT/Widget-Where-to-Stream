import type { IdType, Monetization, Offer, WhereToStreamResponse } from './types';

/**
 * Base por defecto de la API de widgets de Nexus.
 * [[confirmar: dominio definitivo]] — necesita DNS + API Gateway; ver docs/API-CONTRACT.md.
 */
export const DEFAULT_API_BASE = 'https://widgets.origin.fabricdata.com';

export interface Query {
  apiBase: string;
  id: string;
  idType: IdType;
  country: string;
  locale: string;
  clientKey: string;
}

/** `auth` = key inválida o dominio no autorizado (401/403). `rate` = 429. */
export type ApiErrorKind = 'auth' | 'rate' | 'network' | 'server' | 'invalid';

export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    readonly status = 0,
  ) {
    super(`where-to-stream: ${kind}${status ? ` (${status})` : ''}`);
  }
}

const TIMEOUT_MS = 8000;
const MAX_CACHE = 50;
const MONETIZATIONS: readonly Monetization[] = ['subscription', 'free', 'ads', 'rent', 'buy'];

/**
 * Una sola request por combinación de parámetros, compartida entre instancias: una página con
 * diez widgets del mismo título hace un fetch. Los errores no se cachean.
 */
const cache = new Map<string, Promise<WhereToStreamResponse>>();

export function buildUrl(q: Query): string {
  const u = new URL('/v1/where-to-stream', q.apiBase);
  u.searchParams.set('id', q.id);
  u.searchParams.set('idType', q.idType);
  u.searchParams.set('country', q.country);
  u.searchParams.set('locale', q.locale);
  // Va en la query y no en un header a propósito: un header propio dispara preflight CORS
  // (una request más por widget) y no deja cachear en CDN. La key es pública por diseño; lo
  // que la protege es la allowlist de dominios del lado server.
  u.searchParams.set('key', q.clientKey);
  return u.toString();
}

export function fetchAvailability(q: Query): Promise<WhereToStreamResponse> {
  const url = buildUrl(q);
  const hit = cache.get(url);
  if (hit) return hit;

  const p = request(url, q);
  cache.set(url, p);
  if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value as string);
  p.catch(() => cache.delete(url));
  return p;
}

/** Solo para tests. */
export function clearCache(): void {
  cache.clear();
}

async function request(url: string, q: Query): Promise<WhereToStreamResponse> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    // Sin cookies ni credenciales: el widget vive en sitios de terceros.
    res = await fetch(url, { credentials: 'omit', signal: ctrl.signal, mode: 'cors' });
  } catch {
    throw new ApiError('network');
  } finally {
    clearTimeout(timer);
  }

  // 404 = el título no existe en el catálogo. Para quien mira es lo mismo que "sin ofertas".
  if (res.status === 404) return empty(q);
  if (res.status === 401 || res.status === 403) throw new ApiError('auth', res.status);
  if (res.status === 429) throw new ApiError('rate', res.status);
  if (!res.ok) throw new ApiError('server', res.status);

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new ApiError('invalid', res.status);
  }
  return parse(body, q);
}

function empty(q: Query): WhereToStreamResponse {
  return { id: q.id, idType: q.idType, country: q.country, title: null, offers: [], updatedAt: null };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Solo `https:` (y `http:` para logos/links en localhost de desarrollo). Nunca `javascript:`. */
export function safeUrl(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.protocol === 'https:') return u.href;
    if (u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')) {
      return u.href;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Valida la respuesta en vez de confiar en ella: una oferta malformada se descarta, no rompe
 * el widget. También deduplica por plataforma + modelo (el server debería hacerlo, pero el
 * widget legacy tuvo que filtrar duplicados a mano).
 */
export function parse(body: unknown, q: Query): WhereToStreamResponse {
  if (!isObj(body) || !Array.isArray(body.offers)) throw new ApiError('invalid');

  const seen = new Set<string>();
  const offers: Offer[] = [];
  for (const o of body.offers) {
    if (!isObj(o)) continue;
    const platformId = str(o.platformId);
    const platformName = str(o.platformName);
    const monetization = o.monetization as Monetization;
    if (!platformId || !platformName || !MONETIZATIONS.includes(monetization)) continue;
    const key = `${platformId}|${monetization}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const price =
      isObj(o.price) && typeof o.price.amount === 'number' && str(o.price.currency)
        ? { amount: o.price.amount, currency: str(o.price.currency) as string }
        : null;
    const quality = o.quality === 'SD' || o.quality === 'HD' || o.quality === '4K' ? o.quality : null;

    offers.push({
      platformId,
      platformName,
      logoUrl: safeUrl(o.logoUrl),
      monetization,
      price,
      quality,
      watchUrl: safeUrl(o.watchUrl),
    });
  }

  const tt = isObj(body.title) ? body.title : null;
  const name = tt && str(tt.name);
  return {
    id: q.id,
    idType: q.idType,
    country: str(body.country) ?? q.country,
    title: name
      ? {
          name,
          year: typeof tt!.year === 'number' ? tt!.year : null,
          type: tt!.type === 'series' ? 'series' : 'movie',
        }
      : null,
    offers,
    updatedAt: str(body.updatedAt),
  };
}
