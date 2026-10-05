import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildUrl, clearCache, parse, safeUrl } from '../src/api';
import '../src/index';

const API = 'https://api.test';

function offer(over: Record<string, unknown> = {}) {
  return {
    platformId: 'netflix',
    platformName: 'Netflix',
    logoUrl: 'https://img.test/netflix.png',
    monetization: 'subscription',
    price: null,
    quality: 'HD',
    watchUrl: 'https://click.origin.fabricdata.com/r/abc',
    ...over,
  };
}

function respond(body: unknown, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }));
}

async function mount(attrs: Record<string, string>) {
  const el = document.createElement('fabric-where-to-stream');
  for (const [k, v] of Object.entries({ 'api-base': API, 'client-key': 'pk_test', ...attrs })) {
    el.setAttribute(k, v);
  }
  document.body.append(el);
  await settle();
  return el;
}

async function settle() {
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
}

const shadow = (el: Element) => el.shadowRoot!;

beforeEach(() => {
  clearCache();
  document.body.replaceChildren();
});
afterEach(() => vi.unstubAllGlobals());

describe('<fabric-where-to-stream>', () => {
  it('pinta las ofertas agrupadas por modelo, en orden', async () => {
    vi.stubGlobal(
      'fetch',
      respond({
        country: 'US',
        title: { name: 'Inception', year: 2010, type: 'movie' },
        offers: [
          offer({ platformId: 'apple', platformName: 'Apple TV', monetization: 'rent', price: { amount: 3.99, currency: 'USD' } }),
          offer(),
          offer({ platformId: 'pluto', platformName: 'Pluto TV', monetization: 'ads', logoUrl: null }),
        ],
      }),
    );
    const el = await mount({ uid: 'oi-123', country: 'us', locale: 'en' });
    const s = shadow(el);
    expect([...s.querySelectorAll('h3')].map((x) => x.textContent)).toEqual(['Stream', 'Free', 'Rent']);
    expect(s.querySelector('.sub')!.textContent).toBe('Inception (2010) · United States');
    expect(s.querySelector('a.o')!.getAttribute('rel')).toBe('noopener noreferrer sponsored');
    expect(s.textContent).toContain('$3.99');
    // Sin logo → iniciales.
    expect(s.querySelector('.in')!.textContent).toBe('PT');
    expect(s.textContent).toContain('Origin Nexus');
    expect(s.textContent).not.toMatch(/bb ?media/i);
  });

  it('manda id, país, locale y key en la query, sin credenciales', async () => {
    const f = respond({ offers: [] });
    vi.stubGlobal('fetch', f);
    await mount({ uid: 'tt1375666', 'id-type': 'imdb', country: 'AR', locale: 'es' });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe(`${API}/v1/where-to-stream`);
    expect(Object.fromEntries(u.searchParams)).toEqual({
      id: 'tt1375666',
      idType: 'imdb',
      country: 'AR',
      locale: 'es',
      key: 'pk_test',
    });
    expect(init.credentials).toBe('omit');
  });

  it('escapa los datos: un nombre con HTML queda como texto', async () => {
    vi.stubGlobal(
      'fetch',
      respond({ offers: [offer({ platformName: '<img src=x onerror=alert(1)>Evil' })] }),
    );
    const el = await mount({ uid: 'x', country: 'US' });
    const s = shadow(el);
    expect(s.querySelectorAll('img[onerror]').length).toBe(0);
    expect(s.querySelector('.nm')!.textContent).toBe('<img src=x onerror=alert(1)>Evil');
  });

  it('descarta URLs que no son https (javascript:, data:)', async () => {
    vi.stubGlobal(
      'fetch',
      respond({
        offers: [
          offer({ watchUrl: 'javascript:alert(1)', logoUrl: 'data:image/svg+xml,<svg/>' }),
        ],
      }),
    );
    const el = await mount({ uid: 'x', country: 'US' });
    const s = shadow(el);
    expect(s.querySelector('a.o')).toBeNull();
    expect(s.querySelector('div.o')).not.toBeNull();
    expect(s.querySelector('img.lg')).toBeNull();
  });

  it('estado vacío con el país en el idioma del widget', async () => {
    vi.stubGlobal('fetch', respond({ country: 'AR', offers: [] }));
    const el = await mount({ uid: 'x', country: 'AR', locale: 'es' });
    expect(shadow(el).querySelector('.msg')!.textContent).toBe('Por ahora no está disponible en Argentina.');
  });

  it('404 se muestra como vacío, no como error', async () => {
    vi.stubGlobal('fetch', respond({ error: 'not found' }, 404));
    const el = await mount({ uid: 'x', country: 'US' });
    expect(shadow(el).querySelector('.msg')!.textContent).toContain('Not available');
  });

  it('403 (dominio no autorizado) → error genérico + evento fws:error kind=auth', async () => {
    vi.stubGlobal('fetch', respond({}, 403));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const events: CustomEvent[] = [];
    document.addEventListener('fws:error', (e) => events.push(e as CustomEvent), { once: true });
    const el = await mount({ uid: 'x', country: 'US' });
    expect(shadow(el).querySelector('.msg')!.textContent).toBe(
      'Streaming options are unavailable right now.',
    );
    expect(events[0]?.detail.kind).toBe('auth');
    warn.mockRestore();
  });

  it('sin atributos obligatorios no llama a la API', async () => {
    const f = respond({ offers: [] });
    vi.stubGlobal('fetch', f);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const el = await mount({ country: 'US' });
    expect(f).not.toHaveBeenCalled();
    expect(shadow(el).querySelector('.msg')!.textContent).toContain('uid');
    warn.mockRestore();
  });

  it('varias instancias con los mismos parámetros comparten un fetch', async () => {
    const f = respond({ offers: [offer()] });
    vi.stubGlobal('fetch', f);
    await Promise.all([mount({ uid: 'same', country: 'US' }), mount({ uid: 'same', country: 'US' })]);
    expect(f).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll('fabric-where-to-stream').length).toBe(2);
  });

  it('cambiar un atributo vuelve a pedir', async () => {
    const f = respond({ offers: [offer()] });
    vi.stubGlobal('fetch', f);
    const el = await mount({ uid: 'a', country: 'US' });
    el.setAttribute('country', 'GB');
    await settle();
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('layout compact no agrupa', async () => {
    vi.stubGlobal('fetch', respond({ offers: [offer(), offer({ platformId: 'b', monetization: 'buy' })] }));
    const el = await mount({ uid: 'x', country: 'US', layout: 'compact' });
    expect(shadow(el).querySelectorAll('h3').length).toBe(0);
    expect(shadow(el).querySelectorAll('li').length).toBe(2);
  });
});

describe('api', () => {
  const q = { apiBase: API, id: 'x', idType: 'uid' as const, country: 'US', locale: 'en', clientKey: 'k' };

  it('safeUrl solo deja https (y http en localhost)', () => {
    expect(safeUrl('https://a.test/x')).toBe('https://a.test/x');
    expect(safeUrl('http://localhost:5173/a')).toBe('http://localhost:5173/a');
    expect(safeUrl('http://a.test/x')).toBeNull();
    expect(safeUrl('javascript:alert(1)')).toBeNull();
    expect(safeUrl('  ')).toBeNull();
  });

  it('parse descarta ofertas malformadas y deduplica', () => {
    const r = parse(
      {
        offers: [
          offer(),
          offer(),
          { platformId: 'x' },
          offer({ monetization: 'lease' }),
          'nope',
          offer({ platformId: 'netflix', monetization: 'buy' }),
        ],
      },
      q,
    );
    expect(r.offers.map((o) => `${o.platformId}|${o.monetization}`)).toEqual([
      'netflix|subscription',
      'netflix|buy',
    ]);
  });

  it('parse rechaza un cuerpo sin offers', () => {
    expect(() => parse({ foo: 1 }, q)).toThrow();
  });

  it('buildUrl codifica los parámetros', () => {
    const u = buildUrl({ ...q, id: 'a b&c=d' });
    expect(new URL(u).searchParams.get('id')).toBe('a b&c=d');
  });
});
