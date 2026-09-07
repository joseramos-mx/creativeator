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
 * ── Cuando ya no queda rastro del fondo: `--fondo` ─────────────────────────
 * El camino de arriba necesita que el croma toque el borde. Hay dos casos en
 * los que no lo toca y hace falta decirle el color a mano:
 *
 *  · **El fondo que el objeto encierra.** La inundación entra por la orilla, así
 *    que no alcanza el agujero de un aro ni el hueco de un asa. Al generar eso
 *    ya está resuelto —`quitarCroma` hace una pasada más—, pero en un ícono ya
 *    guardado el hueco quedó dentro y su orilla es transparente.
 *  · **El fondo que no era croma.** En `cold-compress-cloth`, Gemini devolvió
 *    blanco con verde en las esquinas.
 *
 * `--fondo <slug> <r,g,b>` **reconstruye el render**: vuelve a componer el
 * ícono encima de ese color y lo pasa por el recorte de siempre, con su
 * inundación, su pasada de huecos, su rampa de antialias y su desderrame. No
 * hay lógica nueva que mantener.
 *
 * El color se pide y no se adivina, a propósito: de los treinta y cinco
 * íconos, nueve tienen una zona de color exactamente plano y ocho de ellas son
 * superficies legítimas —la cara de un calendario, el blanco de un plato—. Un
 * detector automático las borraría.
 *
 * Por defecto **no escribe nada**: dice qué haría. Con `--escribir` lo hace.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { orillaOpaca, quitarCroma } from '../lib/iconos/croma.ts';

const ICONOS = join(process.cwd(), 'public', 'iconos');
const escribir = process.argv.includes('--escribir');

const iFondo = process.argv.indexOf('--fondo');
const fondoDicho =
  iFondo === -1
    ? null
    : {
        slug: process.argv[iFondo + 1],
        color: (process.argv[iFondo + 2] ?? '').split(',').map(Number),
      };
if (fondoDicho && (!fondoDicho.slug || fondoDicho.color.length !== 3 || fondoDicho.color.some(Number.isNaN))) {
  console.error('\nALTO: va así — npm run iconos:recortar -- --fondo hoop-earring 9,209,22');
  process.exit(1);
}

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

async function miniatura(png) {
  return sharp(png)
    .resize(160, 160, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

const manifiesto = JSON.parse(readFileSync(join(ICONOS, 'manifest.json'), 'utf8'));
const generados = manifiesto.filter((i) => i.origen === 'generado');

/* ── el hueco encerrado, con el color dicho a mano ────────────────────────── */

if (fondoDicho) {
  const ruta = join(ICONOS, `${fondoDicho.slug}.png`);
  const [r, g, b] = fondoDicho.color;

  /*
   * Se reconstruye el render y se pasa por el camino de siempre.
   *
   * La primera versión de esto ponía el alfa a cero en los píxeles cercanos al
   * color dicho, y dejaba un filo verde alrededor del agujero: el borde del
   * objeto es una mezcla con el fondo, y cortarlo a cuchillo no deshace esa
   * mezcla. Volver a componer el ícono **encima del croma** devuelve la imagen a
   * como llegó de Gemini, y a partir de ahí `quitarCroma` hace todo lo que ya
   * sabe hacer: la inundación, la pasada de huecos, la rampa de antialias y el
   * desderrame. Nada de lógica nueva que mantener.
   */
  const png0 = readFileSync(ruta);
  const meta = await sharp(png0).metadata();
  const plano = await sharp({
    create: { width: meta.width, height: meta.height, channels: 4, background: { r, g, b, alpha: 1 } },
  })
    .composite([{ input: png0 }])
    .png()
    .toBuffer();

  const { data, info } = await sharp(plano).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const rgba = quitarCroma({ datos: data, ancho: info.width, alto: info.height });

  let quitados = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    if (data[i + 3] > 200 && rgba[i + 3] === 0) quitados++;
  }
  const pct = (100 * quitados) / (info.width * info.height);
  const orilla = orillaOpaca({ datos: rgba, ancho: info.width, alto: info.height });

  console.log(
    `
${fondoDicho.slug}: ${escribir ? 'quitado' : 'se quitaría'} el ${pct.toFixed(1)} % ` +
      `de rgb(${fondoDicho.color.join(',')}) · orilla opaca ${(100 * orilla).toFixed(0)} %`,
  );

  if (escribir && quitados > 0) {
    const png = await normalizar(
      await sharp(Buffer.from(rgba), { raw: { width: info.width, height: info.height, channels: 4 } })
        .png()
        .toBuffer(),
    );
    writeFileSync(ruta, png);
    writeFileSync(join(ICONOS, 'thumbs', `${fondoDicho.slug}.png`), await miniatura(png));
  }
  process.exit(0);
}

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
    writeFileSync(join(ICONOS, 'thumbs', `${icono.slug}.png`), await miniatura(png));
    arreglados++;
  }
}

console.log(
  `\n${rotos} con fondo sin quitar` +
    (escribir ? `, ${arreglados} arreglado(s).` : '. Corre con --escribir para arreglarlos.'),
);
if (rotos > 0 && !escribir) process.exitCode = 1;
