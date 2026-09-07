/**
 * scripts/banco-calendario.mjs — `npm run banco-calendario`
 *
 * Que el calendario se lea como está escrito.
 *
 * Todo lo que se lee mal aquí sale caro y en silencio, que es la peor
 * combinación. Tres formas concretas:
 *
 *  · **La fecha al revés.** `24/08/2026` es 24 de agosto. La misma hoja abierta
 *    en una configuración en inglés escribe `08/24/2026`, y las dos se leen sin
 *    error dando meses distintos. Un carrusel fechado en abril en vez de agosto
 *    no falla: se publica fuera de temporada.
 *  · **Una fila que desaparece.** Si un carrusel se cuela como reel o su fecha
 *    no se entiende, no se escribe. Nadie lo echa de menos hasta que llega su
 *    día y no hay nada que publicar.
 *  · **Un `--desde` que no casa.** Si "colageno" no encuentra su fila y la tanda
 *    arrancara igual, serían doce carruseles que nadie pidió, a dos minutos y
 *    medio y una llamada cada uno.
 *
 * Ninguna de las tres da error. Por eso están aquí.
 *
 * Corre sin red, sin navegador y sin servidor.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { aISO, desde, leerCalendario, pareceInvertida, verificarDia } from '../lib/calendario.ts';
import { IDENTICOS, parecido } from '../lib/mes.ts';

let fallos = 0;
const ok = (bien, texto) => {
  console.log(`  ${bien ? 'OK  ' : 'FALLA'} ${texto}`);
  if (!bien) fallos++;
};

const tabla = (...lineas) => lineas.join('\n');
const CABECERA = 'No.\tFecha\tDía\tTipo\tPilar\tTema\tObjetivo\tNota estratégica';

/* ── la fecha, que es lo que más caro sale ───────────────────────────────── */
console.log('\nEl día y el mes, en su sitio');

ok(aISO('24/08/2026') === '2026-08-24', '24/08/2026 es 24 de agosto');
ok(aISO('2026-08-24') === '2026-08-24', 'y una que ya viene en ISO se deja igual');
ok(aISO('31/8/2026') === '2026-08-31', 'con o sin cero delante');
ok(aISO('') === null && aISO('la semana que viene') === null, 'lo que no es fecha no se inventa');
ok(aISO('24/13/2026') === null, 'ni un mes 13');

// La comprobación que caza el formato invertido sin adivinar la configuración
// regional de nadie: si el 24/08/2026 fuera el 8 de abril, no sería lunes.
ok(verificarDia('2026-08-24', 'Lunes') === null, '2026-08-24 sí es lunes, como dice la hoja');
ok(verificarDia('2026-08-24', 'Miércoles') !== null, 'y si la hoja dijera miércoles, se caza');
ok(verificarDia('2026-08-24', 'lunes') === null, 'da igual la mayúscula');
ok(verificarDia('2026-09-02', 'Miercoles') === null, 'y el acento');
ok(verificarDia('2026-08-24', '—') === null, 'sin día en la hoja, no se comprueba nada');

// Lo mismo, ya dentro del lector: una fila con la fecha invertida no se escribe
// callando, se aparta con su motivo.
const invertida = leerCalendario(
  tabla(CABECERA, '1\t08/24/2026\tLunes\tCarrusel\tCiencia\tPsoriasis y sol\tCompartir\tTrending'),
);
ok(invertida.filas.length === 0, 'una fecha en formato inglés no se cuela');
ok(
  /al rev[eé]s/.test(invertida.saltadas[0]?.porque ?? ''),
  `y se dice por qué: "${invertida.saltadas[0]?.porque ?? '(nada)'}"`,
);

// Las dos comprobaciones se reparten el trabajo y ninguna sobra: un "mes" 24 es
// imposible y lo caza la forma; un 08/09 es válido leído de las dos maneras y
// solo el día de la semana lo separa.
ok(pareceInvertida('08/24/2026') !== null, 'un mes 24 se caza por la forma');
ok(pareceInvertida('08/09/2026') === null, 'pero 08/09 es válido de las dos formas…');
ok(
  verificarDia('2026-09-08', 'Domingo') !== null,
  '…y ahí lo único que decide es el día de la semana de la hoja',
);
ok(pareceInvertida('24/08/2026') === null, 'y una fecha bien escrita no se acusa');

/* ── qué filas son carrusel ──────────────────────────────────────────────── */
console.log('\nLos reels no se escriben aquí');

const mezcla = leerCalendario(
  tabla(
    CABECERA,
    '1\t24/08/2026\tLunes\tCarrusel\tCiencia\tPsoriasis y sol\tCompartir\tTrending',
    '\t25/08/2026\tMartes\tReel\t—\tPor definir\t—\t—',
    '2\t26/08/2026\tMiércoles\tCarrusel\tDiagnóstico\tImpétigo escolar\tGuardar\tRegreso',
    '',
    '3\t28/08/2026\tViernes\tCarrusel\tSoluciones\tPor definir\tGuardar\tTrending',
  ),
);
ok(mezcla.filas.length === 2, `de cinco líneas quedan dos carruseles (quedaron ${mezcla.filas.length})`);
ok(mezcla.saltadas.length === 2, 'y las dos que no se escriben se cuentan, no se pierden');
ok(
  mezcla.saltadas.every((s) => s.porque && s.linea > 0),
  'cada una dice por qué y en qué línea de la hoja está',
);
ok(mezcla.filas[0].numero === 1 && mezcla.filas[1].numero === 2, 'el número de la hoja se conserva');

/* ── los campos que decide la persona ────────────────────────────────────── */
console.log('\nEl pilar, el objetivo y la nota llegan enteros');

const [fila] = leerCalendario(
  tabla(
    CABECERA,
    '5\t02/09/2026\tMiércoles\tCarrusel\tSoluciones reales\tAlopecia androgenética\tAgendar\tMes de la Alopecia',
  ),
).filas;

ok(fila.pilar === 'Soluciones reales', 'el pilar, tal cual se escribió');
ok(fila.nota === 'Mes de la Alopecia', 'la nota también');
// "Agendar" en la hoja tiene que llegar como "agendar", que es lo que acepta el
// esquema y lo que decide el cierre del copy.
ok(fila.objetivo === 'agendar', `"Agendar" → "${fila.objetivo}"`);
ok(fila.fecha === '2026-09-02', 'y la fecha en ISO, lista para `creado`');

// Un objetivo que no existe no se convierte en `null` y sigue: eso escribiría
// el carrusel con el cierre por defecto y con una casilla de la hoja ignorada.
const raro = leerCalendario(
  tabla(CABECERA, '1\t24/08/2026\tLunes\tCarrusel\tCiencia\tPsoriasis\tViralizar\tTrending'),
);
ok(raro.filas.length === 0, 'un objetivo que no existe aparta la fila');
ok(/guardar, compartir/.test(raro.saltadas[0]?.porque ?? ''), 'y dice cuáles valen');

// Sin objetivo en la hoja sí pasa: es opcional, y el modelo lo elige.
const sinObjetivo = leerCalendario(
  tabla(CABECERA, '1\t24/08/2026\tLunes\tCarrusel\tCiencia\tPsoriasis\t—\tTrending'),
);
ok(sinObjetivo.filas.length === 1 && sinObjetivo.filas[0].objetivo === null, 'sin objetivo sí pasa');

/* ── la forma de la hoja ─────────────────────────────────────────────────── */
console.log('\nLas columnas se buscan por su nombre');

// Otro orden y una columna de más: una hoja de trabajo siempre acaba con
// columnas que nadie planeó, y no deben romper la lectura.
const desordenada = leerCalendario(
  tabla(
    'Tema\tEstado\tFecha\tObjetivo\tPilar',
    'Psoriasis y sol\tlisto\t24/08/2026\tCompartir\tCiencia que entiendes',
  ),
);
ok(desordenada.filas.length === 1, 'en otro orden y con una columna de más, se lee igual');
ok(desordenada.filas[0].pilar === 'Ciencia que entiendes', 'y cada valor cae en su campo');

// Sin la columna Tipo, todo lo que tenga tema es carrusel.
ok(desordenada.filas[0].tema === 'Psoriasis y sol', 'sin columna Tipo, lo que tiene tema se escribe');

// CSV con comillas: un tema con coma dentro no se parte en dos.
const csv = leerCalendario(
  tabla(
    'No.,Fecha,Día,Tipo,Pilar,Tema,Objetivo',
    '1,24/08/2026,Lunes,Carrusel,Ciencia,"Níquel: aretes, broches y bisutería",Guardar',
  ),
);
ok(
  csv.filas[0]?.tema === 'Níquel: aretes, broches y bisutería',
  `el tema con coma sobrevive al CSV → "${csv.filas[0]?.tema}"`,
);

// Sin encabezado no se adivina el orden de las columnas: se para.
let paro = false;
try {
  leerCalendario('1\t24/08/2026\tLunes\tCarrusel\tCiencia\tPsoriasis\tCompartir');
} catch {
  paro = true;
}
ok(paro, 'sin fila de encabezado, se para en vez de adivinar');

/* ── desde dónde ─────────────────────────────────────────────────────────── */
console.log('\n--desde');

const hoja = leerCalendario(
  tabla(
    CABECERA,
    '1\t24/08/2026\tLunes\tCarrusel\tCiencia\tPsoriasis y sol\tCompartir\tTrending',
    '2\t26/08/2026\tMiércoles\tCarrusel\tDiagnóstico\tImpétigo escolar\tGuardar\tRegreso',
    '3\t31/08/2026\tLunes\tCarrusel\tCiencia\tColágeno en polvo\tCompartir\tTrending',
  ),
).filas;

ok(desde(hoja, '3')?.length === 1, 'por el número de la hoja');
ok(desde(hoja, 'colageno')?.[0].tema === 'Colágeno en polvo', 'y por un trozo del tema, sin acento');
ok(desde(hoja, 'COLÁGENO')?.length === 1, 'da igual cómo se escriba');
ok(desde(hoja, '')?.length === 3, 'sin marca, la hoja entera');

// El que de verdad importa: si no casa, `null`. Devolver la hoja entera serían
// doce llamadas largas que nadie pidió.
ok(desde(hoja, 'melanoma') === null, 'lo que no está devuelve null, no la hoja entera');

/* ── contra el calendario y los posts de verdad ──────────────────────────── */
console.log('\nContra la hoja de esta cuenta');

const ruta = ['calendario.tsv', 'calendario.csv']
  .map((f) => join(process.cwd(), 'content', f))
  .find((f) => {
    try { readFileSync(f); return true; } catch { return false; }
  });

if (!ruta) {
  console.log('  —    no hay content/calendario.tsv, así que esta parte no corre');
} else {
  const real = leerCalendario(readFileSync(ruta, 'utf8'));
  ok(real.filas.length > 0, `${real.filas.length} carrusel(es) en la hoja`);
  ok(
    real.filas.every((f) => /^\d{4}-\d{2}-\d{2}$/.test(f.fecha)),
    'todas las fechas quedaron en ISO',
  );
  // Ninguna se apartó por algo que no sea "es un reel" o "sin tema": si una fila
  // de verdad se está cayendo, aquí se ve.
  const rotas = real.saltadas.filter((s) => !/reel|sin tema/.test(s.porque));
  ok(
    rotas.length === 0,
    rotas.length ? `hay filas que no se leen: ${rotas.map((r) => `l.${r.linea} ${r.porque}`).join('; ')}` : 'ninguna fila se cae por un error',
  );
  ok(
    real.filas.every((f, i, a) => i === 0 || a[i - 1].fecha <= f.fecha),
    'y van en orden de fecha',
  );

  /*
   * La integración que sostiene "genera los que me faltan": el tema de la hoja
   * contra el tema del archivo ya escrito.
   *
   * Los slugs NO coinciden —la hoja dice "Impétigo: la infección del regreso a
   * clases" y el archivo se llama `impetigo-regreso-a-clases`— así que comparar
   * nombres de archivo daría el carrusel por no escrito y lo redactaría otra
   * vez. Es una llamada larga para acabar con dos carruseles del mismo tema.
   */
  const POSTS = join(process.cwd(), 'content', 'posts');
  const escritos = readdirSync(POSTS)
    .filter((f) => f.endsWith('.json') && !f.startsWith('laboratorio-'))
    .map((f) => JSON.parse(readFileSync(join(POSTS, f), 'utf8')));

  const impetigoHoja = real.filas.find((f) => /imp[eé]tigo/i.test(f.tema));
  const impetigoPost = escritos.find((p) => /imp[eé]tigo/i.test(p.tema));
  if (impetigoHoja && impetigoPost) {
    ok(
      parecido(impetigoHoja.tema, impetigoPost.tema) >= IDENTICOS,
      `«${impetigoHoja.tema}» ya está escrito como «${impetigoPost.tema}»`,
    );
  } else {
    console.log('  —    el impétigo ya no está en la hoja o en los posts; esa comprobación se salta');
  }

  // Y al revés: ningún tema de la hoja se confunde con un post de otro tema. Un
  // falso positivo aquí es un carrusel que nunca se escribe porque el sistema
  // cree que ya está.
  const confusiones = [];
  for (const f of real.filas) {
    for (const p of escritos) {
      if (parecido(f.tema, p.tema) < IDENTICOS) continue;
      // Solo cuenta como error si de verdad no son el mismo tema. Los que sí lo
      // son se listan arriba; aquí se comprueba que no haya ninguno raro.
      const primeraDeCada = f.tema.split(/[\s:]+/)[0].toLowerCase();
      if (!p.tema.toLowerCase().includes(primeraDeCada.slice(0, 6))) {
        confusiones.push(`«${f.tema}» ↔ «${p.tema}»`);
      }
    }
  }
  ok(
    confusiones.length === 0,
    confusiones.length
      ? `un tema de la hoja se confunde con un post distinto: ${confusiones.join('; ')}`
      : 'y ningún tema de la hoja se confunde con un post de otro tema',
  );
}

console.log(fallos === 0 ? '\nTodo en pie.' : `\n${fallos} comprobaciones fallaron.`);
if (fallos > 0) process.exitCode = 1;
