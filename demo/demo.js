// Chrome de la página de demo. El widget no depende de nada de esto.
import { MOCK_BASE, MOCK_KEY, MOCK_KEY_BLOCKED, MOCK_TITLES } from './mock-api.js';

// [[confirmar: dominio del CDN]] — ver docs/INTEGRACION.md.
const CDN = 'https://cdn.origin.fabricdata.com/where-to-stream';

// 1) Mock instalado (import de arriba) → 2) configurar los widgets → 3) cargar el bundle.
for (const el of document.querySelectorAll('fabric-where-to-stream[data-demo]')) {
  el.setAttribute('api-base', MOCK_BASE);
  el.setAttribute('client-key', el.hasAttribute('data-blocked') ? MOCK_KEY_BLOCKED : MOCK_KEY);
}

const form = document.getElementById('controls');
const live = document.getElementById('live');
const stage = document.getElementById('stage');
const code = document.getElementById('code');

const uidSelect = document.getElementById('f-uid');
for (const t of MOCK_TITLES) {
  const o = document.createElement('option');
  o.value = t.uid;
  o.textContent = `${t.name} (${t.year})`;
  uidSelect.append(o);
}

let version = '2';

function update() {
  const f = new FormData(form);
  const attrs = {
    uid: f.get('uid'),
    country: f.get('country'),
    locale: f.get('locale'),
    theme: f.get('theme'),
    layout: f.get('layout'),
  };
  live.setAttribute('api-base', MOCK_BASE);
  live.setAttribute('client-key', MOCK_KEY);
  for (const [k, v] of Object.entries(attrs)) live.setAttribute(k, v);
  stage.dataset.nxTheme = attrs.theme;

  // El snippet omite lo que está en su valor por defecto.
  const shown = { ...attrs, 'client-key': 'pk_live_YOUR_KEY' };
  if (shown.theme === 'dark') delete shown.theme;
  if (shown.layout === 'full') delete shown.layout;
  if (shown.locale === 'en') delete shown.locale;
  const lines = Object.entries(shown).map(([k, v]) => `  ${k}="${v}"`);
  code.textContent =
    `<script src="${CDN}/${version}/where-to-stream.js" defer></script>\n\n` +
    `<fabric-where-to-stream\n${lines.join('\n')}>\n</fabric-where-to-stream>`;
}

form.addEventListener('change', update);
update();

document.getElementById('copy').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  try {
    await navigator.clipboard.writeText(code.textContent);
    btn.textContent = 'Copied';
  } catch {
    btn.textContent = 'Select & copy';
  }
  setTimeout(() => (btn.textContent = 'Copy'), 1600);
});

const s = document.createElement('script');
s.src = '../dist/where-to-stream.js';
s.addEventListener('load', () => {
  const v = window.FabricWhereToStream?.VERSION;
  if (v) {
    document.getElementById('version').textContent = `v${v}`;
    version = v.split('.')[0];
    update();
  }
});
document.head.append(s);
