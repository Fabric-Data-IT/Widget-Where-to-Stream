/**
 * Contrato de la API que consume el widget. Detalle y reglas del backend en
 * `docs/API-CONTRACT.md`. Si cambia uno, cambia el otro.
 */

/** Cómo se accede a la oferta. `ads` = gratis con publicidad (AVOD/FAST). */
export type Monetization = 'subscription' | 'free' | 'ads' | 'rent' | 'buy';

export type IdType = 'uid' | 'imdb' | 'tmdb';

export interface Price {
  /** Monto en la moneda indicada, ya con impuestos tal como lo muestra la plataforma. */
  amount: number;
  /** ISO 4217 (`USD`, `EUR`, `ARS`). */
  currency: string;
}

export interface Offer {
  /** Id estable de la plataforma en el catálogo de Nexus (`netflix`, `max`, `pluto-tv`). */
  platformId: string;
  /** Nombre comercial para mostrar. */
  platformName: string;
  /** Logo cuadrado, HTTPS. `null` si no hay: el widget pinta iniciales. */
  logoUrl: string | null;
  monetization: Monetization;
  price: Price | null;
  quality: 'SD' | 'HD' | '4K' | null;
  /**
   * Link YA envuelto por el tracker de clicks (`https://click.origin.fabricdata.com/...`).
   * El widget no arma URLs de redirect: así el destino lo decide el server con allowlist.
   */
  watchUrl: string | null;
}

export interface TitleInfo {
  name: string;
  year: number | null;
  type: 'movie' | 'series';
}

export interface WhereToStreamResponse {
  /** El id tal como se pidió. */
  id: string;
  idType: IdType;
  /** ISO 3166-1 alpha-2. */
  country: string;
  title: TitleInfo | null;
  offers: Offer[];
  /** ISO 8601 de la última actualización del dato de disponibilidad. */
  updatedAt: string | null;
}
