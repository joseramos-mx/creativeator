/**
 * scripts/banco-proponer.mjs — `npm run banco-proponer`
 *
 * Que el contexto llegue de verdad al prompt.
 *
 * Es el fallo que no avisa. Si la lista de temas publicados llegara vacía —un
 * filtro mal puesto, una promesa sin esperar, el campo renombrado— el modelo
 * seguiría contestando tres temas perfectamente razonables, y uno de ellos
 * sería el que la cuenta publicó el mes pasado. No hay excepción, no hay
 * pantalla roja: solo contenido repetido que alguien nota semanas después.
 *
 * Por eso se comprueba el prompt y no la respuesta. Lo único que se puede medir
 * sin gastar una llamada es lo que se manda, y resulta que es también lo único
 * que se rompe en silencio.
 *
 * Corre sin red, sin navegador y sin servidor.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { instrucciones, mesDe } from '../lib/temas.ts';
// Las paletas de verdad, para comprobar que llegan y no solo que el banco las inventa.
import { paletas } from '../template/tokens.ts';

let fallos = 0;
const ok = (bien, texto) => {
  console.log(`  ${bien ? 'OK  ' : 'FALLA'} ${texto}`);
  if (!bien) fallos++;
};

const CONTEXTO = {
  mes: 'septiembre',
  publicados: ['Impétigo en el regreso a clases', 'Dermatitis atópica en invierno'],
  especialidad: 'Especialista en alergología y dermatología',
  ciudad: 'Durango',
  paletas: Object.entries(paletas)
    .filter(([, p]) => p.automatica)
    .map(([nombre, p]) => ({ nombre, cuando: p.cuando })),
};

const prompt = instrucciones(CONTEXTO);

/* ── el contexto llega ───────────────────────────────────────────────────── */
console.log('\nLo que el modelo recibe');

for (const tema of CONTEXTO.publicados) {
  ok(prompt.includes(tema), `el tema publicado "${tema}" está en el prompt`);
}
ok(prompt.includes('septiembre'), 'el mes en curso también');
ok(
  (prompt.match(/septiembre/g) ?? []).length >= 2,
  'y no de pasada: se le pide razonar el calendario con él',
);
ok(prompt.includes(CONTEXTO.ciudad), `la ciudad, que decide qué estación es`);
ok(prompt.includes(CONTEXTO.especialidad), 'y la especialidad como la escribe la marca');

// La distinción que más cambia las propuestas: alergólogo y dermatólogo no es
// dermatólogo general. Sin esto el modelo propone láser y estética.
ok(/alergolog/i.test(prompt), 'se nombra la alergología, no solo la dermatología');
ok(
  /no dermatolog[íi]a\s*\n?\s*general|no.*dermatolog[íi]a general/i.test(prompt.replace(/\*/g, '')),
  'y se dice explícitamente que no es dermatología general',
);
for (const fuera of ['estética', 'láser', 'melanoma']) {
  ok(prompt.includes(fuera), `y que "${fuera}" queda fuera`);
}

ok(/no lo repitas/i.test(prompt), 'se pide no repetir lo publicado');
// Solo las que tienen regla semántica: las de elección manual no se le
// ofrecen, porque quince "sin asociación" le enseñarían que da igual cuál.
const automaticas = Object.entries(paletas).filter(([, p]) => p.automatica);
const manuales = Object.entries(paletas).filter(([, p]) => !p.automatica);
ok(automaticas.length > 0 && manuales.length > 0, `${automaticas.length} automáticas, ${manuales.length} manuales`);
for (const [nombre, p] of automaticas) {
  ok(prompt.includes(nombre), `la paleta ${nombre} está entre las opciones`);
  ok(prompt.includes(p.cuando), `  con su regla de tokens.ts, no una inventada`);
}
for (const [nombre] of manuales) {
  ok(!new RegExp(`· ${nombre}:`).test(prompt), `y ${nombre}, que se elige a mano, no`);
}
ok(/porQueAhora/.test(prompt), 'y se pide la línea de por qué ahora');

/* ── el caso vacío ───────────────────────────────────────────────────────── */
console.log('\nCuando todavía no hay nada publicado');

const primerDia = instrucciones({ ...CONTEXTO, publicados: [] });
ok(
  primerDia.includes('(todavía ninguno)'),
  'la lista vacía se dice en palabras, no se deja en blanco',
);
ok(
  !primerDia.includes('  · Impétigo'),
  'y no se cuela ningún tema de otra corrida',
);

/* ── el mes ──────────────────────────────────────────────────────────────── */
console.log('\nEl mes sale de la fecha, no de una constante');

for (const [iso, esperado] of [
  ['2026-01-15', 'enero'],
  ['2026-09-06', 'septiembre'],
  ['2026-12-31', 'diciembre'],
  ['2026-03-01', 'marzo'],
]) {
  // Con hora, para que la zona horaria no mueva el día al mes anterior.
  const salida = mesDe(new Date(`${iso}T12:00:00`));
  ok(salida === esperado, `${iso} → ${salida}`);
}

/* ── lo que la ruta va a mandar ──────────────────────────────────────────── */
console.log('\nLos temas salen de content/posts/, sin el laboratorio');

const POSTS = join(process.cwd(), 'content', 'posts');
const enDisco = readdirSync(POSTS)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(POSTS, f), 'utf8')));

const deLaCuenta = enDisco.filter((p) => !p.slug.startsWith('laboratorio-'));
ok(deLaCuenta.length > 0, `${deLaCuenta.length} carrusel(es) de la cuenta`);
ok(
  enDisco.length > deLaCuenta.length,
  'y hay de laboratorio, que es lo que hay que filtrar',
);

// El andamio de las pruebas no es contenido: pedirle al modelo que esquive
// "Laboratorio · edición" sería gastarle atención en un tema que no existe.
const conLaboratorio = instrucciones({
  ...CONTEXTO,
  publicados: enDisco.map((p) => p.tema),
});
ok(
  conLaboratorio.includes('Laboratorio'),
  'si se colaran, se verían en el prompt — por eso el filtro está en la ruta',
);
ok(
  !instrucciones({ ...CONTEXTO, publicados: deLaCuenta.map((p) => p.tema) }).includes(
    'Laboratorio',
  ),
  'y filtrados, no aparecen',
);

console.log(fallos === 0 ? '\nTodo en pie.' : `\n${fallos} comprobaciones fallaron.`);
if (fallos > 0) process.exitCode = 1;
