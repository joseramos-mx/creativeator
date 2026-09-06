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
 * público, CC0, CC BY-SA y cosas que no se pueden usar en absoluto, y la
 * diferencia entre una y otra es una cadena de texto dentro de la respuesta.
 * Inventar licencias y comprobar que las malas no pasan es lo único que separa
 * "leemos la licencia" de "suponemos que es libre".
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { aCandidato } from '../lib/bancos/commons.ts';
import {
  clinicasDe,
  consultaDeArchivo,
  faltaClinico,
  FUENTE_CONSULTORIO,
} from '../lib/clinicas.ts';

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
ok(
  candidatos.every((c) => c.credito !== null),
  'las de la muestra son todas usables: dominio público, CC0 y CC BY-SA',
);
ok(
  candidatos.every((c) => c.credito?.fuente === 'Wikimedia Commons'),
  'con la fuente escrita',
);
ok(
  candidatos.every((c) => c.credito?.url?.startsWith('https://commons.wikimedia.org/')),
  'y el enlace a la ficha del archivo, no al JPEG',
);

// A diferencia de Pexels, aquí la licencia sale de la respuesta y varía.
const licencias = [...new Set(candidatos.map((c) => c.credito?.licencia))].sort();
ok(licencias.length > 1, `la licencia es por imagen, no una constante: ${licencias.join(', ')}`);

const conObligacion = candidatos.filter((c) => c.avisos?.length);
ok(
  conObligacion.length > 0 && conObligacion.every((c) => c.avisos.some((a) => /CC BY/.test(a))),
  'las CC BY-SA avisan de la obligación de compartir igual antes de firmarlas',
);
ok(
  candidatos.some((c) => c.credito?.licencia === 'Public domain' && !c.avisos?.length),
  'y el dominio público no arrastra ninguna',
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

for (const buena of ['pd', 'pd-us', 'cc0', 'cc-by-4.0', 'cc-by-sa-3.0']) {
  ok(conLicencia(buena).credito !== null, `"${buena}" sí`);
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

const sinAutor = structuredClone(paginas[2]); // una CC BY-SA, que exige atribución
sinAutor.imageinfo[0].extmetadata.Artist = { value: '' };
ok(
  aCandidato(sinAutor).credito === null,
  'una licencia que exige atribución sin autor tampoco',
);

const sinArchivo = structuredClone(paginas[0]);
delete sinArchivo.imageinfo[0].url;
ok(aCandidato(sinArchivo).credito === null, 'sin archivo del que bajar, tampoco');
ok(aCandidato({}).credito === null, 'una página vacía no revienta y no acredita');

/* ── la barrera clínica ──────────────────────────────────────────────────── */
console.log('\nLa barrera clínica');

const conFoto = (visual) => ({ slides: [{ tipo: 'contenido', visual }] });
const base = {
  clase: 'foto',
  src: '/media/x/clinica-1.jpg',
  clinica: true,
  credito: { fuente: 'Wikimedia Commons', licencia: 'CC0' },
};
const firmada = {
  ...base,
  aprobacion: { aprobadaPor: 'Dr. Edwin Maldonado', fecha: '2026-09-06', huella: 'abc123' },
};

ok(clinicasDe(conFoto(base)).length === 1, 'una foto marcada como clínica se detecta');
ok(
  clinicasDe(conFoto({ ...base, clinica: undefined })).length === 0,
  'y una de ambiente no entra en esta cola',
);
ok(faltaClinico(conFoto(base)).length === 1, 'sin firma no se puede aprobar el carrusel');
ok(
  /sin aprobar/.test(faltaClinico(conFoto(base))[0].que),
  'diciendo que le falta la firma',
);
ok(faltaClinico(conFoto(firmada)).length === 0, 'con firma sí');

// Lo que sostiene la firma: va pegada a los bytes.
const cambiada = faltaClinico(conFoto(firmada), { '/media/x/clinica-1.jpg': 'otra-huella' });
ok(cambiada.length === 1, 'si la imagen cambia, la aprobación se cae');
ok(/cambió después/.test(cambiada[0].que), `y lo dice: "${cambiada[0].que}"`);
ok(
  faltaClinico(conFoto(firmada), { '/media/x/clinica-1.jpg': 'abc123' }).length === 0,
  'con la misma huella, sigue en pie',
);
ok(
  /no está en disco/.test(
    faltaClinico(conFoto(firmada), { '/media/x/clinica-1.jpg': null })[0]?.que ?? '',
  ),
  'y si el archivo desapareció, también lo dice',
);

// El consentimiento solo se exige a lo que se fotografió en la consulta: las de
// archivo vienen con el suyo resuelto en la institución que las cedió.
const deConsulta = {
  ...firmada,
  credito: { fuente: FUENTE_CONSULTORIO, licencia: 'propia' },
};
ok(
  faltaClinico(conFoto(deConsulta)).some((f) => /consentimiento/.test(f.que)),
  'una foto del consultorio sin referencia de consentimiento no pasa',
);
ok(
  faltaClinico(
    conFoto({
      ...deConsulta,
      credito: { ...deConsulta.credito, consentimiento: { referencia: 'expediente 218' } },
    }),
  ).length === 0,
  'con la referencia del documento, sí',
);
ok(
  faltaClinico(conFoto(firmada)).length === 0,
  'y a una de archivo no se le pide consentimiento',
);

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
