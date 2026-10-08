/**
 * scripts/banco-clinicas.mjs — `npm run banco-clinicas`
 *
 * El banco del archivo clínico, contra una respuesta real de Wikimedia Commons
 * guardada en scripts/muestras/ y contra copias con la licencia cambiada a
 * mano. Sin red.
 *
 * Aquí el fallo en cerrado importa más que en el banco de fotos de ambiente, y
 * por una razón concreta: en Pexels la licencia es la misma para todo, así que
 * la constante no puede equivocarse de imagen. En Commons conviven el dominio
 * público, CC0, CC BY, CC BY-SA y cosas que no se pueden usar en absoluto, y
 * la diferencia entre una y otra es una cadena de texto dentro de la respuesta.
 * Inventar licencias y comprobar que las malas no pasan es lo único que separa
 * "leemos la licencia" de "suponemos que es libre".
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { aCandidato } from '../lib/bancos/commons.ts';
import { consultaDeArchivo } from '../lib/clinicas.ts';

let fallos = 0;
const ok = (bien, texto) => {
  console.log(`  ${bien ? 'OK  ' : 'FALLA'} ${texto}`);
  if (!bien) fallos++;
};

const muestra = JSON.parse(
  readFileSync(join(process.cwd(), 'scripts', 'muestras', 'commons-impetigo.json'), 'utf8'),
);
const paginas = muestra.query.pages;

/* ── lo que trae la muestra real ─────────────────────────────────────────── */
console.log('\nLa respuesta real de Wikimedia Commons');

const candidatos = paginas.map(aCandidato);
ok(candidatos.length === paginas.length, `${candidatos.length} páginas normalizadas`);
// La muestra trae dominio público, CC0 y CC BY-SA. Las BY-SA no pasan: el
// share-alike se propagaría al PNG que se sube a Instagram.
const usables = candidatos.filter((c) => c.credito);
ok(usables.length > 0, `${usables.length} de ${candidatos.length} usables`);
ok(
  usables.every((c) => c.credito?.fuente === 'Wikimedia Commons'),
  'con la fuente escrita',
);
ok(
  usables.every((c) => c.credito?.url?.startsWith('https://commons.wikimedia.org/')),
  'y el enlace a la ficha del archivo, no al JPEG',
);

// A diferencia de Pexels, aquí la licencia sale de la respuesta y varía.
const licencias = [...new Set(candidatos.map((c) => c.credito?.licencia).filter(Boolean))].sort();
ok(licencias.length > 0, `la licencia es por imagen, no una constante: ${licencias.join(', ')}`);
ok(
  !licencias.some((l) => /BY-SA/i.test(l)),
  'y ninguna usable es CC BY-SA: el share-alike alcanzaría al carrusel entero',
);
ok(
  usables.some((c) => c.credito?.licencia === 'Public domain' && !c.avisos?.length),
  'el dominio público no arrastra obligaciones',
);

/* ── licencias que no pasan ──────────────────────────────────────────────── */
console.log('\nLicencias que no pasan');

/** La misma página, con otra licencia. */
const conLicencia = (valor) => {
  const copia = structuredClone(paginas[0]);
  copia.imageinfo[0].extmetadata.License = { value: valor };
  return aCandidato(copia);
};

for (const mala of [
  'cc-by-nc-2.0',
  'cc-by-nc-nd-3.0', // la de DermNet
  'cc-by-nd-4.0',
  'fairuse',
  'nonfree',
  'gfdl',
  'attribution-only-nc',
  '',
]) {
  ok(conLicencia(mala).credito === null, `"${mala || '(vacía)'}" no se puede usar`);
}

for (const buena of ['pd', 'pd-us', 'cc0', 'cc-by-4.0', 'cc-by-3.0']) {
  ok(conLicencia(buena).credito !== null, `"${buena}" sí`);
}

// Se puede usar, pero el share-alike se propagaría al PNG de Instagram y de ahí
// al carrusel entero. Queda fuera por decisión, no por licencia inválida: la
// línea para activarla está escrita en lib/bancos/commons.ts.
for (const compartirIgual of ['cc-by-sa-3.0', 'cc-by-sa-4.0']) {
  ok(
    conLicencia(compartirIgual).credito === null,
    `"${compartirIgual}" no entra: el share-alike alcanzaría al carrusel`,
  );
}

// "cc-by-nc" empieza igual que "cc-by": si la comparación fuera por prefijo
// suelto, la no comercial pasaría. Es el error que más caro sale aquí.
ok(
  conLicencia('cc-by-nc-sa-4.0').credito === null,
  'y "cc-by-nc-sa-4.0" no cuela por parecerse a "cc-by-sa"',
);

console.log('\nOtros motivos de fallo en cerrado');

const conRestriccion = structuredClone(paginas[0]);
conRestriccion.imageinfo[0].extmetadata.Restrictions = { value: 'personality' };
ok(
  aCandidato(conRestriccion).credito === null,
  'una restricción de derechos de imagen deja la foto fuera',
);

const sinAutor = structuredClone(paginas[2]);
sinAutor.imageinfo[0].extmetadata.License = { value: 'cc-by-4.0' }; // exige atribución
sinAutor.imageinfo[0].extmetadata.Artist = { value: '' };
ok(
  aCandidato(sinAutor).credito === null,
  'una licencia que exige atribución sin autor tampoco',
);

const sinArchivo = structuredClone(paginas[0]);
delete sinArchivo.imageinfo[0].url;
ok(aCandidato(sinArchivo).credito === null, 'sin archivo del que bajar, tampoco');
ok(aCandidato({}).credito === null, 'una página vacía no revienta y no acredita');

/* ── la consulta por defecto ─────────────────────────────────────────────── */
console.log('\nLa consulta que sale del tema');

// La primera llamada real buscó "Impétigo en el regreso a clases" tal cual y
// devolvió una sola imagen usable: Commons indexa en inglés y por título de
// archivo. Cortar en la preposición pasó de 1 a 21.
for (const [tema, esperado] of [
  ['Impétigo en el regreso a clases', 'impetigo'],
  ['Dermatitis atópica en invierno', 'dermatitis atopica'],
  ['Urticaria', 'urticaria'],
  ['Molusco contagioso y la alberca', 'molusco contagioso'],
  ['Quemaduras de sol', 'quemaduras'],
]) {
  const salida = consultaDeArchivo(tema);
  ok(salida === esperado, `"${tema}" → "${salida}"`);
}

console.log(fallos === 0 ? '\nTodo en pie.' : `\n${fallos} comprobaciones fallaron.`);
if (fallos > 0) process.exitCode = 1;
