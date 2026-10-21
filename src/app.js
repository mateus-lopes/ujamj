// ---------- Grupo de jovens: encontros desta semana e da próxima ----------
// Os encontros vêm da nota "Próximo GP.md". Encontros com data passada somem sozinhos, para nunca exibir
// o endereço de um encontro antigo. Sem encontro futuro, mostramos a próxima quarta com "local a definir".
// O tema não aparece: é surpresa.

const TZ = 'America/Sao_Paulo';
const todayISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
const DAY = 24 * 60 * 60 * 1000;

function addDays(iso, days) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const weekday = (iso) => new Date(`${iso}T12:00:00Z`).getUTCDay();
const nextWednesday = (iso) => addDays(iso, (3 - weekday(iso) + 7) % 7);
const weekStart = (iso) => new Date(`${addDays(iso, -weekday(iso))}T12:00:00Z`).getTime();

function weekLabel(iso, today) {
  const weeks = Math.round((weekStart(iso) - weekStart(today)) / (7 * DAY));
  if (weeks === 0) return 'Esta semana';
  if (weeks === 1) return 'Semana que vem';
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

function formatDate(iso) {
  const text = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
    .format(new Date(`${iso}T12:00:00Z`));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function encontroHtml(e) {
  const when = `${formatDate(e.data)}${e.horario ? ` · ${esc(e.horario)}` : ''}`;
  // Sem nome de local, o próprio endereço vira a linha principal
  const place = e.local || e.endereco;
  const where = place
    ? `<p class="gp-local">${esc(place)}</p>${e.local && e.endereco ? `<p class="gp-endereco">${esc(e.endereco)}</p>` : ''}`
    : '<p class="gp-endereco">Local a definir</p>';
  const query = e.endereco || e.local;
  const mapUrl = e.mapa || (query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : '');
  const map = query
    ? `<p class="gp-link"><a href="${esc(mapUrl)}" target="_blank" rel="noopener">Abrir no mapa</a></p>
      <div class="gp-map">
        <iframe src="https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=16&output=embed" title="Mapa do local" loading="lazy" tabindex="-1" referrerpolicy="no-referrer-when-downgrade"></iframe>
      </div>`
    : '';
  const aviso = e.aviso ? `<p class="gp-aviso">${esc(e.aviso)}</p>` : '';
  return `<p class="gp-when">${when}</p>${where}${aviso}${map}`;
}

// Rótulo do encontro desta semana: "Hoje", "Amanhã" ou "Esta semana"
function firstLabel(e, today) {
  if (e.data === today) return 'Hoje';
  if (e.data === addDays(today, 1)) return 'Amanhã';
  return weekLabel(e.data, today);
}

function renderNextGp(el) {
  const gp = JSON.parse(el.dataset.gp || '{}');
  const today = todayISO();
  const upcoming = (gp.encontros ?? [])
    .filter((e) => e.data && e.data >= today)
    .sort((a, b) => a.data.localeCompare(b.data))
    .slice(0, 2);
  if (!upcoming.length) upcoming.push({ data: nextWednesday(today), horario: gp.horario ?? '' });

  // Os próprios rótulos do topo funcionam como abas
  const labels = upcoming.length > 1
    ? [firstLabel(upcoming[0], today), 'Próximo grupo de jovens']
    : [['Hoje', 'Amanhã'].includes(firstLabel(upcoming[0], today)) ? firstLabel(upcoming[0], today) : 'Próximo grupo de jovens'];

  let active = 0;
  const paint = (focus = false) => {
    const tabs = labels.length > 1
      ? `<div class="gp-tabs" role="tablist" aria-label="Encontros">${labels.map((label, i) => `<button type="button" role="tab" data-i="${i}" aria-selected="${i === active}" tabindex="${i === active ? 0 : -1}">${label}</button>`).join('')}</div>`
      : `<div class="gp-tabs"><span class="gp-tab-static">${labels[0]}</span></div>`;
    el.innerHTML = `${tabs}<div role="tabpanel">${encontroHtml(upcoming[active])}</div>`;
    el.querySelectorAll('[role="tab"]').forEach((tab) => {
      tab.addEventListener('click', () => { active = Number(tab.dataset.i); paint(true); });
      tab.addEventListener('keydown', (ev) => {
        if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
        active = (active + (ev.key === 'ArrowRight' ? 1 : -1) + labels.length) % labels.length;
        paint(true);
      });
    });
    if (focus) el.querySelector('[aria-selected="true"]')?.focus();
  };
  paint();
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
