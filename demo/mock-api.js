// MOCK de la API de Nexus para la demo. NO es parte del widget ni del bundle.
//
// El endpoint real (`GET /v1/where-to-stream`) todavía no existe: este archivo intercepta
// `fetch` hacia MOCK_BASE y responde siguiendo docs/API-CONTRACT.md, incluidos los errores
// (401 sin key, 403 dominio no autorizado, 404 título desconocido). Títulos, ofertas, precios
// y logos son DATOS DE EJEMPLO.
export const MOCK_BASE = 'https://mock-api.nexus.invalid';
export const MOCK_KEY = 'pk_demo_nexus';
/** Key que el mock trata como "dominio no autorizado" para mostrar el estado de error. */
export const MOCK_KEY_BLOCKED = 'pk_demo_blocked';

const logo = (id) => new URL(`./logos/${id}.svg`, import.meta.url).href;
const watch = (id, uid) => `https://example.com/watch?platform=${id}&title=${uid}`;

const P = {
  netflix: ['Netflix', logo('netflix')],
  max: ['Max', logo('max')],
  prime: ['Prime Video', logo('prime-video')],
  disney: ['Disney+', logo('disney-plus')],
  apple: ['Apple TV', logo('apple-tv')],
  pluto: ['Pluto TV', logo('pluto-tv')],
  tubi: ['Tubi', logo('tubi')],
  mubi: ['MUBI', logo('mubi')],
  // Sin logo en el catálogo (≈36% de los servicios): el widget pinta iniciales.
  vix: ['ViX', null],
  filmin: ['Filmin', null],
  globoplay: ['Globoplay', null],
};

const CUR = { US: 'USD', AR: 'ARS', BR: 'BRL', GB: 'GBP', ES: 'EUR', MX: 'MXN' };
const FX = { USD: 1, ARS: 1450, BRL: 5.4, GBP: 0.79, EUR: 0.92, MXN: 18.5 };

/** [plataforma, modelo, precio en USD | null, calidad] por país. */
const TITLES = {
  'oi-demo-0001': {
    title: { name: 'The Night Shift Archive', year: 2023, type: 'series' },
    by: {
      US: [['max', 'subscription', null, '4K'], ['prime', 'buy', 19.99, 'HD'], ['apple', 'buy', 24.99, '4K'], ['tubi', 'ads', null, 'HD']],
      AR: [['max', 'subscription', null, 'HD'], ['prime', 'rent', 2.99, 'HD']],
      BR: [['max', 'subscription', null, 'HD'], ['globoplay', 'subscription', null, 'HD']],
      GB: [['netflix', 'subscription', null, '4K'], ['apple', 'buy', 21.99, '4K']],
      ES: [['max', 'subscription', null, 'HD'], ['filmin', 'subscription', null, 'HD']],
      MX: [['max', 'subscription', null, 'HD'], ['vix', 'ads', null, 'HD']],
    },
  },
  'oi-demo-0002': {
    title: { name: 'Coastal Lines', year: 2019, type: 'movie' },
    by: {
      US: [['netflix', 'subscription', null, '4K'], ['pluto', 'ads', null, 'HD'], ['apple', 'rent', 3.99, '4K'], ['prime', 'rent', 3.99, 'HD'], ['apple', 'buy', 14.99, '4K']],
      AR: [['netflix', 'subscription', null, 'HD'], ['pluto', 'ads', null, 'HD']],
      BR: [['netflix', 'subscription', null, 'HD']],
      GB: [['mubi', 'subscription', null, 'HD'], ['prime', 'rent', 3.49, 'HD']],
      ES: [['filmin', 'subscription', null, 'HD'], ['prime', 'rent', 3.99, 'HD']],
      MX: [['netflix', 'subscription', null, 'HD'], ['vix', 'free', null, 'SD']],
    },
  },
  'oi-demo-0003': {
    title: { name: 'Little Orbit', year: 2021, type: 'movie' },
    by: {
      US: [['disney', 'subscription', null, '4K'], ['apple', 'buy', 19.99, '4K']],
      AR: [['disney', 'subscription', null, 'HD']],
      BR: [['disney', 'subscription', null, 'HD']],
      GB: [['disney', 'subscription', null, '4K']],
      ES: [['disney', 'subscription', null, '4K']],
      MX: [['disney', 'subscription', null, 'HD']],
    },
  },
  // Existe, pero no hay ofertas en ningún país: estado vacío.
  'oi-demo-0004': { title: { name: 'Festival Cut', year: 2024, type: 'movie' }, by: {} },
};

export const MOCK_TITLES = Object.entries(TITLES).map(([uid, t]) => ({ uid, ...t.title }));

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=3600' },
  });

function handle(url) {
  const q = url.searchParams;
  if (url.pathname !== '/v1/where-to-stream') return json(404, { error: 'not_found' });
  const key = q.get('key');
  if (!key) return json(401, { error: 'missing_key' });
  if (key === MOCK_KEY_BLOCKED) return json(403, { error: 'origin_not_allowed' });
  if (key !== MOCK_KEY) return json(401, { error: 'invalid_key' });
  const country = (q.get('country') || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(country) || !q.get('id')) return json(400, { error: 'invalid_params' });

  const t = TITLES[q.get('id')];
  if (!t) return json(404, { error: 'title_not_found' });

  const cur = CUR[country] || 'USD';
  const offers = (t.by[country] || []).map(([id, monetization, usd, quality]) => ({
    platformId: id,
    platformName: P[id][0],
    logoUrl: P[id][1],
    monetization,
    price: usd == null ? null : { amount: Math.round(usd * FX[cur] * 100) / 100, currency: cur },
    quality,
    watchUrl: watch(id, q.get('id')),
  }));
  return json(200, {
    id: q.get('id'),
    idType: q.get('idType') || 'uid',
    country,
    title: t.title,
    offers,
    updatedAt: '2026-10-05T06:00:00Z',
  });
}

const realFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input.url, location.href);
  if (url.origin !== MOCK_BASE) return realFetch(input, init);
  // Latencia de red simulada para que se vea el skeleton.
  await new Promise((r) => setTimeout(r, 450));
  return handle(url);
};
