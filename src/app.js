// ---------- Próximo GP ----------
// A data vem da nota "Próximo GP.md". Se ela já passou, mostramos a próxima quarta com "local a definir"
// para nunca exibir o endereço de um encontro antigo.

const TZ = 'America/Sao_Paulo';
const todayISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());

function addDays(iso, days) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function nextWednesday(iso) {
  const day = new Date(`${iso}T12:00:00Z`).getUTCDay();
  return addDays(iso, (3 - day + 7) % 7);
}

function formatDate(iso) {
  const text = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
    .format(new Date(`${iso}T12:00:00Z`));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function renderNextGp(el) {
  const gp = JSON.parse(el.dataset.gp || '{}');
  const today = todayISO();
  const confirmed = Boolean(gp.data) && gp.data >= today;
  const date = confirmed ? gp.data : nextWednesday(today);
  const badge = date === today ? '<span class="badge">Hoje</span>'
    : date === addDays(today, 1) ? '<span class="badge">Amanhã</span>' : '';

  const when = `${formatDate(date)}${gp.horario ? ` · ${esc(gp.horario)}` : ''}`;
  // Sem nome de local, o próprio endereço vira a linha principal
  const place = gp.local || gp.endereco;
  const where = confirmed && place
    ? `<p class="gp-local">📍 ${esc(place)}</p>${gp.local && gp.endereco ? `<p class="gp-endereco">${esc(gp.endereco)}</p>` : ''}`
    : '<p class="gp-local muted">📍 Local a definir</p>';
  const mapUrl = gp.mapa || (gp.endereco ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(gp.endereco)}` : '');
  const actions = confirmed && mapUrl
    ? `<div class="actions"><a class="button" href="${esc(mapUrl)}" target="_blank" rel="noopener">Abrir no mapa</a></div>` : '';
  const palavra = confirmed && gp.palavra
    ? `<p class="gp-palavra">🗣️ Tema: <a href="${esc(gp.palavra.url)}">${esc(gp.palavra.title)}</a></p>` : '';
  const aviso = confirmed && gp.aviso ? `<p class="gp-aviso">${esc(gp.aviso)}</p>` : '';

  el.innerHTML = `
    <p class="eyebrow">📅 Próximo GP ${badge}</p>
    <p class="gp-when">${when}</p>
    ${where}${palavra}${aviso}${actions}`;
}

// ---------- Busca ----------

const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function setupSearch(input) {
  const items = [...document.querySelectorAll('#lista > li')];
  const empty = document.getElementById('vazio');
  input.addEventListener('input', () => {
    const terms = fold(input.value).split(/\s+/).filter(Boolean);
    let shown = 0;
    for (const li of items) {
      const match = terms.every((t) => li.dataset.search.includes(t));
      li.hidden = !match;
      if (match) shown++;
    }
    empty.hidden = shown > 0;
  });
}

// ---------- Tema claro/escuro ----------
// Sem escolha salva, segue o sistema. A escolha fica só neste aparelho.

const ICONS = {
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
};

const systemDark = matchMedia('(prefers-color-scheme: dark)');
const currentTheme = () => document.documentElement.dataset.theme || (systemDark.matches ? 'dark' : 'light');

function setupThemeToggle(button) {
  const paint = () => {
    const dark = currentTheme() === 'dark';
    button.innerHTML = dark ? ICONS.sun : ICONS.moon;
    button.setAttribute('aria-label', dark ? 'Usar tema claro' : 'Usar tema escuro');
  };
  button.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('tema', next); } catch {}
    paint();
  });
  systemDark.addEventListener('change', paint);
  paint();
}

// ---------- Compartilhar ----------

function setupShare(button) {
  if (!navigator.share) return;
  button.hidden = false;
  button.addEventListener('click', () => {
    navigator.share({ title: document.title, url: location.href }).catch(() => {});
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const gp = document.getElementById('proximo-gp');
  if (gp) renderNextGp(gp);
  const busca = document.getElementById('busca');
  if (busca) setupSearch(busca);
  document.querySelectorAll('[data-share]').forEach(setupShare);
  document.querySelectorAll('[data-theme-toggle]').forEach(setupThemeToggle);
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
