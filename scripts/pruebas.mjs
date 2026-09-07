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
import { afirmacionesDe } from '../lib/afirmaciones.ts';

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

/**
 * Espera a que algo pase, no a que pase un rato.
 *
 * Subir una imagen tarda lo que tarde el disco y la recompresión, así que una
 * espera fija falla de vez en cuando y hace ruido en las pruebas que sí
 * importan. Donde el tiempo es la prueba —el retraso del guardado— se sigue
 * esperando a reloj, a propósito.
 */
async function esperarA(condicion, limite = 20_000) {
  const hasta = Date.now() + limite;
  while (Date.now() < hasta) {
    if (await condicion()) return true;
    await espera(250);
  }
  return false;
}

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

/** El nombre del médico: el único que puede firmar una indicación clínica. */
const medico = JSON.parse(
  readFileSync(join(process.cwd(), 'content', 'marca.json'), 'utf8'),
).nombre;

async function abrir(page, slug) {
  soloLaboratorio(slug);
  await page.goto(`${base}/post/${slug}`, { waitUntil: 'networkidle', timeout: 120_000 });
  await page.evaluate(() => document.fonts.ready);
  await espera(1500);
}

/** Abre la tarjeta de un slide por su índice, no por su posición en el panel. */
async function abrirTarjeta(page, indice) {
  const tarjeta = page.locator(`.tarjeta[data-slide="${indice}"]`);
  if ((await tarjeta.getAttribute('open')) === null) {
    await tarjeta.locator('summary .tarjeta__titulo').click();
    await espera(400);
  }
  return tarjeta;
}

/**
 * Que en el puerto esté este editor y no otra cosa.
 *
 * Sin esto, apuntar al puerto equivocado no falla de forma legible: las
 * primeras comprobaciones "pasan" —contar un botón que no existe devuelve
 * cero— y el error aparece treinta segundos después, como un timeout de
 * Playwright que parece un fallo del editor. Costó media hora una vez.
 */
async function comprobarServidor() {
  let ultimo = '';
  const responde = async () => {
    try {
      ultimo = await (await fetch(`${base}/post/${EDICION}`)).text();
      return ultimo.includes('data-ficha');
    } catch {
      ultimo = '';
      return false;
    }
  };

  // Con reintentos: en desarrollo la primera petición a una ruta la compila, y
  // mientras tanto Next devuelve un armazón vacío que no lleva `data-ficha`.
  // Sin esperar, el guardia acusaba de puerto equivocado a un servidor que solo
  // estaba arrancando.
  if (await esperarA(responde, 90_000)) return;

  console.error(
    ultimo
      ? `\nALTO: lo que responde en ${base} no es el editor de este proyecto.`
      : `\nALTO: no hay servidor en ${base}. Arranca "npm run dev".`,
  );
  console.error('El puerto va como argumento: npm run pruebas 3001');
  process.exit(1);
}

const slugs = await reiniciarLaboratorio();
console.log(`Laboratorio reiniciado: ${slugs.join(', ')}`);
await espera(1200);
await comprobarServidor();

const navegador = await chromium.launch();
const page = await navegador.newPage({ viewport: { width: 1600, height: 1000 } });

/* ── guardado automático ─────────────────────────────────────────────────── */
console.log('\nGuardado automático');
await abrir(page, EDICION);
ok((await page.locator('button:has-text("Guardar")').count()) === 0, 'no hay botón de guardar');
const temaAntes = leer(EDICION).tema;
await page.locator('[data-ficha] input').first().fill(`${temaAntes} ·`);
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
await esperarA(() => leer(EDICION).slides[1].visual.src !== srcAntes);
const src = leer(EDICION).slides[1].visual.src;
ok(src !== srcAntes, `la imagen cambió a ${src}`);
ok(/foto-arrastrada-nandu-[a-z0-9]+\.jpg$/.test(src), 'con el nombre normalizado');
ok(
  (await page.locator('.marco--soltable').last().getAttribute('data-soltando')) === null,
  'el cierre no acepta imagen',
);
// Cambiar la foto no borra lo que la foto debería mostrar: soltarla es el
// gesto de intentar cumplir esa idea, no de renunciar a ella.
ok(
  leer(EDICION).slides[1].visual.ideaImagen !== undefined,
  'y la idea de imagen sobrevive al cambio de foto',
);

/* ── la idea de imagen, junto a la imagen ────────────────────────────────── */
console.log('\nIdea de imagen y crédito');

// El campo existía y no lo veía nadie: por eso se publicó un slide con la foto
// de un gimnasio. Tiene que estar donde se mira el carrusel, no dentro de una
// tarjeta plegada.
const banda = page.locator('.marco--soltable').nth(1).locator('.idea');
ok((await banda.count()) === 1, 'el slide con foto lleva la idea de imagen debajo');
ok(
  (await banda.innerText()).includes(leer(EDICION).slides[1].visual.ideaImagen),
  'y dice lo que la foto debería mostrar',
);
ok(
  (await page.locator('.marco--soltable').nth(2).locator('.idea').count()) === 0,
  'el slide con ícono no la lleva',
);
ok(
  /sin fuente ni licencia/.test(await banda.innerText()),
  'y avisa de que la foto no tiene procedencia registrada',
);

const tarjetaFoto = await abrirTarjeta(page, 1);
// Media procedencia no se guarda: un crédito a medias parece registrado y no
// dice de dónde salió la foto.
await tarjetaFoto.locator('input[placeholder*="Unsplash,"]').fill('Unsplash');
await espera(1200);
ok(leer(EDICION).slides[1].visual.credito === undefined, 'con solo la fuente no se guarda nada');
await tarjetaFoto.locator('input[placeholder*="Unsplash License"]').fill('Unsplash License');
await esperarA(() => leer(EDICION).slides[1].visual.credito !== undefined);
const credito = leer(EDICION).slides[1].visual.credito ?? {};
ok(
  credito.fuente === 'Unsplash' && credito.licencia === 'Unsplash License',
  `con las dos sí: ${JSON.stringify(credito)}`,
);
ok(
  !/sin fuente ni licencia/.test(await banda.innerText()),
  'y la banda deja de avisar',
);

// Y al revés: cambiar la foto tira el crédito, porque describía a la anterior.
// Un crédito heredado es peor que ninguno: parece registrado y miente.
await slide01.dispatchEvent('drop', { dataTransfer: dt });
await esperarA(() => leer(EDICION).slides[1].visual.credito === undefined);
ok(
  leer(EDICION).slides[1].visual.credito === undefined,
  'cambiar la foto borra el crédito de la anterior',
);
ok(
  leer(EDICION).slides[1].visual.ideaImagen !== undefined,
  'pero no la idea de imagen',
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
await esperarA(() => leer(EDICION).slides[2].visual.slug === 'termometro');
ok(leer(EDICION).slides[2].visual.slug === 'termometro', 'el ícono elegido se guarda');

/* ── paletas ─────────────────────────────────────────────────────────────── */
console.log('\nPaletas');
await abrir(page, PALETAS);
const selector = page.locator('[data-ficha] select').nth(1);
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

// Se comprueba que esté, no que sea el único: la librería crece —cada ícono
// generado entra en ella— y una lista exacta convertiría cualquier ícono nuevo
// en un fallo de esta prueba, que no mide eso.
ok((await flojosDe('azul')).includes('informacion'), 'sobre azul se funde informacion');
ok((await fondoDe()) === 'rgb(81, 162, 255)', 'y el fondo es el azul');
const flojosNaranja = await flojosDe('naranja');
ok(
  ['alerta', 'correr', 'silencio'].every((i) => flojosNaranja.includes(i)),
  'sobre naranja se funden alerta, correr y silencio',
);
ok((await fondoDe()) === 'rgb(237, 132, 47)', 'y el fondo es el naranja');
ok((await flojosDe('verde')).includes('palomita-verde'), 'sobre verde, la palomita');
ok(leer(PALETAS).paleta === 'verde', 'la paleta se guarda en el JSON');

const velo = await page
  .locator('.slide__velo')
  .first()
  .evaluate((e) => getComputedStyle(e).backgroundImage);
ok(velo.includes('72, 180, 93'), 'el velo de la portada sigue a la paleta');

/* ── cola de afirmaciones ────────────────────────────────────────────────── */
console.log('\nCola de afirmaciones');

await abrir(page, EDICION);
ok((await page.locator('[data-cola]').count()) === 1, 'la cola aparece en el panel');
const sinRevisarAntes = await page.locator('.afirmacion:not([data-revisada])').count();
ok(sinRevisarAntes > 0, `${sinRevisarAntes} afirmaciones sin revisar`);
ok(
  (await page.locator('button:has-text("aprobar todo"), button:has-text("Aprobar todo")').count()) === 0,
  'no hay botón de aprobar todo',
);

const estado = page.locator('[data-ficha] select').first();
ok(
  await estado.locator('option[value="aprobado"]').isDisabled(),
  'con afirmaciones pendientes no se puede marcar como aprobado',
);

// La primera del laboratorio no lleva cifra: el enlace es opcional.
const primera = page.locator('[data-cola] .afirmacion').first();
ok(
  /opcional/.test(await primera.locator('label').first().innerText()),
  'sin cifra, el enlace es opcional',
);

// Nadie firma sin decir quién es. El nombre se escribe: antes se heredaba de
// la marca, y entonces cualquiera que pulsara "la revisé" firmaba como el
// médico. En una indicación clínica eso es peor que no tener firma.
ok(
  await primera.locator('button').last().isDisabled(),
  'sin nombre de revisor no se puede firmar',
);
await page.locator('[data-cola] > .tarjeta__cuerpo > input').fill('Quien Revisa');
await espera(300);

// Y las de seguridad solo las firma el médico: son criterio clínico, no un
// dato que se compruebe abriendo una fuente.
const deSeguridad = page.locator('[data-cola] .afirmacion', {
  has: page.locator('.chip[data-disparador="seguridad"]'),
});
ok((await deSeguridad.count()) === 1, 'hay una afirmación de seguridad en el laboratorio');
const botonSeguridad = deSeguridad.locator('button').last();
ok(await botonSeguridad.isDisabled(), 'y otro revisor no la puede firmar');
ok(
  (await botonSeguridad.innerText()).includes(medico),
  `el botón dice quién la firma: "${await botonSeguridad.innerText()}"`,
);

await primera.locator('button:has-text("la revisé")').click();
await esperarA(() => Object.keys(leer(EDICION).revisiones ?? {}).length > 0);
ok(
  (await page.locator('.afirmacion[data-revisada]').count()) === 1,
  'queda marcada como revisada',
);
const guardadas = leer(EDICION).revisiones ?? {};
const unaRevision = Object.values(guardadas)[0] ?? {};
ok(Object.keys(guardadas).length === 1, 'y se guarda en el JSON, por huella');
ok(
  unaRevision.revisadaPor && unaRevision.fecha && unaRevision.texto && !('estado' in unaRevision),
  `guarda quién y cuándo, no un "verificada": ${JSON.stringify(unaRevision).slice(0, 90)}`,
);
ok(
  unaRevision.revisadaPor === 'Quien Revisa',
  `firma quien revisó, no el médico: "${unaRevision.revisadaPor}"`,
);

// Cambiar el texto revisado la devuelve a la cola: es lo que sostiene todo.
const tarjetaTexto = await abrirTarjeta(page, 1);
await tarjetaTexto.locator('textarea').first().fill('Un slide **con foto** y una coma,');
await espera(1800);
ok(
  (await page.locator('.afirmacion[data-revisada]').count()) === 1,
  'la revisión de otro bloque sigue en pie',
);

/* ── buscar la foto en el banco ──────────────────────────────────────────── */
console.log('\nBanco de imágenes');

// El banco de laboratorio devuelve una muestra real de Pexels guardada en
// disco y "baja" un archivo local, así que esto recorre las dos etapas y la
// descarga sin una sola llamada a la red.
await abrir(page, EDICION);
const tarjetaBanco = await abrirTarjeta(page, 1);
const ideaAntes = leer(EDICION).slides[1].visual.ideaImagen;

// Un solo gesto: busca, aparta y pone la mejor. Elegir entre veinticuatro
// fotos de aula es preferencia, y cambiarla después cuesta un clic.
await tarjetaBanco.locator('button:has-text("Buscar foto en el banco")').click();
await esperarA(() => leer(EDICION).slides[1].visual.credito?.fuente === 'Pexels');
ok(
  leer(EDICION).slides[1].visual.credito?.fuente === 'Pexels',
  'un solo clic busca y deja la foto puesta',
);
ok(
  (await tarjetaBanco.locator('input').first().inputValue()).length > 0,
  'y la consulta queda editable, para volver a buscar sin gastar modelo',
);
ok(
  (await tarjetaBanco.locator('button:has-text("ver las otras")').count()) === 1,
  'las otras están a un clic, pero no estorban',
);

// La regresión del gimnasio: aquel slide se publicó con la foto de un gimnasio
// porque encajaba con "niños juntos". Con el descarte puesto, se aparta.
const verApartadas = tarjetaBanco.locator('button:has-text("apartadas")');
ok((await verApartadas.count()) === 1, 'hay fotos apartadas por el descarte');
ok(/1 apartada/.test(await verApartadas.innerText()), 'exactamente una: el gimnasio');
await verApartadas.click();
await espera(400);
const apartada = tarjetaBanco.locator('.foto-opcion[data-apartada]');
ok((await apartada.count()) === 1, 'y se enseña, no se esconde');
ok(
  /gym/.test(await apartada.innerText()),
  `diciendo por qué se apartó: "${(await apartada.innerText()).trim()}"`,
);

const dePexels = leer(EDICION).slides[1].visual;
ok(dePexels.src.includes('/media/laboratorio-edicion/pexels-'), `se descargó a ${dePexels.src}`);
ok(dePexels.credito?.fuente === 'Pexels', 'con la fuente escrita');
ok(dePexels.credito?.licencia === 'Pexels License', 'y la licencia');
ok(
  dePexels.credito?.licenciaUrl === 'https://www.pexels.com/license/',
  'con el enlace al texto de la licencia, para no tener que creérsela',
);
ok(Boolean(dePexels.credito?.autor), `y el autor: ${dePexels.credito?.autor}`);
ok(Boolean(dePexels.credito?.url), 'y el enlace a la foto original');
ok(dePexels.ideaImagen === ideaAntes, 'la idea de imagen sobrevive a la foto del banco');

// El punto de toda la fase: descargar y acreditar son un solo movimiento, así
// que la banda del lienzo deja de avisar sin que nadie escriba un campo.
ok(
  !/sin fuente ni licencia/.test(
    await page.locator('.marco--soltable').nth(1).locator('.idea').innerText(),
  ),
  'y la banda del lienzo ya no avisa: nadie llenó el crédito a mano',
);

/* ── la portada también busca en el banco ────────────────────────────────── */
console.log('\nLa foto de la portada');

// Era el único slide sin buscador: su foto había que arrastrarla a mano, y es
// la que más se ve del carrusel.
const tarjetaPortada = await abrirTarjeta(page, 0);
const bancoPortada = tarjetaPortada.locator('.banco');
ok((await bancoPortada.count()) === 1, 'la portada tiene el buscador de banco');

const fotoAntes = leer(EDICION).slides[0].foto;
await bancoPortada.locator('button:has-text("Buscar foto en el banco")').click();
await esperarA(() => leer(EDICION).slides[0].fotoCredito !== undefined);

const portada = leer(EDICION).slides[0];
ok(portada.foto !== fotoAntes, `la foto de portada cambió a ${portada.foto?.split('/').pop()}`);
ok(portada.fotoCredito?.fuente === 'Pexels', 'con su fuente');
ok(Boolean(portada.fotoCredito?.autor), `y su autor: ${portada.fotoCredito?.autor}`);
ok(
  portada.foto?.startsWith('/media/laboratorio-edicion/'),
  'guardada en la carpeta del post, no enlazada',
);

/* ── el archivo clínico ──────────────────────────────────────────────────── */
console.log('\nArchivo clínico');

const tarjetaClinica = await abrirTarjeta(page, 1);
const panelClinico = tarjetaClinica.locator('.clinico');
await panelClinico.locator('button:has-text("Archivo clínico")').click();
await esperarA(async () => (await panelClinico.locator('.foto-opcion').count()) > 0);

// La muestra de laboratorio trae una CC BY-NC-ND —la de DermNet— y seis
// CC BY-SA. Ninguna de las siete puede entrar, y el panel lo dice contándolas.
ok((await panelClinico.locator('.foto-opcion').count()) > 0, 'el archivo devuelve candidatos');
ok(
  /7 imágenes quedaron fuera por su licencia/.test(await panelClinico.innerText()),
  'y las que no se pueden usar salen contadas, no escondidas',
);

await panelClinico.locator('.foto-opcion').first().click();
await espera(300);
const firma = panelClinico.locator('.clinico__firma');
ok((await firma.count()) === 1, 'al elegir una, pide la firma');

// El sistema propone; el médico inserta. Sin su nombre no hay botón.
const botonFirmar = firma.locator('button:has-text("firma"), button:has-text("Aprobar")');
ok(await botonFirmar.isDisabled(), 'sin el nombre del médico no se puede aprobar');
ok(
  (await botonFirmar.innerText()).includes(medico),
  `el botón dice quién firma: "${await botonFirmar.innerText()}"`,
);

// Y el servidor lo comprueba también, no solo el botón: lo que se escribe en el
// JSON es la firma de alguien con cédula.
const conOtroNombre = await (
  await fetch(`${base}/api/fotos/aprobar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      slug: soloLaboratorio(EDICION),
      candidato: { id: 'x', descarga: 'https://ejemplo.test/x.jpg', credito: { fuente: 'a', licencia: 'b' } },
      aprobadaPor: 'Quien Revisa',
    }),
  })
).json();
ok(
  /solo la puede aprobar/.test(conOtroNombre.error ?? ''),
  'y el servidor rechaza otra firma aunque el botón se saltara',
);

await firma.locator('input').first().fill(medico);
await espera(200);
ok(!(await botonFirmar.isDisabled()), 'con su nombre, sí');
await botonFirmar.click();
await esperarA(() => leer(EDICION).slides[1].visual.aprobacion !== undefined);

const clinica = leer(EDICION).slides[1].visual;
ok(clinica.clinica === true, 'la foto queda marcada como clínica');
ok(clinica.aprobacion?.aprobadaPor === medico, `firmada por ${clinica.aprobacion?.aprobadaPor}`);
ok(Boolean(clinica.aprobacion?.fecha), `con fecha ${clinica.aprobacion?.fecha}`);
ok(
  (clinica.aprobacion?.huella ?? '').length === 32,
  'y la huella de los bytes de la imagen, no de la ruta',
);
ok(clinica.credito?.fuente === 'Wikimedia Commons', 'con su crédito del archivo');

// Lo que sostiene la firma: si el archivo cambia, se cae. Se simula mandando el
// post con la huella cambiada, que es lo que pasaría si alguien sustituyera el
// JPEG por otro con el mismo nombre.
const conHuellaVieja = conTodoRevisado('aprobado');
conHuellaVieja.slides[1].visual.aprobacion.huella = 'huelladeotracosa'.padEnd(32, '0');
for (const slide of conHuellaVieja.slides) {
  const credito = { fuente: 'Consultorio', licencia: 'propia' };
  if (slide.tipo === 'portada' && slide.foto) slide.fotoCredito = credito;
}
const caida = await guardar(conHuellaVieja);
ok(caida.estado === 400, 'con la imagen cambiada, el carrusel no se aprueba');
ok(
  /cambió después de que/.test(caida.cuerpo.error ?? ''),
  `y lo dice: "${(caida.cuerpo.error ?? '').split('\n').pop()?.trim()}"`,
);

/* ── la barrera de licencia ──────────────────────────────────────────────── */
console.log('\nBarrera de licencia');

/** El post de laboratorio con todo revisado, para aislar la barrera de fotos. */
function conTodoRevisado(estado) {
  const post = leer(EDICION);
  post.estado = estado;
  post.revisiones = Object.fromEntries(
    afirmacionesDe(post).map((a) => [
      a.huella,
      {
        revisadaPor: medico,
        fecha: '2026-01-01',
        texto: a.texto,
        ...(a.exigeEnlace ? { enlace: 'https://ejemplo.test/fuente' } : {}),
      },
    ]),
  );
  return post;
}

// Declaración y no `const`: se usa desde la sección del archivo clínico, que
// va antes en el archivo, y una función declarada se iza.
async function guardar(post) {
  soloLaboratorio(post.slug);
  const r = await fetch(`${base}/api/post`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ post }),
  });
  return { estado: r.status, cuerpo: await r.json() };
}

const comoBorrador = await guardar(conTodoRevisado('borrador'));
ok(comoBorrador.estado === 200, 'como borrador se guarda aunque falte la licencia');

// La condición se monta aquí y no se hereda de las secciones de arriba: antes
// dependía de que quedara alguna foto sin acreditar por casualidad, y el día
// que el buscador de portada las acreditó todas, esta prueba pasó a medir otra
// cosa sin que nadie lo pidiera.
const aMedias = conTodoRevisado('aprobado');
delete aMedias.slides[0].fotoCredito;

const sinLicencia = await guardar(aMedias);
ok(sinLicencia.estado === 400, 'como aprobado, no');
ok(
  /sin fuente ni licencia/.test(sinLicencia.cuerpo.error ?? ''),
  `y dice por qué: ${(sinLicencia.cuerpo.error ?? '').split('\n')[1]?.trim()}`,
);
ok(
  leer(EDICION).estado === 'borrador',
  'el archivo en disco no cambió de estado',
);

// Y con la procedencia puesta, sí. Una barrera que no deja pasar nada tampoco
// sirve: lo que tiene que impedir es publicar sin saber de dónde salió la foto.
const conLicencia = conTodoRevisado('aprobado');
for (const slide of conLicencia.slides) {
  // Se rellena solo lo que falta. La foto clínica de la sección anterior ya
  // trae el suyo de Wikimedia Commons, y pisarlo con "Consultorio" le pediría
  // además la referencia del consentimiento: sería probar otra cosa.
  const credito = { fuente: 'Banco de prueba', licencia: 'de prueba' };
  if (slide.tipo === 'portada' && slide.foto && !slide.fotoCredito) slide.fotoCredito = credito;
  if (slide.visual?.clase === 'foto' && !slide.visual.credito) slide.visual.credito = credito;
}
const conTodo = await guardar(conLicencia);
ok(conTodo.estado === 200, 'con la procedencia registrada sí se aprueba');
ok(leer(EDICION).estado === 'aprobado', 'y el archivo lo refleja');

/* ── que el laboratorio siga siendo laboratorio ──────────────────────────── */
console.log('\nEl guardia');
ok(leer('impetigo-regreso-a-clases').slides.length === 7, 'el post publicado sigue con sus 7 slides');
ok(leer('impetigo-regreso-a-clases').paleta === 'azul', 'y en azul');

await navegador.close();
console.log(fallos === 0 ? '\nTodo en pie.' : `\n${fallos} pruebas fallaron.`);
if (fallos > 0) process.exitCode = 1;
