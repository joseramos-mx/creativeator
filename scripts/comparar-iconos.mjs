/**
 * scripts/comparar-iconos.mjs — `npm run comparar-iconos <a.png> [b.png …]`
 *
 * Pone un ícono candidato al lado de la librería, sobre las tres paletas.
 *
 * Es la única forma honesta de decidir si un ícono generado sirve. A solas,
 * sobre el blanco del editor, casi cualquier render parece razonable; lo que
 * importa es si empata con los que ya están **en el mismo carrusel y sobre el
 * mismo fondo**. Un ícono que no comparte el material, la luz o el ángulo se
 * nota justo ahí y en ningún otro sitio.
 *
 * Debajo de cada uno va su separación ΔE contra el fondo, que es lo que decide
 * si se funde. El candidato se marca con un marco para no confundirlo.
 *
 * Sale un PNG en salidas/comparar/iconos.png. No hace falta servidor.
 */

import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { paletas } from '../template/tokens.ts';
import { separacion, SEPARACION_MINIMA } from '../lib/iconos.ts';

// Varios candidatos a la vez: al generar salen tres variantes y lo que hay que
// decidir es cuál de ellas empata, no si una suelta es aceptable.
const candidatos = process.argv.slice(2).filter((a) => a.endsWith('.png'));

const RAIZ = process.cwd();
const ICONOS = path.join(RAIZ, 'public', 'iconos');
const SALIDA = path.join(RAIZ, 'salidas', 'comparar');

const CELDA = 150;
const ICONO = 104;
const PIE = 30;
const MARGEN = 22;
const TITULO = 40;

const manifiesto = JSON.parse(await readFile(path.join(ICONOS, 'manifest.json'), 'utf8'));

/** Los candidatos primero, para verlos contra la librería y no perdidos en ella. */
const piezas = [];
for (const ruta of candidatos) {
  const png = await readFile(path.resolve(ruta));
  piezas.push({
    slug: path.basename(ruta, '.png'),
    png,
    color: await colorDominante(png),
    esCandidato: true,
  });
}
for (const entrada of manifiesto) {
  piezas.push({
    slug: entrada.slug,
    png: await readFile(path.join(ICONOS, `${entrada.slug}.png`)),
    color: entrada.color,
    esCandidato: false,
  });
}

const columnas = Math.min(piezas.length, 12);
const filas = Math.ceil(piezas.length / columnas);
const anchoFila = MARGEN * 2 + columnas * CELDA;
const altoFila = TITULO + filas * (CELDA + PIE) + MARGEN;
const nombres = Object.keys(paletas);

const capas = [];
let y = 0;

for (const nombre of nombres) {
  const paleta = paletas[nombre];
  capas.push({
    input: await sharp({
      create: { width: anchoFila, height: altoFila, channels: 4, background: paleta.fondo },
    })
      .png()
      .toBuffer(),
    top: y,
    left: 0,
  });
  capas.push({ input: Buffer.from(rotulo(nombre, paleta.fondo)), top: y + 12, left: MARGEN });

  for (const [i, pieza] of piezas.entries()) {
    const col = i % columnas;
    const fila = Math.floor(i / columnas);
    const x = MARGEN + col * CELDA;
    const cy = y + TITULO + fila * (CELDA + PIE);

    const delta = separacion({ color: pieza.color }, paleta.fondo);
    const flojo = delta !== null && delta < SEPARACION_MINIMA;

    if (pieza.esCandidato) {
      capas.push({ input: Buffer.from(marco()), top: cy, left: x });
    }
    capas.push({
      input: await sharp(pieza.png).resize(ICONO, ICONO, { fit: 'inside' }).png().toBuffer(),
      top: cy + Math.round((CELDA - ICONO) / 2),
      left: x + Math.round((CELDA - ICONO) / 2),
    });
    capas.push({
      input: Buffer.from(pie(pieza.slug, delta, flojo, pieza.esCandidato)),
      top: cy + CELDA - 6,
      left: x,
    });
  }

  y += altoFila;
}

await mkdir(SALIDA, { recursive: true });
const destino = path.join(SALIDA, 'iconos.png');
await sharp({
  create: { width: anchoFila, height: y, channels: 4, background: '#0b0e13' },
})
  .composite(capas)
  .png()
  .toFile(destino);

console.log(`\n${piezas.length} íconos sobre ${nombres.length} paletas → ${destino}`);
for (const pieza of piezas.filter((p) => p.esCandidato)) {
  console.log(`\n${pieza.slug} · color dominante ${pieza.color} · el del marco`);
  for (const nombre of nombres) {
    const d = separacion({ color: pieza.color }, paletas[nombre].fondo);
    const veredicto = d === null ? 'sin color' : d < SEPARACION_MINIMA ? 'SE FUNDE' : 'se ve';
    console.log(`  sobre ${nombre.padEnd(8)} ΔE ${String(Math.round(d ?? 0)).padStart(3)}  ${veredicto}`);
  }
}

/* ── los textos, en SVG porque sharp no escribe texto ────────────────────── */

function escapar(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function rotulo(nombre, fondo) {
  const tinta = paletas[nombre].tintaPapel ?? '#111';
  return `<svg width="${anchoFila}" height="22" xmlns="http://www.w3.org/2000/svg">
    <text x="0" y="16" font-family="Albert Sans, Segoe UI, sans-serif" font-size="15"
      font-weight="600" fill="${tinta}">paleta ${nombre} · ${fondo}</text></svg>`;
}

function pie(slug, delta, flojo, esCandidato) {
  const texto = delta === null ? slug : `${slug}  ΔE ${Math.round(delta)}`;
  const color = flojo ? '#B00020' : esCandidato ? '#111' : '#33333399';
  const peso = esCandidato ? '700' : '400';
  return `<svg width="${CELDA}" height="${PIE}" xmlns="http://www.w3.org/2000/svg">
    <text x="${CELDA / 2}" y="14" text-anchor="middle"
      font-family="IBM Plex Mono, Consolas, monospace" font-size="10.5"
      font-weight="${peso}" fill="${color}">${escapar(texto)}</text>
    ${flojo ? `<text x="${CELDA / 2}" y="26" text-anchor="middle" font-family="IBM Plex Mono, Consolas, monospace" font-size="9.5" fill="#B00020">se funde</text>` : ''}
  </svg>`;
}

function marco() {
  return `<svg width="${CELDA}" height="${CELDA}" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="${CELDA - 4}" height="${CELDA - 4}" rx="14"
      fill="none" stroke="#111" stroke-width="2.5" stroke-dasharray="7 5"/></svg>`;
}

/** El mismo cálculo de la ingesta, para poder medir un PNG que aún no está en ella. */
async function colorDominante(png) {
  const { data, info } = await sharp(png)
    .resize(64, 64, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const cubos = new Map();
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i + 3] < 200) continue;
    const clave = `${data[i] >> 5},${data[i + 1] >> 5},${data[i + 2] >> 5}`;
    const c = cubos.get(clave) ?? { n: 0, r: 0, g: 0, b: 0 };
    c.n++; c.r += data[i]; c.g += data[i + 1]; c.b += data[i + 2];
    cubos.set(clave, c);
  }

  let mejor = null;
  for (const c of cubos.values()) if (!mejor || c.n > mejor.n) mejor = c;
  if (!mejor) return null;

  const hex = (v) => Math.round(v / mejor.n).toString(16).padStart(2, '0');
  return `#${hex(mejor.r)}${hex(mejor.g)}${hex(mejor.b)}`.toUpperCase();
}
