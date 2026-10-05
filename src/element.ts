import { ApiError, DEFAULT_API_BASE, fetchAvailability, type Query } from './api';
import { countryName, formatPrice, locale as toLocale, t, type Locale } from './i18n';
import { STYLES, sharedSheet } from './styles';
import type { IdType, Monetization, Offer, WhereToStreamResponse } from './types';

declare const __VERSION__: string;
export const VERSION = typeof __VERSION__ === 'string' ? __VERSION__ : 'dev';

export const TAG = 'fabric-where-to-stream';

/** Orden y agrupación en pantalla. `ads` (AVOD/FAST) va junto con `free`. */
const GROUPS: ReadonlyArray<{ key: 'subscription' | 'free' | 'rent' | 'buy'; of: Monetization[] }> = [
  { key: 'subscription', of: ['subscription'] },
  { key: 'free', of: ['free', 'ads'] },
  { key: 'rent', of: ['rent'] },
  { key: 'buy', of: ['buy'] },
];

const ID_TYPES: readonly IdType[] = ['uid', 'imdb', 'tmdb'];
const BRAND_URL = 'https://fabricorigin.com';

type Attrs = Record<string, string | null | undefined>;

/**
 * Crea un nodo. Los textos van SIEMPRE por `textContent` y los atributos por `setAttribute`:
 * en este componente no hay `innerHTML` con datos, ni uno.
 */
function h(tag: string, attrs: Attrs = {}, children: Array<Node | string | null> = []): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
  for (const c of children) if (c != null) el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  return el;
}

function initials(name: string): string {
  const parts = name.replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? parts[0]?.[1] ?? '')).toUpperCase() || '·';
}

export class FabricWhereToStream extends HTMLElement {
  static get observedAttributes(): string[] {
    return ['uid', 'id-type', 'country', 'client-key', 'api-base', 'locale', 'layout'];
  }

  private root: ShadowRoot;
  private body: HTMLElement;
  /** Ignora respuestas viejas si los atributos cambiaron mientras se esperaba. */
  private seq = 0;
  private scheduled = false;

  constructor() {
    super();
    this.root = this.attachShadow({ mode: 'open' });
    const s = sharedSheet();
    if (s) this.root.adoptedStyleSheets = [s];
    else {
      const style = document.createElement('style');
      style.textContent = STYLES;
      this.root.append(style);
    }
    this.body = h('section', { class: 'w', part: 'container', 'aria-live': 'polite' });
    this.root.append(this.body);
  }

  connectedCallback(): void {
    this.schedule();
  }

  disconnectedCallback(): void {
    this.seq++;
  }

  attributeChangedCallback(_name: string, oldV: string | null, newV: string | null): void {
    if (oldV !== newV && this.isConnected) this.schedule();
  }

  /** Junta varios cambios de atributos en un solo render. */
  private schedule(): void {
    if (this.scheduled) return;
    this.scheduled = true;
    queueMicrotask(() => {
      this.scheduled = false;
      void this.load();
    });
  }

  private get loc(): Locale {
    return toLocale(this.getAttribute('locale') || document.documentElement.lang || navigator.language);
  }

  private query(): Query | { missing: string } {
    const id = (this.getAttribute('uid') || '').trim();
    const country = (this.getAttribute('country') || '').trim().toUpperCase();
    const clientKey = (this.getAttribute('client-key') || '').trim();
    if (!id) return { missing: 'uid' };
    if (!/^[A-Z]{2}$/.test(country)) return { missing: 'country' };
    if (!clientKey) return { missing: 'client-key' };
    const rawType = (this.getAttribute('id-type') || 'uid').toLowerCase() as IdType;
    return {
      apiBase: this.getAttribute('api-base') || DEFAULT_API_BASE,
      id,
      idType: ID_TYPES.includes(rawType) ? rawType : 'uid',
      country,
      locale: this.loc,
      clientKey,
    };
  }

  private async load(): Promise<void> {
    const seq = ++this.seq;
    const l = this.loc;
    const q = this.query();
    if ('missing' in q) {
      console.warn(`[${TAG}] falta el atributo "${q.missing}"`);
      this.paint(l, null, [h('p', { class: 'msg' }, [t(l, 'config', { x: q.missing })])]);
      return;
    }

    this.renderLoading(l);
    try {
      const data = await fetchAvailability(q);
      if (seq !== this.seq) return;
      this.renderData(l, data);
      this.emit('fws:load', { id: q.id, country: q.country, offers: data.offers.length });
    } catch (e) {
      if (seq !== this.seq) return;
      const kind = e instanceof ApiError ? e.kind : 'network';
      if (kind === 'auth') console.warn(`[${TAG}] client-key inválida o dominio no autorizado para esta key`);
      this.paint(l, null, [h('p', { class: 'msg' }, [t(l, 'error')])]);
      this.emit('fws:error', { id: q.id, country: q.country, kind });
    }
  }

  private emit(name: string, detail: Record<string, unknown>): void {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  private get compact(): boolean {
    return this.getAttribute('layout') === 'compact';
  }

  private renderLoading(l: Locale): void {
    const n = this.compact ? 4 : 3;
    const list = h('ul', { 'aria-hidden': 'true' });
    for (let i = 0; i < n; i++) list.append(h('li', { class: 'sk' }));
    this.body.setAttribute('aria-busy', 'true');
    this.paint(l, null, [h('span', { class: 'vh', role: 'status' }, [t(l, 'loading')]), list]);
  }

  private renderData(l: Locale, data: WhereToStreamResponse): void {
    this.body.removeAttribute('aria-busy');
    const country = countryName(l, data.country);
    if (!data.offers.length) {
      this.paint(l, data, [h('p', { class: 'msg' }, [t(l, 'empty', { c: country })])]);
      return;
    }

    const blocks: HTMLElement[] = [];
    if (this.compact) {
      blocks.push(this.list(l, data.offers));
    } else {
      for (const g of GROUPS) {
        const offers = data.offers.filter((o) => g.of.includes(o.monetization));
        if (!offers.length) continue;
        const id = `g-${g.key}`;
        blocks.push(
          h('div', { class: 'g', role: 'group', 'aria-labelledby': id, part: 'group' }, [
            h('h3', { id }, [t(l, g.key)]),
            this.list(l, offers),
          ]),
        );
      }
    }
    this.paint(l, data, blocks);
  }

  private list(l: Locale, offers: Offer[]): HTMLElement {
    return h('ul', {}, offers.map((o) => h('li', {}, [this.offer(l, o)])));
  }

  private offer(l: Locale, o: Offer): HTMLElement {
    const meta: string[] = [];
    if (o.price) meta.push(formatPrice(l, o.price.amount, o.price.currency));
    else if (o.monetization === 'ads') meta.push(t(l, 'ads'));
    if (o.quality) meta.push(o.quality);
    const metaText = meta.join(' · ');

    const label = [`${t(l, 'on')} ${o.platformName}`, metaText].filter(Boolean).join(', ');
    const attrs: Attrs = o.watchUrl
      ? {
          class: 'o',
          part: 'offer',
          href: o.watchUrl,
          target: '_blank',
          // `sponsored`: son links de afiliado (Google lo pide así).
          rel: 'noopener noreferrer sponsored',
          'aria-label': `${label} (${t(l, 'newTab')})`,
          title: label,
        }
      : { class: 'o', part: 'offer', title: label, 'aria-label': label };

    const el = h(o.watchUrl ? 'a' : 'div', attrs, [
      this.logo(o),
      h('span', { class: 'tx' }, [
        h('span', { class: 'nm' }, [o.platformName]),
        metaText ? h('span', { class: 'mt' }, [metaText]) : null,
      ]),
    ]);
    if (o.watchUrl) {
      el.addEventListener('click', () =>
        this.emit('fws:click', { platformId: o.platformId, monetization: o.monetization }),
      );
    }
    return el;
  }

  private logo(o: Offer): HTMLElement {
    const fallback = () => h('span', { class: 'lg in', 'aria-hidden': 'true' }, [initials(o.platformName)]);
    if (!o.logoUrl) return fallback();
    const img = h('img', {
      class: 'lg',
      src: o.logoUrl,
      alt: '',
      width: '40',
      height: '40',
      loading: 'lazy',
      decoding: 'async',
      referrerpolicy: 'no-referrer',
    });
    img.addEventListener('error', () => img.replaceWith(fallback()), { once: true });
    return img;
  }

  private paint(l: Locale, data: WhereToStreamResponse | null, content: HTMLElement[]): void {
    const sub = data?.title
      ? `${data.title.name}${data.title.year ? ` (${data.title.year})` : ''} · ${countryName(l, data.country)}`
      : null;
    const brand = h('a', { href: BRAND_URL, target: '_blank', rel: 'noopener noreferrer' }, ['Origin Nexus']);
    this.body.replaceChildren(
      h('header', { class: 'hd', part: 'header' }, [
        h('h2', { part: 'title' }, [t(l, 'title')]),
        sub ? h('span', { class: 'sub' }, [sub]) : null,
      ]),
      ...content,
      h('footer', { class: 'ft', part: 'footer' }, [`${t(l, 'powered')} `, brand]),
    );
  }
}

export function define(tag = TAG): void {
  if (typeof customElements !== 'undefined' && !customElements.get(tag)) {
    customElements.define(tag, FabricWhereToStream);
  }
}
