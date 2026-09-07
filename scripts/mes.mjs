/**
 * scripts/mes.mjs — `npm run mes [cuantos] [puerto] [--temas]`
 *
 * El mes entero de una, en borradores.
 *
 * ── Por qué es un script y no un botón ──────────────────────────────────────
 * Ocho carruseles son unos veinte minutos. Eso no cabe en una petición del
 * navegador —la ruta se corta a los cinco— ni en una pestaña que hay que dejar
 * abierta, y sobre todo no debe caber: si a la mitad falla el séptimo, lo que
 * uno quiere es que los seis anteriores estén en disco y volver a correrlo, no
 * empezar de nuevo. Un script que escribe archivo por archivo es exactamente
 * eso, y le sale gratis: **volver a correrlo salta lo que ya existe**.
 *
 * ── Por qué habla por HTTP con el servidor de dev ───────────────────────────
 * En vez de importar `lib/redactar.ts`. Así la tanda corre *literalmente* el
 * mismo camino que el botón del panel —la misma ruta, el mismo prompt, la
 * misma descarga de fotos, la misma generación de íconos— y no una copia que
 * se va separando sola. Si el panel mejora, la tanda mejora.
 *
 * ── Lo que esto NO hace ─────────────────────────────────────────────────────
 * No afloja ninguna barrera y no ahorra ni una revisión. Todo sale en
 * `borrador`, la cola de afirmaciones queda entera y las fotos clínicas siguen
 * sin poder entrar por aquí. Lo único que se hace en tanda es **escribir**, que
 * es la parte lenta y la que no decide nada. Revisar sigue siendo de uno en
 * uno, y al final se dice cuántas afirmaciones acaban de entrar a la cola —
 * que es el costo de verdad de generar un mes de golpe.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afirmacionesDe } from '../lib/afirmaciones.ts';
import { aSlug } from '../lib/slug.ts';
import { revisarTanda } from '../lib/mes.ts';

const POSTS = join(process.cwd(), 'content', 'posts');

/* ── los argumentos ──────────────────────────────────────────────────────── */

const args = process.argv.slice(2);
const soloTemas = args.includes('--temas');
const numeros = args.filter((a) => /^\d+$/.test(a)).map(Number);

/**
 * Ocho por defecto: dos por semana, que es el ritmo de la cuenta.
 *
 * Es un número para empezar, no un dogma — `npm run mes -- 12` y ya. El techo
 * de veinte está en `lib/proponer.ts` y lo hace cumplir el servidor.
 *
 * Los dos argumentos se distinguen por el tamaño, que es cómodo y por eso mismo
 * puede engañar: un `25` es una cantidad imposible, no un puerto, y tomarlo
 * como "ocho, que es el defecto" sería escribir ocho carruseles cuando alguien
 * pidió veinticinco y no enterarse. Se para aquí.
 */
const sueltos = numeros.filter((n) => (n > 20 && n < 1000) || n === 0);
if (sueltos.length) {
  console.error(
    `\nALTO: ${sueltos[0]} no es una cantidad (van de 1 a 20) ni un puerto.`,
  );
  console.error('Van así: npm run mes -- [cuantos] [puerto]   ·   npm run mes -- 8 3001');
  process.exit(1);
}

const cuantos = numeros.find((n) => n <= 20) ?? 8;
const puerto = numeros.find((n) => n >= 1000) ?? 3000;
const base = `http://localhost:${puerto}`;

/* ── utilidades ──────────────────────────────────────────────────────────── */

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const reloj = (s) => (s < 60 ? `${Math.round(s)}s` : `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`);

async function pedir(ruta, cuerpo) {
  const r = await fetch(`${base}${ruta}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo ?? {}),
  });
  const salida = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(salida.error ?? `${ruta} respondió ${r.status}`);
  return salida;
}

/**
 * Que en el puerto esté este editor y no otra cosa.
 *
 * La misma precaución que en `scripts/pruebas.mjs` y por lo mismo: apuntar al
 * puerto equivocado no falla de forma legible. Aquí se hace preguntándole a la
 * ruta de redactar con un cuerpo vacío, que responde 400 con su propio texto
 * y **no gasta una llamada al modelo**. Con reintentos, porque en desarrollo
 * la primera petición a una ruta la compila.
 */
async function comprobarServidor() {
  const hasta = Date.now() + 90_000;
  let ultimo = '';
  while (Date.now() < hasta) {
    try {
      const r = await fetch(`${base}/api/redactar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const cuerpo = await r.json().catch(() => ({}));
      ultimo = cuerpo.error ?? '';
      if (r.status === 400 && /tema del carrusel/.test(ultimo)) return;
      // 500 con la llave ausente es un servidor correcto mal configurado: se
      // dice tal cual, que es más útil que "no es este editor".
      if (r.status === 500 && /ANTHROPIC_API_KEY/.test(ultimo)) {
        console.error(`\nALTO: ${ultimo}`);
        process.exit(1);
      }
    } catch {
      ultimo = '';
    }
    await espera(1500);
  }

  console.error(
    ultimo
      ? `\nALTO: lo que responde en ${base} no es el editor de este proyecto.`
      : `\nALTO: no hay servidor en ${base}. Arranca "npm run dev".`,
  );
  console.error('El puerto va como argumento: npm run mes 8 3001');
  process.exit(1);
}

/* ── lo que ya hay ───────────────────────────────────────────────────────── */

function loQueYaHay() {
  const archivos = readdirSync(POSTS).filter((f) => f.endsWith('.json'));
  const posts = archivos.map((f) => JSON.parse(readFileSync(join(POSTS, f), 'utf8')));
  return {
    slugs: new Set(posts.map((p) => p.slug)),
    // Los de laboratorio son andamio de las pruebas, no contenido de la cuenta.
    temas: posts.filter((p) => !p.slug.startsWith('laboratorio-')).map((p) => p.tema),
  };
}

/* ── la tanda ────────────────────────────────────────────────────────────── */

await comprobarServidor();

const yaHay = loQueYaHay();
console.log(`\nHay ${yaHay.temas.length} carrusel(es) de la cuenta. Pidiendo ${cuantos} temas…`);

const arranque = Date.now();
const { contexto, propuestas } = await pedir('/api/proponer', { cuantos });
console.log(`Temas de ${contexto.mes}, en ${reloj((Date.now() - arranque) / 1000)}:\n`);

/**
 * Los repetidos se miran **antes** del bucle caro, no después.
 *
 * Es lo único que se puede saber gratis y lo que más caro sale saber tarde: dos
 * temas gemelos son dos llamadas largas, dos carpetas de fotos y dos revisiones
 * enteras para publicar uno.
 *
 * Solo se tira lo que es el mismo título reordenado. Lo que se parece pero
 * podría ser otro carrusel se escribe y se dice contra qué, porque cuál de los
 * dos sobra es criterio editorial y no de un umbral. Ver lib/mes.ts.
 */
const choques = revisarTanda(
  propuestas.map((p) => p.tema),
  yaHay.temas,
);
const tirados = new Set(choques.filter((c) => c.accion === 'tirar').map((c) => c.indice));

for (const [i, p] of propuestas.entries()) {
  const choque = choques.find((c) => c.indice === i);
  const cuanto = choque ? `${choque.donde}, ${Math.round(choque.parecido * 100)} %` : '';
  if (choque?.accion === 'tirar') {
    console.log(`  ✗  ${p.tema}\n      repite «${choque.contra}» (${cuanto})`);
  } else {
    console.log(`  ${String(i + 1).padStart(2)}. ${p.tema}\n      ${p.paleta} · ${p.porQueAhora}`);
    if (choque) console.log(`      ⚠ se parece a «${choque.contra}» (${cuanto}) — míralo al revisar`);
  }
}

const cola = propuestas.filter((_, i) => !tirados.has(i));
const dudosos = choques.filter((c) => c.accion === 'avisar');
if (tirados.size) console.log(`\n${tirados.size} tirado(s) por repetido. Quedan ${cola.length}.`);
if (dudosos.length) console.log(`${dudosos.length} se escriben pero se parecen a algo. Van marcados arriba.`);

if (soloTemas) {
  console.log('\n--temas: hasta aquí. Quita la bandera para escribirlos.');
  process.exit(0);
}

console.log(
  `\nEscribiendo ${cola.length} carrusel(es). Unos dos minutos y medio cada uno, ` +
    `así que calcula ${reloj(cola.length * 155)}. Se puede dejar solo.\n`,
);

/**
 * Uno a uno, y a propósito.
 *
 * En paralelo se ganaría mucho tiempo y se rompería la librería de íconos: cada
 * ícono generado entra en `public/iconos/manifest.json`, y dos carruseles a la
 * vez que pidan "stethoscope" lo generarían dos veces y una escritura se
 * comería a la otra. La tanda se deja corriendo; el tiempo no es el problema.
 */
const usadas = [];
const hechos = [];
const fallidos = [];
let saltados = 0;

for (const [i, propuesta] of cola.entries()) {
  const n = `[${i + 1}/${cola.length}]`;
  const slug = aSlug(propuesta.tema);

  // Nunca se sobrescribe. Es lo que hace que volver a correr el script después
  // de un fallo continúe en vez de empezar de cero, y lo que impide que una
  // tanda pise un borrador que alguien ya estaba revisando.
  if (yaHay.slugs.has(slug) || existsSync(join(POSTS, `${slug}.json`))) {
    console.log(`${n} ya existe "${slug}", se salta.`);
    saltados++;
    continue;
  }

  const desde = Date.now();
  try {
    const r = await pedir('/api/redactar', { tema: propuesta.tema, slug, usadas });
    // `?? []` y no a secas: si el servidor lleva levantado desde antes de que
    // la ruta devolviera este campo, lo que se pierde es el reparto de fotos,
    // que no vale tirar el carrusel entero por él.
    usadas.splice(0, usadas.length, ...(r.usadas ?? usadas));

    // El estado no se toca: sale `borrador` de la ruta y así se guarda. Entre
    // lo que escribe el modelo y un PNG hay una persona, también en tanda.
    await pedir('/api/post', { post: r.post });
    yaHay.slugs.add(slug);

    const afirmaciones = afirmacionesDe(r.post);
    const seguridad = afirmaciones.filter((a) => a.disparadores.includes('seguridad'));
    hechos.push({ slug, post: r.post, afirmaciones, seguridad, uso: r.uso, avisos: r.avisos });

    console.log(
      `${n} ${slug}\n` +
        `      ${r.post.paleta} · ${afirmaciones.length} afirmación(es) por revisar` +
        `${seguridad.length ? `, ${seguridad.length} de seguridad` : ''}` +
        ` · ${reloj((Date.now() - desde) / 1000)}`,
    );
    for (const aviso of r.avisos) console.log(`      · ${aviso}`);
  } catch (e) {
    // Un carrusel que falla no se lleva la tanda: el siguiente sigue, y el que
    // falló se recupera volviendo a correr el script.
    fallidos.push({ tema: propuesta.tema, porque: e.message });
    console.log(`${n} FALLÓ "${propuesta.tema}"\n      ${e.message}`);
  }
}

/* ── lo que quedó ────────────────────────────────────────────────────────── */

const minutos = reloj((Date.now() - arranque) / 1000);
console.log(`\n${'─'.repeat(60)}\n${hechos.length} borrador(es) en ${minutos}.`);
if (saltados) console.log(`${saltados} saltado(s) porque ya existían.`);
if (fallidos.length) {
  console.log(`\n${fallidos.length} sin escribir — vuelve a correr el script y lo reintenta:`);
  for (const f of fallidos) console.log(`  · ${f.tema}\n    ${f.porque}`);
  // Sale con error aunque haya escrito algunos. Una tanda a medias que devuelve
  // cero se ve igual que una completa desde fuera, y esto se va a correr desde
  // la terminal a las once de la noche mirando otra cosa.
  process.exitCode = 1;
}

if (hechos.length) {
  // La cuadrícula del perfil se ve de un vistazo, así que la repartición de
  // paletas es información y no un adorno. No se corrige sola: la regla del
  // color manda, y si el mes salió muy azul eso se arregla en el editor.
  const porPaleta = {};
  for (const h of hechos) porPaleta[h.post.paleta] = (porPaleta[h.post.paleta] ?? 0) + 1;
  const reparto = Object.entries(porPaleta).sort((a, b) => b[1] - a[1]);
  console.log(`\nPaletas: ${reparto.map(([p, n]) => `${p} ×${n}`).join(', ')}`);
  // Desde tres. Con uno o dos, "más de la mitad" no dice nada de cómo se va a
  // ver la cuadrícula y el aviso sale siempre.
  if (hechos.length >= 3 && reparto[0][1] > hechos.length / 2) {
    console.log(`  El mes va a verse muy ${reparto[0][0]}. Se cambia en el editor, post por post.`);
  }

  const entrada = hechos.reduce((s, h) => s + (h.uso?.entrada ?? 0), 0);
  const salida = hechos.reduce((s, h) => s + (h.uso?.salida ?? 0), 0);
  console.log(`Tokens: ${entrada.toLocaleString('es')} de entrada, ${salida.toLocaleString('es')} de salida.`);

  // El costo de verdad de generar un mes de golpe no es el dinero, es esto.
  const total = hechos.reduce((s, h) => s + h.afirmaciones.length, 0);
  const seguridad = hechos.reduce((s, h) => s + h.seguridad.length, 0);
  console.log(
    `\nLa cola quedó con ${total} afirmación(es) por revisar en ${hechos.length} carrusel(es).` +
      (seguridad
        ? `\n${seguridad} son indicaciones de seguridad: esas las firma el doctor, no tú.`
        : ''),
  );
  console.log('Ninguno se puede pasar de borrador hasta que estén revisadas.');
  console.log(`\nA revisar: ${base}`);
}
