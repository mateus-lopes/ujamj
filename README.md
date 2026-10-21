# UJAMJ: Palavras do GP

App (PWA) da **União Jovem As Maravilhas de Jesus**. Mostra o próximo GP, as séries e todas as palavras ministradas, com busca e funcionamento offline.

O conteúdo vem direto do vault do Obsidian (`cortex/03-Igreja`):

```
Obsidian (03-Igreja)  ──git push──▶  GitHub Action (cortex)  ──build──▶  Cloudflare Workers
```

## Como publicar

| O quê | Onde | Como |
|---|---|---|
| Palavra | `03-Igreja/Palavras/*.md` | `publicar: true` no frontmatter |
| Série | `03-Igreja/Séries/*.md` | `publicar: true` no frontmatter |
| Próximo GP | `03-Igreja/Próximo GP.md` | Atualizar `data`, `horário`, `local`, `endereço`, `mapa`, `aviso` |

Notas sem `publicar: true` nunca saem do vault. O template de palavra já nasce com `publicar: false`.

Quando a data do próximo GP passa, o app mostra a próxima quarta com "local a definir" até a nota ser atualizada.

### O que vira o quê
- `> [!bible] Livro 0:0` vira o card de versículo; `> [!question]`, o card de perguntas.
- `[[Outra nota]]` vira link se a nota estiver publicada; se não estiver, vira só texto.
- Blocos `dataview`, comentários `%% %%` e seções vazias são removidos.

## Desenvolvimento

```bash
npm install
npm run build   # gera dist/ (lê ../cortex/03-Igreja por padrão; CONTENT_DIR muda o caminho)
npm run dev     # build + wrangler dev em http://localhost:8787
npm run deploy  # build + publica no Cloudflare
npm run icons   # regera os PNGs a partir de src/icon.svg
```

## Estrutura

```
scripts/build.mjs   gerador do site (markdown do Obsidian -> HTML)
scripts/icons.mjs   gera os ícones do PWA
src/styles.css      visual (claro/escuro automático)
src/app.js          card do próximo GP, busca, compartilhar, registro do service worker
src/sw.js           service worker (offline)
src/icons/          ícones gerados (versionados)
```

## Deploy automático

O workflow fica no repositório do vault (`cortex/.github/workflows/ujamj.yml`) e roda a cada push que mexe em `03-Igreja/`. Ele precisa de dois secrets no repo `cortex`:

- `CLOUDFLARE_API_TOKEN`: token com o template **Edit Cloudflare Workers**
- `CLOUDFLARE_ACCOUNT_ID`
