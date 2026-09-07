/**
 * scripts/recortar-iconos.mjs — `npm run iconos:recortar [--escribir]`
 *
 * Vuelve a recortar los íconos generados que se guardaron con el fondo puesto.
 *
 * ── Qué pasó ────────────────────────────────────────────────────────────────
 * `quitarCroma` arrancaba la inundación solo donde el verde dominaba a los
 * otros canales por más de 140. Gemini no devuelve el `#00FF00` que se le pide:
 * devuelve un verde apagado, `rgb(76,195,70)`, que se queda en 119. La
 * inundación no arrancaba nunca y el fondo entero sobrevivía. Ocho íconos se
 * guardaron así, y como quedan en la librería, cada carrusel nuevo que pedía
 * ese concepto los reutilizaba.
 *
 * ── Por qué esto y no volver a generarlos ───────────────────────────────────
 * Porque no hace falta: **el archivo guardado tiene el objeto y tiene el
 * fondo**, los dos intactos. Lo único que faltó fue el recorte, y el recorte es
 * local. Regenerar costaría una llamada por ícono para obtener un dibujo
 * distinto del que ya está puesto en ocho carruseles.
 *
 * El único paso extra es quitar antes el margen transparente: el PNG guardado
 * ya pasó por el reencuadre, así que su orilla es transparente y el croma queda
 * dentro. Sin recortar ese margen, la inundación empieza en el transparente y
 * se para en el borde del rectángulo verde.
 *
 * Por defecto **no escribe nada**: dice qué haría. Con `--escribir` lo hace.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { orillaOpaca, quitarCroma } from '../lib/iconos/croma.ts';

const ICONOS = join(process.cwd(), 'public', 'iconos');
const escribir = process.argv.includes('--escribir');

/** Lo mismo que hace la ingesta y la generación: 4 % de aire, 1024 de lado. */
const TAM = 1024;
const AIRE = 0.04;

async function normalizar(conAlfa) {
  const lado = Math.round(TAM * (1 - AIRE * 2));
  const borde = Math.round(TAM * AIRE);
  return sharp(await sharp(conAlfa).trim({ threshold: 1 }).toBuffer())
    .resize(lado, lado, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({ top: borde, bottom: borde, left: borde, right: borde, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

const manifiesto = JSON.parse(readFileSync(join(ICONOS, 'manifest.json'), 'utf8'));
const generados = manifiesto.filter((i) => i.origen === 'generado');

console.log(`\n${generados.length} ícono(s) generado(s) en la librería.\n`);

let rotos = 0;
let arreglados = 0;

for (const icono of generados) {
  const ruta = join(ICONOS, `${icono.slug}.png`);

  // Fuera el margen transparente que puso el reencuadre: lo que quede es el
  // render tal como llegó, y ahí el croma sí toca el borde.
  const sinMargen = await sharp(readFileSync(ruta)).trim({ threshold: 1 }).toBuffer();
  const { data, info } = await sharp(sinMargen).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const rgba = quitarCroma({ datos: data, ancho: info.width, alto: info.height });

  /*
   * Lo que hay que medir es cuánto pasó de **opaco a transparente**, no cuánto
   * acabó transparente. Contar lo segundo daba que los treinta y cinco tenían
   * fondo: en un ícono bien recortado, todo lo que rodea al objeto ya era
   * transparente, así que `quitarCroma` lo "quita" otra vez y la cuenta sale
   * enorme sin que haya pasado nada.
   */
  let convertidos = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    if (data[i + 3] > 200 && rgba[i + 3] === 0) convertidos++;
  }
  const quitado = convertidos / (rgba.length / 4);
  const orilla = orillaOpaca({ datos: rgba, ancho: info.width, alto: info.height });

  // Si no había fondo opaco que quitar, el ícono ya estaba bien y no se toca.
  // Reprocesar uno correcto solo puede empeorarlo.
  if (quitado < 0.05) {
    console.log(`  ok      ${icono.slug}`);
    continue;
  }

  rotos++;
  if (orilla > 0.02) {
    // El recorte nuevo tampoco lo deja limpio: el objeto sale cortado del
    // encuadre o el render no tenía un fondo de un solo color. Ese sí hay que
    // volver a generarlo, y se dice en vez de guardar algo a medias.
    console.log(
      `  NO SALE ${icono.slug} — tras recortar queda ${Math.round(orilla * 100)} % de orilla opaca. ` +
        'Hay que regenerarlo.',
    );
    continue;
  }

  const png = await normalizar(
    await sharp(Buffer.from(rgba), { raw: { width: info.width, height: info.height, channels: 4 } })
      .png()
      .toBuffer(),
  );

  console.log(
    `  ${escribir ? 'ARREGLA' : 'haría  '} ${icono.slug} — le sobraba ${Math.round(quitado * 100)} % de fondo`,
  );
  if (escribir) {
    writeFileSync(ruta, png);
    // La miniatura sale del mismo archivo, así que hay que rehacerla o el
    // buscador del editor seguiría enseñando el rectángulo verde.
    writeFileSync(
      join(ICONOS, 'thumbs', `${icono.slug}.png`),
      await sharp(png).resize(160, 160, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(),
    );
    arreglados++;
  }
}

console.log(
  `\n${rotos} con fondo sin quitar` +
    (escribir ? `, ${arreglados} arreglado(s).` : '. Corre con --escribir para arreglarlos.'),
);
if (rotos > 0 && !escribir) process.exitCode = 1;
