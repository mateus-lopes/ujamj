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
  const where = confirmed && gp.local
    ? `<p class="gp-local">📍 ${esc(gp.local)}</p>${gp.endereco ? `<p class="gp-endereco">${esc(gp.endereco)}</p>` : ''}`
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
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
