/**
 * scripts/pruebas.mjs — `npm run pruebas [puerto]`
 *
 * Las pruebas del editor, contra los carruseles de laboratorio.
 *
 * La regla que ordena este archivo: **una prueba nunca abre un post
 * publicado**. Se comprueba de verdad, no de palabra —`soloLaboratorio()` para
 * el proceso si el slug no empieza por `laboratorio-`— porque el accidente que
 * originó esta regla fue justamente un clic que llegó a donde no debía.
 *
 * Antes de cada corrida se reinician los posts de laboratorio, así que las
 * pruebas pueden escribir, borrar y empujar lo que quieran.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { PREFIJO, reiniciarLaboratorio } from './laboratorio.mjs';

const puerto = process.argv[2] ?? '3000';
const base = `http://localhost:${puerto}`;

const EDICION = 'laboratorio-edicion';
const PALETAS = 'laboratorio-paletas';

let fallos = 0;
const ok = (bien, texto) => {
  console.log(`  ${bien ? 'OK  ' : 'FALLA'} ${texto}`);
  if (!bien) fallos++;
};
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/** El guardia. Si una prueba apunta a otro sitio, no se corre: se para. */
function soloLaboratorio(slug) {
  if (!slug.startsWith(PREFIJO)) {
    console.error(`\nALTO: "${slug}" no es un carrusel de laboratorio.`);
    console.error('Las pruebas escriben, borran y empujan. No pueden tocar contenido publicado.');
    process.exit(1);
  }
  return slug;
}

const leer = (slug) =>
  JSON.parse(readFileSync(join(process.cwd(), 'content', 'posts', `${slug}.json`), 'utf8'));

async function abrir(page, slug) {
  soloLaboratorio(slug);
  await page.goto(`${base}/post/${slug}`, { waitUntil: 'networkidle', timeout: 120_000 });
  await page.evaluate(() => document.fonts.ready);
  await espera(1500);
}

/** Abre la tarjeta de un slide por su posición, sin depender de coordenadas. */
async function abrirTarjeta(page, indice) {
  const tarjeta = page.locator('.tarjeta').nth(indice + 2); // ficha y brief van antes
  if ((await tarjeta.getAttribute('open')) === null) {
    await tarjeta.locator('summary .tarjeta__titulo').click();
    await espera(400);
  }
  return tarjeta;
}

const slugs = await reiniciarLaboratorio();
console.log(`Laboratorio reiniciado: ${slugs.join(', ')}`);
await espera(1200);

const navegador = await chromium.launch();
const page = await navegador.newPage({ viewport: { width: 1600, height: 1000 } });

/* ── guardado automático ─────────────────────────────────────────────────── */
console.log('\nGuardado automático');
await abrir(page, EDICION);
ok((await page.locator('button:has-text("Guardar")').count()) === 0, 'no hay botón de guardar');
const temaAntes = leer(EDICION).tema;
await page.locator('.tarjeta').first().locator('input').first().fill(`${temaAntes} ·`);
await espera(300);
ok(leer(EDICION).tema === temaAntes, 'a los 300 ms todavía no escribe: el retraso existe');
await espera(1500);
ok(leer(EDICION).tema.endsWith('·'), 'a los 1800 ms ya guardó');
ok((await page.locator('.estado').innerText()).includes('guardado'), 'y el estado lo dice');

/* ── arrastrar la imagen sobre el slide ──────────────────────────────────── */
console.log('\nArrastrar la imagen sobre el slide');
const srcAntes = leer(EDICION).slides[1].visual.src;
const dt = await page.evaluateHandle(async () => {
  const dt = new DataTransfer();
  const blob = await (await fetch('/media/laboratorio-edicion/portada.jpg')).blob();
  dt.items.add(new File([blob], 'Foto Arrastrada Ñandú.jpg', { type: 'image/jpeg' }));
  return dt;
});
const slide01 = page.locator('.marco--soltable').nth(1);
await slide01.dispatchEvent('dragover', { dataTransfer: dt });
ok((await slide01.getAttribute('data-soltando')) !== null, 'el slide se marca al pasar la imagen');
await slide01.dispatchEvent('drop', { dataTransfer: dt });
await espera(4000);
const src = leer(EDICION).slides[1].visual.src;
ok(src !== srcAntes, `la imagen cambió a ${src}`);
ok(/foto-arrastrada-nandu-[a-z0-9]+\.jpg$/.test(src), 'con el nombre normalizado');
ok(
  (await page.locator('.marco--soltable').last().getAttribute('data-soltando')) === null,
  'el cierre no acepta imagen',
);

/* ── empuje y contador de overrides ──────────────────────────────────────── */
console.log('\nModo de empuje');
const tarjeta1 = await abrirTarjeta(page, 1);
await tarjeta1.locator('button:has-text("bloque")').click();
for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown');
await espera(1200);
ok(leer(EDICION).slides[1].overrides?.offsetY === 3, `offsetY = ${leer(EDICION).slides[1].overrides?.offsetY}`);
await page.keyboard.press('Shift+ArrowUp');
await espera(1200);
ok(leer(EDICION).slides[1].overrides?.offsetY === -7, 'Shift mueve de diez en diez');
for (let i = 0; i < 7; i++) await page.keyboard.press('ArrowDown');
await espera(1200);
ok(leer(EDICION).slides[1].overrides === undefined, 'volver al valor de la plantilla borra el override');

await tarjeta1.locator('button:has-text("titulo")').click();
await page.keyboard.press('-');
await page.keyboard.press('-');
await tarjeta1.locator('button:has-text("cuerpo")').click();
await page.keyboard.press('-');
await tarjeta1.locator('button:has-text("bloque")').click();
await page.keyboard.press('ArrowDown');
await espera(1200);
ok(Object.keys(leer(EDICION).slides[1].overrides ?? {}).length === 3, 'tres ajustes a mano');
ok(/plantilla/.test(await tarjeta1.locator('.aviso').innerText()), 'y el aviso apunta a la plantilla');

/* ── aviso de recorte ────────────────────────────────────────────────────── */
console.log('\nAviso de recorte');
await tarjeta1.locator('textarea').nth(2).fill('Un texto larguísimo que no cabe de ninguna manera. '.repeat(16));
await espera(1600);
ok(/recortar/.test(await tarjeta1.locator('.aviso').first().innerText()), 'dice recortar, no encoger');

/* ── buscador de íconos contra la paleta ─────────────────────────────────── */
console.log('\nBuscador de íconos');
const tarjeta2 = await abrirTarjeta(page, 2);
await tarjeta2.locator('button:has-text("cambiar"), button:has-text("buscar")').first().click();
await espera(900);
ok((await page.locator('.modal').count()) === 1, 'abre el buscador');
await page.locator('.modal__cabecera input').fill('fiebre');
await espera(700);
ok(
  (await page.locator('.icono-opcion span').last().innerText()) === 'termometro',
  '"fiebre" encuentra el termómetro por sinónimo',
);
await page.locator('.icono-opcion').first().click();
await espera(2000);
ok(leer(EDICION).slides[2].visual.slug === 'termometro', 'el ícono elegido se guarda');

/* ── paletas ─────────────────────────────────────────────────────────────── */
console.log('\nPaletas');
await abrir(page, PALETAS);
const selector = page.locator('.tarjeta').first().locator('select').nth(1);
ok((await selector.inputValue()) === 'azul', 'el selector muestra la paleta del post');

const flojosDe = async (paleta) => {
  await selector.selectOption(paleta);
  await espera(1600);
  const t = await abrirTarjeta(page, 2); // el slide con ícono
  await t.locator('button:has-text("cambiar"), button:has-text("buscar")').first().click();
  await espera(900);
  const flojos = await page.locator('.icono-opcion[data-flojo] span:last-child').allInnerTexts();
  await page.keyboard.press('Escape');
  await espera(400);
  return flojos.sort().join(', ');
};

const fondoDe = () =>
  page.locator('.marco .slide').nth(1).evaluate((e) => getComputedStyle(e).backgroundColor);

ok((await flojosDe('azul')) === 'informacion', 'sobre azul se funde informacion');
ok((await fondoDe()) === 'rgb(81, 162, 255)', 'y el fondo es el azul');
ok((await flojosDe('naranja')) === 'alerta, correr, silencio', 'sobre naranja, otros tres');
ok((await fondoDe()) === 'rgb(237, 132, 47)', 'y el fondo es el naranja');
ok((await flojosDe('verde')) === 'palomita-verde', 'sobre verde, la palomita');
ok(leer(PALETAS).paleta === 'verde', 'la paleta se guarda en el JSON');

const velo = await page
  .locator('.slide__velo')
  .first()
  .evaluate((e) => getComputedStyle(e).backgroundImage);
ok(velo.includes('72, 180, 93'), 'el velo de la portada sigue a la paleta');

/* ── que el laboratorio siga siendo laboratorio ──────────────────────────── */
console.log('\nEl guardia');
ok(leer('impetigo-regreso-a-clases').slides.length === 7, 'el post publicado sigue con sus 7 slides');
ok(leer('impetigo-regreso-a-clases').paleta === 'azul', 'y en azul');

await navegador.close();
console.log(fallos === 0 ? '\nTodo en pie.' : `\n${fallos} pruebas fallaron.`);
if (fallos > 0) process.exitCode = 1;
