/**
 * scripts/mes.mjs — `npm run mes -- [opciones]`
 *
 * Los carruseles que faltan, escritos de una tanda.
 *
 * Es el mes de **una** cuenta. Con varios proyectos se dice cuál:
 * `npm run mes -- --proyecto dra-mildreth`. Con uno solo no hace falta.
 *
 * ── Dos modos, y el del calendario es el bueno ──────────────────────────────
 * Si hay `proyectos/<id>/calendario.tsv`, los temas salen de ahí: ya están decididos,
 * con su fecha, su pilar, su objetivo y su nota. Si no lo hay, el modelo
 * propone la tanda del mes, que es lo que servía antes de tener calendario.
 *
 * La diferencia no es de comodidad. Con calendario, el pilar y el objetivo
 * **los pusiste tú**, y el redactor los recibe en vez de inventárselos: el
 * objetivo decide a cuál de los cierres del copy se le carga la mano, así que
 * un carrusel que la hoja marca "agendar" y el modelo escribe para "guardar"
 * sale con el cierre equivocado y nadie lo nota leyéndolo suelto.
 *
 * ── Por qué es un script y no un botón ──────────────────────────────────────
 * Nueve carruseles son casi media hora. Eso no cabe en una petición del
 * navegador —la ruta se corta a los cinco minutos— y sobre todo no debe caber:
 * si a la mitad falla el séptimo, lo que uno quiere es que los seis anteriores
 * estén en disco y volver a correrlo. Un script que escribe archivo por archivo
 * es eso, y le sale gratis: **volver a correrlo salta lo que ya existe**.
 *
 * ── Por qué habla por HTTP con el servidor de dev ───────────────────────────
 * En vez de importar `lib/redactar.ts`. Así la tanda corre *literalmente* el
 * mismo camino que el botón del panel y no una copia que se va separando sola.
 *
 * ── Lo que esto NO hace ─────────────────────────────────────────────────────
 * No afloja ninguna barrera y no ahorra ni una revisión. Todo sale en
 * `borrador`, la cola de afirmaciones queda entera y las fotos clínicas siguen
 * sin poder entrar por aquí. Lo único que se hace en tanda es **escribir**, que
 * es la parte lenta y la que no decide nada.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afirmacionesDe } from '../lib/afirmaciones.ts';
import { desde, leerCalendario } from '../lib/calendario.ts';
import { revisarTanda, yaEscrito } from '../lib/mes.ts';
import { proyectoDeArgumentos, rutasDe, sinProyecto } from '../lib/proyecto.ts';
import { aSlug } from '../lib/slug.ts';

/* ── los argumentos ──────────────────────────────────────────────────────── */

/*
 * De qué cuenta es el mes. Con un solo proyecto no hace falta decirlo; con
 * varios, el script se niega a adivinar, porque escribir el mes de una cuenta
 * en la carpeta de otra es justo el error que no avisa.
 */
let proyecto;
try {
  proyecto = proyectoDeArgumentos(process.argv);
} catch (e) {
  console.error(`\nALTO: ${e.message}`);
  console.error('Van así: npm run mes -- --proyecto <id> [cuantos] [puerto] [--desde X] [--plan]');
  process.exit(1);
}
const RUTAS = rutasDe(proyecto);
const POSTS = RUTAS.posts;
const API = `/api/${proyecto}`;

const args = sinProyecto(process.argv.slice(2));
const soloPlan = args.includes('--temas') || args.includes('--plan');
const iDesde = args.findIndex((a) => a === '--desde');
const marcaDesde = iDesde !== -1 ? (args[iDesde + 1] ?? '') : '';
// El `iDesde !== -1` no sobra: sin `--desde`, `iDesde + 1` es 0 y el filtro se
// comía el primer argumento — `npm run mes -- 3001` acababa buscando el
// servidor en el 3000. El valor de `--desde` puede ser un número (`--desde 4`)
// y por eso hay que excluirlo, pero solo cuando la bandera está.
const numeros = args
  .filter((a, i) => /^\d+$/.test(a) && !(iDesde !== -1 && i === iDesde + 1))
  .map(Number);

/**
 * Los dos números se distinguen por el tamaño, que es cómodo y por eso mismo
 * puede engañar: un `25` es una cantidad imposible, no un puerto, y tomarlo
 * como "ocho, que es el defecto" sería escribir ocho carruseles cuando alguien
 * pidió veinticinco y no enterarse.
 */
const sueltos = numeros.filter((n) => (n > 20 && n < 1000) || n === 0);
if (sueltos.length) {
  console.error(`\nALTO: ${sueltos[0]} no es una cantidad (van de 1 a 20) ni un puerto.`);
  console.error('Van así: npm run mes -- [--proyecto <id>] [cuantos] [puerto] [--desde X] [--plan]');
  process.exit(1);
}

/** Solo se usa sin calendario: ocho es el ritmo de dos por semana. */
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
 * puerto equivocado no falla de forma legible. Se le pregunta a la ruta de
 * redactar con un cuerpo vacío, que responde 400 con su propio texto y **no
 * gasta una llamada al modelo**. Con reintentos, porque en desarrollo la
 * primera petición a una ruta la compila.
 */
async function comprobarServidor() {
  const hasta = Date.now() + 90_000;
  let ultimo = '';
  while (Date.now() < hasta) {
    try {
      const r = await fetch(`${base}${API}/redactar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const cuerpo = await r.json().catch(() => ({}));
      ultimo = cuerpo.error ?? '';
      if (r.status === 400 && /tema del carrusel/.test(ultimo)) return;
      // Un 500 por la llave ausente es un servidor correcto mal configurado: se
      // dice tal cual, que es más útil que "no es este editor".
      if (r.status === 500 && /API_KEY/.test(ultimo)) {
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
  console.error('El puerto va como argumento: npm run mes -- 3001');
  process.exit(1);
}

/* ── lo que ya está escrito ──────────────────────────────────────────────── */

function loQueYaHay() {
  const archivos = existsSync(POSTS) ? readdirSync(POSTS).filter((f) => f.endsWith('.json')) : [];
  const posts = archivos.map((f) => JSON.parse(readFileSync(join(POSTS, f), 'utf8')));
  // Los de laboratorio son andamio de las pruebas, no contenido de la cuenta.
  const dela = posts.filter((p) => !p.slug.startsWith('laboratorio-'));
  return {
    slugs: new Set(posts.map((p) => p.slug)),
    temas: dela.map((p) => p.tema),
    /* La forma que espera `yaEscrito`. La decisión de si un tema ya está
       escrito vive en lib/mes.ts y la comparten el script y el panel: es la
       que sostiene "escribe los que faltan", y dos copias que se separaran
       darían dos respuestas distintas a la misma pregunta.

       Van **todos**, laboratorio incluido, y eso es a propósito: excluirlos de
       aquí dejaría que un tema cuyo slug cayera en `laboratorio-edicion` lo
       sobrescribiera. Sus temas —"Laboratorio · paletas"— no pueden parecerse
       a uno de la hoja, así que entrar no cuesta nada. */
    escritos: posts.map((p) => ({ slug: p.slug, tema: p.tema })),
  };
}

/* ── de dónde salen los temas ────────────────────────────────────────────── */

await comprobarServidor();
const yaHay = loQueYaHay();
const arranque = Date.now();

const calendario = [RUTAS.calendario, RUTAS.calendarioAlterno].find(existsSync);

/** Cada entrada: `{ tema, editorial?, linea2 }`. `linea2` es lo que se enseña debajo. */
let cola = [];

if (calendario) {
  console.log(`\nCalendario: ${calendario.replace(process.cwd(), '.')}`);

  const { filas, saltadas } = leerCalendario(readFileSync(calendario, 'utf8'));

  // Lo que la hoja tiene y no se va a escribir se dice siempre. Una fila que
  // desaparece en silencio es un carrusel que nadie echa de menos hasta que
  // llega su fecha. Los reels se resumen; los problemas se listan.
  const reels = saltadas.filter((s) => /reel|sin tema/.test(s.porque));
  const rotas = saltadas.filter((s) => !reels.includes(s));
  console.log(
    `${filas.length} carrusel(es) en la hoja` +
      (reels.length ? `, ${reels.length} fila(s) que no lo son` : ''),
  );
  for (const s of rotas) console.log(`  ⚠ línea ${s.linea} «${s.tema}»: ${s.porque}`);

  let candidatas = filas;
  if (marcaDesde) {
    // Si no se reconoce, se para. Arrancar la hoja entera porque el `--desde`
    // no casó sería escribir doce carruseles que nadie pidió.
    const recorte = desde(filas, marcaDesde);
    if (!recorte) {
      console.error(`\nALTO: no hay ninguna fila que sea "${marcaDesde}".`);
      console.error('Va el número de la hoja o un trozo del tema: --desde 4  ·  --desde colageno');
      process.exit(1);
    }
    candidatas = recorte;
    console.log(`Desde «${candidatas[0].tema}»: ${candidatas.length} en adelante.`);
  }

  for (const f of candidatas) {
    const slug = aSlug(f.tema);
    const hecho = yaEscrito(f.tema, slug, yaHay.escritos);
    if (hecho) {
      console.log(`  ✓ ${f.fecha}  ${f.tema}\n      ya está escrito (${hecho})`);
      continue;
    }
    cola.push({
      tema: f.tema,
      editorial: { pilar: f.pilar, objetivo: f.objetivo ?? undefined, nota: f.nota, fecha: f.fecha },
      linea2: `${f.fecha} · ${f.pilar || 'sin pilar'} · ${f.objetivo ?? 'sin objetivo'}${f.nota ? ` · ${f.nota}` : ''}`,
    });
  }

  console.log(`\nFaltan ${cola.length}:`);
  for (const [i, c] of cola.entries()) {
    console.log(`  ${String(i + 1).padStart(2)}. ${c.tema}\n      ${c.linea2}`);
  }

  // La hoja es la autoridad, así que aquí no se tira nada: si dos filas dicen
  // casi lo mismo se avisa y ya. Suele ser un copiar y pegar en la hoja.
  for (const ch of revisarTanda(cola.map((c) => c.tema), [])) {
    if (ch.accion === 'tirar') {
      console.log(`\n  ⚠ «${ch.tema}» y «${ch.contra}» son el mismo carrusel en la hoja.`);
    }
  }
} else {
  console.log(`\nSin proyectos/${proyecto}/calendario.tsv, así que el modelo propone.`);
  console.log(`Hay ${yaHay.temas.length} carrusel(es) de la cuenta. Pidiendo ${cuantos} temas…`);

  const { contexto, propuestas } = await pedir(`${API}/proponer`, { cuantos });
  console.log(`Temas de ${contexto.mes}, en ${reloj((Date.now() - arranque) / 1000)}:\n`);

  /*
   * Sin calendario, los repetidos se miran antes del bucle caro: es lo único
   * que se puede saber gratis y lo que más caro sale saber tarde. Solo se tira
   * el mismo título reordenado; lo que se parece pero podría ser otro carrusel
   * se escribe y se dice contra qué. Ver lib/mes.ts.
   */
  const choques = revisarTanda(propuestas.map((p) => p.tema), yaHay.temas);
  const tirados = new Set(choques.filter((c) => c.accion === 'tirar').map((c) => c.indice));

  for (const [i, p] of propuestas.entries()) {
    const ch = choques.find((c) => c.indice === i);
    const cuanto = ch ? `${ch.donde}, ${Math.round(ch.parecido * 100)} %` : '';
    if (ch?.accion === 'tirar') {
      console.log(`  ✗  ${p.tema}\n      repite «${ch.contra}» (${cuanto})`);
      continue;
    }
    console.log(`  ${String(i + 1).padStart(2)}. ${p.tema}\n      ${p.paleta} · ${p.porQueAhora}`);
    if (ch) console.log(`      ⚠ se parece a «${ch.contra}» (${cuanto}) — míralo al revisar`);
    cola.push({ tema: p.tema, linea2: `${p.paleta} · ${p.porQueAhora}` });
  }

  if (tirados.size) console.log(`\n${tirados.size} tirado(s) por repetido. Quedan ${cola.length}.`);
}

if (cola.length === 0) {
  console.log('\nNo falta ninguno. Nada que escribir.');
  process.exit(0);
}

if (soloPlan) {
  console.log('\n--plan: hasta aquí. Quita la bandera para escribirlos.');
  process.exit(0);
}

console.log(
  `\nEscribiendo ${cola.length}. Unos dos minutos y medio cada uno, así que calcula ` +
    `${reloj(cola.length * 155)}. Se puede dejar solo — Ctrl-C ahora si no es esto.\n`,
);

/* ── la tanda ────────────────────────────────────────────────────────────── */

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

for (const [i, item] of cola.entries()) {
  const n = `[${i + 1}/${cola.length}]`;
  const slug = aSlug(item.tema);
  const desdeYa = Date.now();

  try {
    const r = await pedir(`${API}/redactar`, {
      tema: item.tema,
      slug,
      usadas,
      ...(item.editorial ? { editorial: item.editorial } : {}),
    });
    // `?? usadas` y no a secas: si el servidor lleva levantado desde antes de
    // que la ruta devolviera este campo, lo que se pierde es el reparto de
    // fotos, y no vale tirar el carrusel entero por eso.
    usadas.splice(0, usadas.length, ...(r.usadas ?? usadas));

    // El estado no se toca: sale `borrador` de la ruta y así se guarda. Entre
    // lo que escribe el modelo y un PNG hay una persona, también en tanda.
    await pedir(`${API}/post`, { post: r.post });
    yaHay.slugs.add(slug);
    yaHay.temas.push(r.post.tema);
    yaHay.escritos.push({ slug, tema: r.post.tema });

    const afirmaciones = afirmacionesDe(r.post);
    const seguridad = afirmaciones.filter((a) => a.disparadores.includes('seguridad'));
    hechos.push({ slug, post: r.post, afirmaciones, seguridad, uso: r.uso });

    console.log(
      `${n} ${slug}\n` +
        `      ${r.post.paleta} · ${afirmaciones.length} afirmación(es) por revisar` +
        `${seguridad.length ? `, ${seguridad.length} de seguridad` : ''}` +
        ` · ${reloj((Date.now() - desdeYa) / 1000)}`,
    );
    for (const aviso of r.avisos) console.log(`      · ${aviso}`);
  } catch (e) {
    // Un carrusel que falla no se lleva la tanda: el siguiente sigue, y el que
    // falló se recupera volviendo a correr el script.
    fallidos.push({ tema: item.tema, porque: e.message });
    console.log(`${n} FALLÓ "${item.tema}"\n      ${e.message}`);
  }
}

/* ── lo que quedó ────────────────────────────────────────────────────────── */

console.log(
  `\n${'─'.repeat(60)}\n${hechos.length} borrador(es) en ${reloj((Date.now() - arranque) / 1000)}.`,
);

if (fallidos.length) {
  console.log(`\n${fallidos.length} sin escribir — vuelve a correr el script y lo reintenta:`);
  for (const f of fallidos) console.log(`  · ${f.tema}\n    ${f.porque}`);
  // Sale con error aunque haya escrito algunos. Una tanda a medias se ve igual
  // que una completa desde fuera, y esto se corre mirando otra cosa.
  process.exitCode = 1;
}

if (hechos.length) {
  // La cuadrícula del perfil se ve de un vistazo, así que el reparto de paletas
  // es información. No se corrige solo: la regla del color manda, y si el mes
  // salió muy azul eso se arregla en el editor.
  const porPaleta = {};
  for (const h of hechos) porPaleta[h.post.paleta] = (porPaleta[h.post.paleta] ?? 0) + 1;
  const reparto = Object.entries(porPaleta).sort((a, b) => b[1] - a[1]);
  console.log(`\nPaletas: ${reparto.map(([p, c]) => `${p} ×${c}`).join(', ')}`);
  if (hechos.length >= 3 && reparto[0][1] > hechos.length / 2) {
    console.log(`  El mes va a verse muy ${reparto[0][0]}. Se cambia en el editor, post por post.`);
  }

  const entrada = hechos.reduce((s, h) => s + (h.uso?.entrada ?? 0), 0);
  const salida = hechos.reduce((s, h) => s + (h.uso?.salida ?? 0), 0);
  console.log(`Tokens: ${entrada.toLocaleString('es')} de entrada, ${salida.toLocaleString('es')} de salida.`);

  // El costo de verdad de escribir un mes de golpe no es el dinero, es esto.
  const total = hechos.reduce((s, h) => s + h.afirmaciones.length, 0);
  const seguridad = hechos.reduce((s, h) => s + h.seguridad.length, 0);
  console.log(
    `\nLa cola quedó con ${total} afirmación(es) por revisar en ${hechos.length} carrusel(es).` +
      (seguridad
        ? `\n${seguridad} son indicaciones de seguridad: esas las firma el doctor, no tú.`
        : ''),
  );
  console.log('Ninguno se puede pasar de borrador hasta que estén revisadas.');
  console.log(`\nA revisar: ${base}/${proyecto}`);
}
