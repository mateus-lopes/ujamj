// Gera os PNGs do PWA a partir de src/icon.svg. Rode só quando mudar o ícone: npm run icons
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const SRC = path.resolve(import.meta.dirname, '..', 'src');
const svg = await readFile(path.join(SRC, 'icon.svg'), 'utf8');

// Versão "maskable": fundo cheio e desenho reduzido para caber na área segura do Android
const maskable = svg
  .replace('rx="112"', 'rx="0"')
  .replace('<g id="mark">', '<g id="mark" transform="translate(51.2 51.2) scale(.8)">');

const outputs = [
  ['icon-192.png', svg, 192],
  ['icon-512.png', svg, 512],
  ['icon-maskable-512.png', maskable, 512],
  ['apple-touch-icon.png', maskable, 180],
];

for (const [file, source, size] of outputs) {
  const png = new Resvg(source, { fitTo: { mode: 'width', value: size } }).render().asPng();
  await writeFile(path.join(SRC, 'icons', file), png);
  console.log(`✓ ${file}`);
}
