// Gera o site estático em dist/ a partir das notas do Obsidian (03-Igreja).
// Só entram notas com `publicar: true` no frontmatter.
import { readFile, writeFile, mkdir, rm, readdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parse as parseYaml } from 'yaml';
import { Marked } from 'marked';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'dist');
const CONTENT = path.resolve(ROOT, process.env.CONTENT_DIR ?? '../cortex/03-Igreja');

const SITE = {
  name: 'UJAMJ',
  fullName: 'União Jovem As Maravilhas de Jesus',
  description: 'Palavras do GP da UJAMJ: séries, versículos e o próximo encontro.',
};

const marked = new Marked({ gfm: true });
const WIKILINK = /!?\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g;

// ---------- utilidades ----------

const nfc = (s) => s.normalize('NFC');
const slugify = (s) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const escapeHtml = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const linkTarget = (v) => (typeof v === 'string' ? v.match(/\[\[([^\]|#]+)/)?.[1]?.trim() : null);
const hash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 10);

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
function shortDate(iso) {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}` : iso;
}
function weekdayOf(iso) {
  const date = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return '';
  const text = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'UTC' }).format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}
function longDate(iso) {
  const date = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
}

// ---------- leitura das notas ----------

function splitFrontmatter(src) {
  const m = src.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { data: {}, body: src };
  return { data: parseYaml(m[1]) ?? {}, body: src.slice(m[0].length) };
}

async function readNote(file) {
  const raw = (await readFile(file, 'utf8')).replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const { data, body } = splitFrontmatter(raw);
  const name = nfc(path.basename(file, '.md'));
  const title = body.match(/^# (.+)$/m)?.[1]?.trim() ?? name;
  return { name, data, body, title };
}

async function readFolder(dir) {
  if (!existsSync(dir)) return [];
  const files = (await readdir(dir)).filter((f) => f.endsWith('.md'));
  return Promise.all(files.map((f) => readNote(path.join(dir, f))));
}

async function findFile(dir, name) {
  if (!existsSync(dir)) return null;
  const file = (await readdir(dir)).find((f) => nfc(f) === nfc(name));
  return file ? path.join(dir, file) : null;
}

// ---------- markdown do Obsidian -> HTML ----------

function resolveWikilinks(md, links) {
  return md.replace(WIKILINK, (_, target, label) => {
    const text = label?.trim() || target.trim();
    const hit = links.get(nfc(target.trim()));
    return hit ? `[${text}](${hit.url})` : text;
  });
}

// Callouts (> [!bible] Título) viram <aside>; o conteúdo é renderizado à parte e reinserido depois do marked
function extractCallouts(md, blocks) {
  const lines = md.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^>\s*\[!([\w-]+)\][+-]?\s*(.*)$/);
    if (!m) { out.push(lines[i]); continue; }
    const inner = [];
    while (i + 1 < lines.length && lines[i + 1].startsWith('>')) inner.push(lines[++i].replace(/^>\s?/, ''));
    const body = inner.join('\n');
    if (!body.replace(/^\s*[-*]\s*$/gm, '').trim()) continue; // callout vazio (só "- ") não aparece
    const type = m[1].toLowerCase();
    const title = m[2] ? `<p class="callout-title">${marked.parseInline(m[2])}</p>` : '';
    blocks.push(`<aside class="callout callout-${type}">${title}${marked.parse(body)}</aside>`);
    out.push('', `@@CALLOUT${blocks.length - 1}@@`, '');
  }
  return out.join('\n');
}

// Remove títulos que ficaram sem conteúdo (ex.: "## 📖 Versículos" ainda vazio)
function removeEmptySections(md) {
  const lines = md.split('\n');
  return lines.filter((line, i) => {
    const h = line.match(/^(#{1,6}) /);
    if (!h) return true;
    let j = i + 1;
    while (j < lines.length && lines[j].trim() === '') j++;
    const next = lines[j]?.match(/^(#{1,6}) /);
    return !(j >= lines.length || (next && next[1].length <= h[1].length));
  }).join('\n');
}

function renderMarkdown(body, links) {
  let md = body
    .replace(/```dataview[\s\S]*?```\n?/g, '')
    .replace(/%%[\s\S]*?%%/g, '')
    .replace(/^\s*# .*\n/, '');
  md = resolveWikilinks(md, links);
  const blocks = [];
  md = removeEmptySections(extractCallouts(md, blocks));
  return marked.parse(md).replace(/<p>@@CALLOUT(\d+)@@<\/p>/g, (_, i) => blocks[Number(i)]);
}

function toPlain(md) {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(WIKILINK, (_, target, label) => label || target)
    .replace(/\[!\w+\]/g, ' ')
    .replace(/[#>*_`|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function excerptOf(body) {
  const section = body.match(/^## .*Resumo.*\n([\s\S]*?)(?=^## |(?![\s\S]))/m)?.[1] ?? body;
  const paras = section.split(/\n\s*\n/).map((p) => p.trim());
  const callout = body.match(/^>\s*\[!abstract\].*\n((?:>.*\n?)+)/m)?.[1]?.replace(/^>\s?/gm, '');
  const para = paras.find((p) => p && !/^\*[^*].*\*$/.test(p) && !/^[>#-]/.test(p)) ?? callout;
  const text = toPlain(para ?? '');
  return text.length > 200 ? `${text.slice(0, 197).replace(/\s+\S*$/, '')}…` : text;
}

// ---------- templates ----------

// Apresentação na página inicial. Aparece para quem nunca abriu o app neste aparelho (ou abriu /?sobre);
// o app instalado e quem já entrou vão direto ao conteúdo. A decisão roda no <head>, antes de pintar a tela.
const LANDING_GATE = `<script>try { const q = new URLSearchParams(location.search).has('sobre'); const app = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; if (q || (!app && localStorage.getItem('ujamj:entrou') !== '1')) document.documentElement.classList.add('show-landing'); } catch {}</script>`;

const LANDING_ICONS = {
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
};

function landing({ palavras, series }) {
  const stats = [
    `${palavras.length} ${palavras.length === 1 ? 'palavra' : 'palavras'}`,
    series.length ? `${series.length} ${series.length === 1 ? 'série' : 'séries'}` : '',
  ].filter(Boolean).join(' · ');
  const recurso = (icon, titulo, texto) => `<li><span class="landing-icon" aria-hidden="true">${LANDING_ICONS[icon]}</span><div><strong>${titulo}</strong><p>${texto}</p></div></li>`;
  return `<div class="landing" id="landing" role="dialog" aria-modal="true" aria-labelledby="landing-titulo">
  <div class="landing-inner">
    <p class="landing-brand"><img src="/icon.svg" alt="" width="40" height="40"><span><strong>${SITE.name}</strong><small>${SITE.fullName}</small></span></p>
    <p class="landing-eyebrow">Palavras do GP</p>
    <h1 id="landing-titulo">A palavra de cada GP, sempre à mão.</h1>
    <p class="landing-lead">Tudo o que foi ministrado na mocidade, as séries e o próximo encontro, num app que funciona até sem internet.</p>
    ${stats ? `<p class="landing-stats">${escapeHtml(stats)} publicadas</p>` : ''}
    <ul class="landing-recursos">
      ${recurso('pin', 'Próximo GP', 'Data, local, mapa e um toque para salvar na agenda.')}
      ${recurso('book', 'Palavras e séries', 'Texto base, versículos e perguntas para pensar depois.')}
      ${recurso('search', 'Busca e offline', 'Ache por tema ou versículo, mesmo sem sinal.')}
    </ul>
    <button class="landing-cta" type="button" data-entrar>Abrir o app <span aria-hidden="true">→</span></button>
    <p class="landing-dica">Dica: no celular, “Adicionar à tela inicial” instala o app.</p>
  </div>
</div>`;
}

function layout({ title, description = SITE.description, content, assets, home = false, intro = '' }) {
  const pageTitle = title ? `${title} · ${SITE.name}` : `${SITE.name} · Palavras do GP`;
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${escapeHtml(pageTitle)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta property="og:title" content="${escapeHtml(pageTitle)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:image" content="/icons/icon-512.png">
<meta name="theme-color" content="#faf7f2" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#151210" media="(prefers-color-scheme: dark)">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<meta name="apple-mobile-web-app-title" content="${SITE.name}">
<script>try { const t = localStorage.getItem('tema'); if (t) document.documentElement.dataset.theme = t; } catch {}</script>
${intro ? LANDING_GATE : ''}
<link rel="stylesheet" href="${assets.css}">
<script src="${assets.js}" defer></script>
</head>
<body>
${intro}
<header class="site-header">
  <div class="wrap">
    <a class="brand" href="/" ${home ? 'aria-current="page"' : ''}>
      <img src="/icon.svg" alt="" width="32" height="32">
      <span><strong>${SITE.name}</strong><small>${SITE.fullName}</small></span>
    </a>
    <button class="theme-toggle" type="button" data-theme-toggle aria-label="Trocar tema"></button>
  </div>
</header>
<main class="wrap">
${content}
</main>
<footer class="site-footer wrap">
  <p>${SITE.fullName} · <a href="/?sobre">Sobre o app</a></p>
</footer>
</body>
</html>
`;
}

function chips(p) {
  const items = [];
  if (p.serie) items.push(`<span class="chip chip-serie">${escapeHtml(p.serie.title)}</span>`);
  if (p.data.tema) items.push(`<span class="chip">${escapeHtml(p.data.tema)}</span>`);
  return items.length ? `<div class="chips">${items.join('')}</div>` : '';
}

function palavraCard(p) {
  return `<a class="card palavra-card" href="${p.url}">
  <p class="meta">${escapeHtml(shortDate(p.date))}${p.data.contexto ? ` · ${escapeHtml(p.data.contexto)}` : ''}</p>
  <h3>${escapeHtml(p.title)}</h3>
  ${p.excerpt ? `<p class="excerpt">${escapeHtml(p.excerpt)}</p>` : ''}
  ${chips(p)}
</a>`;
}

// Card da grade "Todas as palavras": palavras de série ocupam a linha inteira e mostram o resumo maior
function gridCard(p) {
  const [, m, d] = p.date.split('-');
  const meta = [`${Number(d)} ${MONTHS[Number(m) - 1]}`, p.data.contexto].filter(Boolean).map(escapeHtml).join(' · ');
  const serie = p.serie ? ` · <span class="meta-serie">Série ${escapeHtml(p.serie.title)}</span>` : '';
  return `<a class="card grid-card${p.serie ? ' wide' : ''}" href="${p.url}">
  <p class="meta">${meta}${serie}</p>
  <h3>${escapeHtml(p.title)}</h3>
  ${p.excerpt ? `<p class="excerpt">${escapeHtml(p.excerpt)}</p>` : ''}
  ${p.data.tema ? `<div class="chips"><span class="chip">${escapeHtml(p.data.tema)}</span></div>` : ''}
</a>`;
}

// Card editorial da última palavra: data em destaque, texto base e tempo de leitura
function featuredCard(p) {
  const [, m, d] = p.date.split('-');
  const weekday = weekdayOf(p.date);
  const texto = p.data['texto-base'] ?? [p.data['referências'] ?? []].flat()[0];
  const tags = [texto, p.data.tema].filter(Boolean).map((t) => `<span class="chip">${escapeHtml(t)}</span>`).join('');
  return `<a class="card featured" href="${p.url}">
  <div class="featured-head">
    <div class="date-tile" aria-hidden="true"><strong>${Number(d)}</strong><small>${MONTHS[Number(m) - 1]}</small></div>
    <div>
      <p class="meta">${escapeHtml([p.data.contexto, weekday].filter(Boolean).join(' · '))}</p>
      <h3>${escapeHtml(p.title)}</h3>
    </div>
  </div>
  ${p.excerpt ? `<p class="excerpt">${escapeHtml(p.excerpt)}</p>` : ''}
  ${tags ? `<div class="chips">${tags}</div>` : ''}
  <div class="featured-foot">
    <span>${p.minutes} min de leitura</span>
    <span class="cta">Ler palavra →</span>
  </div>
</a>`;
}

function homePage({ palavras, series, proximo, assets }) {
  const [ultima] = palavras;
  const list = palavras.map((p) => `<li${p.serie ? ' class="wide"' : ''} data-search="${escapeHtml(p.search)}">${gridCard(p)}</li>`).join('\n');
  const seriesHtml = series.map((s) => `<a class="card serie-card" href="${s.url}">
    <p class="meta">${s.palavras.length} ${s.palavras.length === 1 ? 'palavra' : 'palavras'}${s.data.status ? ` · ${escapeHtml(s.data.status)}` : ''}</p>
    <h3>${escapeHtml(s.title)}</h3>
    ${s.excerpt ? `<p class="excerpt">${escapeHtml(s.excerpt)}</p>` : ''}
  </a>`).join('\n');

  return `
<section class="next-gp card" id="proximo-gp" data-gp="${escapeHtml(JSON.stringify(proximo))}" aria-live="polite">
  <p class="eyebrow">Próximo grupo de jovens</p>
  <noscript><p>Ative o JavaScript para ver o próximo encontro.</p></noscript>
</section>

${ultima ? `<section>
  <h2>Última palavra</h2>
  ${featuredCard(ultima)}
</section>` : ''}

${series.length ? `<section>
  <h2>Séries</h2>
  <div class="grid">${seriesHtml}</div>
</section>` : ''}

<section>
  <h2>Todas as palavras</h2>
  <label class="search">
    <span class="sr-only">Buscar</span>
    <input type="search" id="busca" placeholder="Buscar por tema, versículo, palavra…" autocomplete="off">
  </label>
  <ul class="palavra-list palavra-grid" id="lista">
${list}
  </ul>
  <p class="empty" id="vazio" hidden>Nenhuma palavra encontrada.</p>
</section>`;
}

function palavraPage(p, newer, older) {
  const nav = (item, label, cls) => item
    ? `<a class="pager-link ${cls}" href="${item.url}"><small>${label}</small><span>${escapeHtml(item.title)}</span></a>`
    : '<span></span>';
  return `
<article class="palavra">
  <a class="back" href="/">← Início</a>
  <header class="palavra-header">
    <p class="meta">${escapeHtml(longDate(p.date))}${p.data.contexto ? ` · ${escapeHtml(p.data.contexto)}` : ''}</p>
    <h1>${escapeHtml(p.title)}</h1>
    <div class="chips">
      ${p.serie ? `<a class="chip chip-serie" href="${p.serie.url}">Série: ${escapeHtml(p.serie.title)}</a>` : ''}
      ${p.data.tema ? `<span class="chip">${escapeHtml(p.data.tema)}</span>` : ''}
    </div>
    <button class="share" type="button" data-share hidden>Compartilhar</button>
  </header>
  <div class="prose">
${p.html}
  </div>
</article>
<nav class="pager" aria-label="Outras palavras">
  ${nav(older, '← Anterior', 'prev')}
  ${nav(newer, 'Próxima →', 'next')}
</nav>`;
}

function seriePage(s) {
  return `
<a class="back" href="/">← Início</a>
<header class="palavra-header">
  <p class="meta">Série${s.data['início'] ? ` · desde ${escapeHtml(shortDate(String(s.data['início'])))}` : ''}${s.data.status ? ` · ${escapeHtml(s.data.status)}` : ''}</p>
  <h1>${escapeHtml(s.title)}</h1>
</header>
<div class="prose">
${s.html}
</div>
<section>
  <h2>Palavras da série</h2>
  <ol class="palavra-list serie-list">
    ${s.palavras.map((p) => `<li>${palavraCard(p)}</li>`).join('\n')}
  </ol>
</section>`;
}

function notFoundPage() {
  return `
<section class="not-found">
  <h1>Página não encontrada</h1>
  <p>Essa palavra pode ter mudado de endereço.</p>
  <p><a href="/">← Voltar ao início</a></p>
</section>`;
}

// ---------- build ----------

async function writePage(url, html) {
  const file = url === '/' ? path.join(OUT, 'index.html')
    : url.endsWith('/') ? path.join(OUT, url, 'index.html')
    : path.join(OUT, url);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, html);
}

async function build() {
  if (!existsSync(CONTENT)) throw new Error(`Pasta de conteúdo não encontrada: ${CONTENT}`);

  const published = (n) => n.data.publicar === true;
  const palavras = (await readFolder(path.join(CONTENT, 'Palavras'))).filter(published).map((n) => ({
    ...n, date: String(n.data.data ?? ''), slug: slugify(n.name), url: `/palavras/${slugify(n.name)}/`,
  })).sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
  const series = (await readFolder(path.join(CONTENT, 'Séries'))).filter(published).map((n) => ({
    ...n, url: `/series/${slugify(n.name)}/`, palavras: [],
  }));

  const links = new Map([...palavras, ...series].map((n) => [n.name, n]));

  for (const p of palavras) {
    p.serie = links.get(nfc(linkTarget(p.data['série']) ?? ''));
    if (p.serie && !series.includes(p.serie)) p.serie = undefined;
    p.serie?.palavras.push(p);
    p.html = renderMarkdown(p.body, links);
    p.excerpt = excerptOf(p.body);
    p.minutes = Math.max(1, Math.round(toPlain(p.body).split(' ').length / 200));
    const refs = [p.data['referências'] ?? []].flat().join(' ');
    p.search = fold([p.title, p.data.tema, p.serie?.title, p.data.contexto, refs, [p.data.tags ?? []].flat().join(' '), toPlain(p.body)].filter(Boolean).join(' '));
  }
  for (const s of series) {
    s.palavras.sort((a, b) => a.date.localeCompare(b.date));
    s.html = renderMarkdown(s.body, links);
    s.excerpt = excerptOf(s.body);
  }
  series.sort((a, b) => String(b.data['início'] ?? '').localeCompare(String(a.data['início'] ?? '')));

  // Próximo GP: nota "Próximo GP.md" na raiz de 03-Igreja
  const gpFile = await findFile(CONTENT, 'Próximo GP.md');
  const gp = gpFile ? (await readNote(gpFile)).data : {};
  // Lista de encontros; o horário do topo vale para todos, a menos que o encontro tenha o seu.
  // O app (src/app.js) mostra o primeiro da lista até a nota ser atualizada.
  const horario = gp['horário'] ? String(gp['horário']) : '';
  const encontro = (e) => ({
    data: e.data ? String(e.data) : '',
    horario: e['horário'] ? String(e['horário']) : horario,
    local: e.local ?? '',
    endereco: e['endereço'] ?? '',
    mapa: e.mapa ?? '',
    aviso: e.aviso ?? '',
  });
  const proximo = {
    horario,
    encontros: (Array.isArray(gp.encontros) ? gp.encontros : gp.data ? [gp] : []).map(encontro),
  };

  // Saída
  await rm(OUT, { recursive: true, force: true });
  await mkdir(path.join(OUT, 'assets'), { recursive: true });
  await mkdir(path.join(OUT, 'icons'), { recursive: true });

  const css = await readFile(path.join(SRC, 'styles.css'), 'utf8');
  const js = await readFile(path.join(SRC, 'app.js'), 'utf8');
  const assets = { css: `/assets/styles.css?v=${hash(css)}`, js: `/assets/app.js?v=${hash(js)}` };
  await writeFile(path.join(OUT, 'assets', 'styles.css'), css);
  await writeFile(path.join(OUT, 'assets', 'app.js'), js);
  await copyFile(path.join(SRC, 'icon.svg'), path.join(OUT, 'icon.svg'));
  for (const f of await readdir(path.join(SRC, 'icons'))) await copyFile(path.join(SRC, 'icons', f), path.join(OUT, 'icons', f));

  const pages = new Map();
  pages.set('/', layout({ content: homePage({ palavras, series, proximo, assets }), assets, home: true, intro: landing({ palavras, series }) }));
  palavras.forEach((p, i) => pages.set(p.url, layout({
    title: p.title, description: p.excerpt || SITE.description, assets,
    content: palavraPage(p, palavras[i - 1], palavras[i + 1]),
  })));
  for (const s of series) pages.set(s.url, layout({ title: s.title, description: s.excerpt || SITE.description, assets, content: seriePage(s) }));
  pages.set('/404.html', layout({ title: 'Página não encontrada', assets, content: notFoundPage() }));
  for (const [url, html] of pages) await writePage(url, html);

  const manifest = {
    name: `${SITE.name} · ${SITE.fullName}`,
    short_name: SITE.name,
    description: SITE.description,
    lang: 'pt-BR',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#faf7f2',
    theme_color: '#8c2f1f',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
  await writeFile(path.join(OUT, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2));

  // Service worker: pré-carrega tudo para funcionar offline; a versão muda a cada conteúdo novo
  const precache = [...pages.keys(), assets.css, assets.js, '/icon.svg', '/manifest.webmanifest', '/icons/icon-192.png'];
  const version = hash([...pages.values()].join('') + css + js);
  const sw = (await readFile(path.join(SRC, 'sw.js'), 'utf8'))
    // Troca as atribuições, não o comentário do topo (que também cita os marcadores)
    .replace("'ujamj-__VERSION__'", `'ujamj-${version}'`)
    .replace('= __PRECACHE__;', `= ${JSON.stringify(precache)};`);
  await writeFile(path.join(OUT, 'sw.js'), sw);

  await writeFile(path.join(OUT, '_headers'), `/sw.js
  Cache-Control: no-cache
/assets/*
  Cache-Control: public, max-age=31536000, immutable
`);

  console.log(`✓ ${palavras.length} palavras, ${series.length} séries · encontros: ${proximo.encontros.map((e) => e.data).join(', ') || 'nenhum'} · versão ${version}`);
}

await build();
