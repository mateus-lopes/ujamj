// ---------- Próximo grupo de jovens ----------
// Mostra o primeiro encontro da nota "Próximo GP.md" e deixa ali até a nota ser atualizada
// (ela é atualizada no dia seguinte a cada GP). Sem encontro na nota, mostramos a próxima quarta
// com "local a definir". O tema não aparece: é surpresa.

const TZ = 'America/Sao_Paulo';
const todayISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());

function addDays(iso, days) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const weekday = (iso) => new Date(`${iso}T12:00:00Z`).getUTCDay();
const nextWednesday = (iso) => addDays(iso, (3 - weekday(iso) + 7) % 7);

function formatDate(iso) {
  const text = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
    .format(new Date(`${iso}T12:00:00Z`));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Link do Google Agenda com o evento já preenchido (duração padrão de 2 horas)
function agendaUrl(e) {
  const [h, m] = (e.horario || '20:30').split(':').map(Number);
  const stamp = (iso, hh, mm) => `${iso.replace(/-/g, '')}T${String(hh).padStart(2, '0')}${String(mm).padStart(2, '0')}00`;
  const endH = h + 2;
  const end = endH >= 24 ? stamp(addDays(e.data, 1), endH - 24, m) : stamp(e.data, endH, m);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: 'Grupo de jovens · UJAMJ',
    dates: `${stamp(e.data, h, m)}/${end}`,
    ctz: TZ,
    details: `GP da UJAMJ${e.local ? ` na ${e.local}` : ''}.
${location.origin}`,
    location: [e.local, e.endereco].filter(Boolean).join(' · '),
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

function encontroHtml(e, eyebrow) {
  const when = `${formatDate(e.data)}${e.horario ? ` · ${esc(e.horario)}` : ''}`;
  // Sem nome de local, o próprio endereço vira a linha principal
  const place = e.local || e.endereco;
  const where = place
    ? `<p class="${e.local ? 'gp-local' : 'gp-endereco'}">${esc(place)}</p>${e.local && e.endereco ? `<p class="gp-endereco">${esc(e.endereco)}</p>` : ''}`
    : '<p class="gp-endereco muted">Local a definir</p>';
  const query = e.endereco || e.local;
  const mapUrl = e.mapa || (query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : '');
  const map = query
    ? `<div class="gp-map">
        <iframe src="https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=16&output=embed" title="Mapa do local" loading="lazy" tabindex="-1" referrerpolicy="no-referrer-when-downgrade"></iframe>
        <div class="gp-actions">
          <a class="gp-map-button" href="${esc(agendaUrl(e))}" target="_blank" rel="noopener">Agenda +</a>
          <a class="gp-map-button" href="${esc(mapUrl)}" target="_blank" rel="noopener">Abrir no mapa ↗</a>
        </div>
      </div>`
    : `<div class="gp-body gp-agenda-only"><a class="gp-map-button" href="${esc(agendaUrl(e))}" target="_blank" rel="noopener">Agenda +</a></div>`;
  const aviso = e.aviso ? `<p class="gp-aviso">${esc(e.aviso)}</p>` : '';

  return `${map}
    <div class="gp-body">
      ${eyebrow}
      <p class="gp-when">${when}</p>
      ${where}${aviso}
    </div>`;
}

function renderNextGp(el) {
  const gp = JSON.parse(el.dataset.gp || '{}');
  const encontro = (gp.encontros ?? []).find((e) => e.data) ?? { data: nextWednesday(todayISO()), horario: gp.horario ?? '' };
  el.innerHTML = encontroHtml(encontro, '<p class="eyebrow">Próximo grupo de jovens</p>');
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

// ---------- Apresentação ----------
// Quem toca em "Abrir o app" não vê mais a apresentação neste aparelho (dá para rever em /?sobre).

function setupLanding(button) {
  button.addEventListener('click', () => {
    try { localStorage.setItem('ujamj:entrou', '1'); } catch {}
    document.documentElement.classList.remove('show-landing');
    if (location.search) history.replaceState(null, '', location.pathname);
    window.scrollTo(0, 0);
  });
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
  document.querySelectorAll('[data-entrar]').forEach(setupLanding);
  document.querySelectorAll('[data-theme-toggle]').forEach(setupThemeToggle);
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
