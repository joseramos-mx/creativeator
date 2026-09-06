/**
 * scripts/graficos.mjs — `npm run graficos`
 *
 * Tres piezas de la plantilla no son imágenes fijas sino dibujos deterministas:
 * el papel rasgado, la palomita de las listas y la flecha de "desliza". Se
 * generan una sola vez a public/marca/ y desde ahí se consumen como archivos.
 * Así el navegador no tiene que dibujar nada antes de que Playwright capture.
 *
 * Salen en SVG y no en PNG a propósito: son formas planas, pesan unos kilobytes,
 * se ven exactas al exportar a 2× y el proyecto no necesita una librería de
 * canvas nativa para generarlas.
 *
 * Del papel se generan doce variantes. Cada post elige la suya por su slug
 * (ver template/papel.ts), para que dos carruseles seguidos no lleven el mismo
 * rasgado y el feed no se vea repetido.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const destino = join(raiz, 'public', 'marca');
mkdirSync(destino, { recursive: true });

/* ── medidas, iguales a las de template/tokens.ts ── */
const PAPEL = { ancho: 424, alto: 108, color: '#F3F1EC' };
const PALOMITA = { tam: 31, color: '#22B04B' };
const FLECHA = { ancho: 113, alto: 39 };
const VARIANTES = 12;

/** Aleatorio con semilla: la misma semilla da siempre el mismo rasgado. */
function azar(semilla) {
  let r = semilla;
  return () => ((r = (r * 9301 + 49297) % 233280) / 233280);
}

/**
 * Un borde rasgado: un punto cada 14 px con desviación de 1 a 10 px, alternando
 * la amplitud para que la fibra no quede rítmica. Si todos los dientes miden lo
 * mismo, el papel se ve troquelado en vez de roto.
 */
function borde(ancho, y, direccion, rnd) {
  const puntos = [];
  for (let x = 0; x <= ancho; x += 14) {
    const amplitud = (x % 28 < 14 ? 1 : 4) + rnd() * 9;
    puntos.push([x, +(y + direccion * amplitud).toFixed(2)]);
  }
  puntos.push([ancho, +(y + direccion * (1 + rnd() * 9)).toFixed(2)]);
  return puntos;
}

function papel(semilla) {
  const { ancho, alto, color } = PAPEL;
  const rnd = azar(semilla);
  const arriba = borde(ancho, 9, -1, rnd);
  const abajo = borde(ancho, alto - 9, 1, rnd);

  const d = [
    `M ${arriba[0][0]} ${arriba[0][1]}`,
    ...arriba.slice(1).map(([x, y]) => `L ${x} ${y}`),
    ...abajo.reverse().map(([x, y]) => `L ${x} ${y}`),
    'Z',
  ].join(' ');

  // 260 trazos de 1 px como textura de fibra, blancos y negros al 6 %.
  const fibra = [];
  for (let i = 0; i < 260; i++) {
    const x = (rnd() * ancho).toFixed(1);
    const y = (rnd() * alto).toFixed(1);
    const w = (rnd() * 22).toFixed(1);
    fibra.push(`<rect x="${x}" y="${y}" width="${w}" height="1" fill="${i % 2 ? '#000' : '#fff'}"/>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}">
  <defs><clipPath id="p"><path d="${d}"/></clipPath></defs>
  <path d="${d}" fill="${color}"/>
  <g clip-path="url(#p)" opacity=".06">${fibra.join('')}</g>
</svg>
`;
}

/**
 * La palomita se dibuja en vez de usar el emoji ✅ porque el emoji cambia según
 * el sistema y en la captura sale distinto en cada máquina.
 */
function palomita() {
  const { tam: s, color } = PALOMITA;
  const r = (s * 0.18).toFixed(2);
  const grosor = (s * 0.13).toFixed(2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <rect width="${s}" height="${s}" rx="${r}" fill="${color}"/>
  <path d="M ${(s * 0.24).toFixed(2)} ${(s * 0.53).toFixed(2)} L ${(s * 0.43).toFixed(2)} ${(s * 0.71).toFixed(2)} L ${(s * 0.77).toFixed(2)} ${(s * 0.3).toFixed(2)}"
        fill="none" stroke="#fff" stroke-width="${grosor}" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;
}

function flecha() {
  const { ancho: w, alto: h } = FLECHA;
  const t = 3.4;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <g fill="none" stroke="#FAF7F2" stroke-width="${t}" stroke-linecap="round" stroke-linejoin="round">
    <path d="M 4 11 Q ${(w * 0.45).toFixed(1)} ${(h - 4).toFixed(1)} ${(w - 10).toFixed(1)} 14"/>
    <path d="M ${(w - 23).toFixed(1)} 9 L ${(w - 6).toFixed(1)} 14 L ${(w - 20).toFixed(1)} 24"/>
  </g>
</svg>
`;
}

const escritos = [];
for (let i = 1; i <= VARIANTES; i++) {
  const nombre = `papel-${String(i).padStart(2, '0')}.svg`;
  writeFileSync(join(destino, nombre), papel(i * 977 + 7));
  escritos.push(nombre);
}
writeFileSync(join(destino, 'palomita.svg'), palomita());
writeFileSync(join(destino, 'flecha.svg'), flecha());
escritos.push('palomita.svg', 'flecha.svg');

console.log(`Gráficos generados en public/marca/: ${escritos.join(', ')}`);
