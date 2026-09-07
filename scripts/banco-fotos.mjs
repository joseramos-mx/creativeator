/**
 * scripts/banco-fotos.mjs — `npm run banco-fotos`
 *
 * El banco del adaptador de bancos de imágenes. Corre contra una respuesta real
 * de Pexels guardada en scripts/muestras/ y contra copias mutadas a mano: sin
 * red, sin navegador, sin gastar cuota.
 *
 * Comprueba dos cosas que no se pueden mirar leyendo el JSON:
 *
 *  1. **El fallo en cerrado.** Cuando la respuesta no trae lo que hace falta
 *     para acreditar la foto, el candidato sale sin crédito y no se ofrece.
 *     Es lo que sostiene que la constante "Pexels License" sea un hecho y no
 *     un valor de relleno: solo se escribe cuando todo lo demás encaja.
 *  2. **El descarte.** La regresión del gimnasio: el slide del contagio en la
 *     escuela se publicó con la foto de un gimnasio porque encajaba con "niños
 *     juntos". Con los términos de descarte puestos, no habría pasado.
 *
 * Mutar una muestra no cuesta llamadas, así que los casos de fallo se prueban
 * igual de bien que el camino feliz — que es justo al revés de lo que pasa
 * cuando las pruebas salen a la red.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { aCandidato, LICENCIA, LICENCIA_URL } from '../lib/bancos/pexels.ts';
import { cribar } from '../lib/bancos/descartar.ts';
import {
  CAJA_CONTENIDO,
  CAJA_PORTADA,
  MINIMO_VISIBLE,
  porEncuadre,
  visibleTrasRecorte,
} from '../lib/bancos/encuadre.ts';

let fallos = 0;
const ok = (bien, texto) => {
  console.log(`  ${bien ? 'OK  ' : 'FALLA'} ${texto}`);
  if (!bien) fallos++;
};

const muestra = JSON.parse(
  readFileSync(join(process.cwd(), 'scripts', 'muestras', 'pexels-aula.json'), 'utf8'),
);
const original = muestra.photos[0];

/* ── el camino feliz ─────────────────────────────────────────────────────── */
console.log('\nLa respuesta real de Pexels');

const c = aCandidato(original);
ok(c.credito !== null, 'una foto completa sí se puede acreditar');
ok(c.credito?.autor === original.photographer, `autor: ${c.credito?.autor}`);
ok(c.credito?.url === original.url, 'el enlace es la página de la foto, no la del archivo');
ok(c.credito?.fuente === 'Pexels', 'la fuente es el proveedor');
ok(c.credito?.licencia === LICENCIA, `la licencia es la constante: ${LICENCIA}`);
ok(c.credito?.licenciaUrl === LICENCIA_URL, 'y va con el enlace a su texto');
ok(c.descarga.startsWith('https://'), 'la descarga apunta a un archivo grande');
ok(c.descripcion.length > 0, 'trae descripción, que es sobre lo que corre el descarte');
ok(
  muestra.photos.every((f) => aCandidato(f).credito !== null),
  `las ${muestra.photos.length} de la muestra se pueden acreditar`,
);

/* ── el fallo en cerrado ─────────────────────────────────────────────────── */
console.log('\nFallo en cerrado');

/** La misma foto, con un campo roto. */
const sin = (campo) => {
  const copia = structuredClone(original);
  delete copia[campo];
  return aCandidato(copia);
};

ok(sin('photographer').credito === null, 'sin autor no hay crédito');
ok(sin('url').credito === null, 'sin enlace a la foto tampoco');
ok(sin('src').credito === null, 'sin archivo del que bajar, tampoco');
ok(sin('id').credito === null, 'sin id, tampoco');
ok(aCandidato({}).credito === null, 'un objeto vacío no revienta y no acredita');
ok(aCandidato(null).credito === null, 'null tampoco');

const enBlanco = structuredClone(original);
enBlanco.photographer = '   ';
ok(aCandidato(enBlanco).credito === null, 'un autor de solo espacios no cuenta como autor');

// Lo que pasaría si Pexels añadiera un nivel de pago. Hoy no manda ninguno de
// estos campos; el día que mande uno, esto deja de ofrecer esas fotos en vez de
// afirmar que están bajo la licencia gratuita.
for (const señal of ['license', 'premium', 'is_plus', 'sponsored', 'paid_only']) {
  const futuro = structuredClone(original);
  futuro[señal] = true;
  ok(
    aCandidato(futuro).credito === null,
    `un campo "${señal}" que no se reconoce deja la foto sin acreditar`,
  );
}

const inocuo = structuredClone(original);
inocuo.avg_color_v2 = '#ffffff';
ok(
  aCandidato(inocuo).credito !== null,
  'pero un campo nuevo que no habla de licencia no estorba',
);

/* ── el descarte: la regresión del gimnasio ──────────────────────────────── */
console.log('\nEl descarte');

/**
 * Los candidatos de aquel slide: "cómo se riega el impétigo en la escuela".
 * El gimnasio es el que se publicó de verdad. Encaja con la consulta —hay
 * gente junta haciendo algo— y no enseña nada de lo que dice el texto.
 */
const comoAquelDia = [
  ficticio('a', 'A cheerful teacher with a group of children in a bright classroom'),
  ficticio('b', 'Two school children interact with backpacks inside a colorful hallway'),
  ficticio('gimnasio', 'Adults training with sport equipment in a gym'),
  ficticio('d', 'Kids playing together during recess in a schoolyard'),
];
const DESCARTAR = ['gym', 'sports equipment', 'adults only', 'fitness'];

const { pasan, apartados, sinCredito } = cribar(comoAquelDia, DESCARTAR);
ok(apartados.length === 1, `aparta una de las cuatro (${apartados.length})`);
ok(apartados[0]?.id === 'gimnasio', 'y es el gimnasio');
ok(apartados[0]?.porque === 'gym', `diciendo por qué: "${apartados[0]?.porque}"`);
ok(pasan.length === 3, 'las tres de escuela pasan');
ok(sinCredito === 0, 'ninguna se cayó por falta de crédito');

// Apartar, no borrar. Si el descarte quitara en silencio, no habría forma de
// distinguirlo de una búsqueda con pocos resultados.
ok(
  pasan.length + apartados.length === comoAquelDia.length,
  'nada desaparece: lo apartado sigue estando, con su motivo',
);

console.log('\nPrecisión del descarte');
ok(
  cribar([ficticio('g', 'Children practicing gymnastics in a school gymnasium')], ['gym'])
    .apartados.length === 0,
  '"gym" no aparta "gymnastics": el descarte es por palabra entera',
);
ok(
  cribar([ficticio('t', 'Public transport with students going to school')], ['sport']).apartados
    .length === 0,
  '"sport" no aparta "transport"',
);
ok(
  cribar([ficticio('p', 'A gym full of adults')], ['gym']).apartados.length === 1,
  'pero "gym" sí aparta "a gym full of adults"',
);
ok(
  cribar([ficticio('m', 'Two gyms side by side')], ['gym']).apartados.length === 1,
  'y el plural también',
);
ok(
  cribar([ficticio('e', 'Sport equipment on the floor')], ['sport equipment']).apartados.length === 1,
  'un término de dos palabras se busca entero',
);
ok(cribar(comoAquelDia, []).apartados.length === 0, 'sin términos no se aparta nada');

// El límite, escrito para que no se descubra a la mala: buscar la secuencia
// entera es lo que hace preciso el descarte, y también lo que hace que un
// término largo apart menos. La primera llamada real devolvió "gym equipment",
// que no habría cazado la foto del gimnasio de aquel día. Por eso el prompt de
// lib/criterios.ts pide una sola palabra siempre que sirva.
ok(
  cribar([ficticio('x', 'Adults training with sport equipment in a gym')], ['gym equipment'])
    .apartados.length === 0,
  '"gym equipment" NO aparta "a gym": un término largo aparta menos, no más',
);

// Una sin crédito no se ofrece, ni siquiera apartada: lo que no se puede
// acreditar no se usa, así que ni se enseña.
const conUnaRota = [...comoAquelDia, { ...ficticio('rota', 'A gym'), credito: null }];
const criba2 = cribar(conUnaRota, DESCARTAR);
ok(criba2.sinCredito === 1, 'la que no se puede acreditar se cuenta aparte');
ok(
  !criba2.pasan.some((x) => x.id === 'rota') && !criba2.apartados.some((x) => x.id === 'rota'),
  'y no aparece en ninguna de las dos listas',
);

function ficticio(id, descripcion) {
  return {
    id,
    proveedor: 'Pexels',
    descripcion,
    ancho: 2000,
    alto: 3000,
    vista: 'https://ejemplo.test/v.jpg',
    descarga: 'https://ejemplo.test/g.jpg',
    credito: { fuente: 'Pexels', licencia: LICENCIA, licenciaUrl: LICENCIA_URL, autor: 'Alguien', url: 'https://ejemplo.test/foto' },
  };
}

/* ── el relleno automático ───────────────────────────────────────────────── */
console.log('\nLo que el relleno automático necesita del modelo');

// El redactor devuelve `busqueda` y `descartar` por slide, en la misma llamada,
// y con eso la foto se pone sin preguntar. Si la consulta llegara vacía, el
// slide se quedaría sin foto en silencio: por eso hay respaldo.
const consultaDe = (slide) => slide.busqueda?.trim() || slide.ideaImagen?.trim() || '';

ok(
  consultaDe({ busqueda: 'children classroom', ideaImagen: 'un aula' }) === 'children classroom',
  'con busqueda se usa la busqueda',
);
ok(
  consultaDe({ busqueda: '  ', ideaImagen: 'niños en el recreo' }) === 'niños en el recreo',
  'sin ella, la idea de imagen hace de respaldo',
);
ok(consultaDe({ busqueda: '', ideaImagen: '' }) === '', 'y sin ninguna, no se busca nada');

// Lo que sostiene que el relleno pueda ser automático: el descarte corre igual
// que cuando alguien elige a mano. Es la misma criba, no una versión relajada.
const comoEnElRelleno = cribar(comoAquelDia, DESCARTAR);
ok(comoEnElRelleno.pasan[0]?.id !== 'gimnasio', 'la que se pondría sola nunca es la apartada');
ok(
  comoEnElRelleno.pasan[0]?.credito != null,
  'y siempre trae crédito: sin él no se ofrece, ni a mano ni solo',
);

/* ── el encuadre ─────────────────────────────────────────────────────────── */
console.log('\nCuánto sobrevive al recorte');

// El número que explicó las fotos cortadas: la caja de contenido es 745×341 y
// se le pedían retratos al banco. Un 2:3 dentro de 2,18:1 conserva el 31 %.
const retrato = visibleTrasRecorte(2000, 3000, CAJA_CONTENIDO);
ok(
  Math.abs(retrato - 0.305) < 0.01,
  `un retrato 2:3 en la caja de contenido conserva el ${Math.round(retrato * 100)} %`,
);
ok(retrato < MINIMO_VISIBLE, 'y por eso no se ofrece: no es la foto, es una tira suya');

const apaisada = visibleTrasRecorte(3000, 2000, CAJA_CONTENIDO);
ok(
  apaisada > MINIMO_VISIBLE,
  `una apaisada 3:2 conserva el ${Math.round(apaisada * 100)} % y sí sirve`,
);

// Y al revés en la portada, que es el lienzo entero y sí es vertical.
ok(
  visibleTrasRecorte(2000, 3000, CAJA_PORTADA) > MINIMO_VISIBLE,
  'en la portada el retrato es el que encaja',
);
// Y una apaisada en la portada se queda justo en el filo: conserva el 53 %,
// apenas por encima del mínimo. Pasa, y está bien que pase — la portada lleva
// un velo encima y el recorte se nota menos que en un bloque de contenido—,
// pero conviene que el número esté escrito y no descubrirlo el día que una
// portada salga rara.
const anchaEnPortada = visibleTrasRecorte(3000, 2000, CAJA_PORTADA);
ok(
  Math.abs(anchaEnPortada - 0.533) < 0.01,
  `una apaisada en la portada conserva el ${Math.round(anchaEnPortada * 100)} %: en el filo`,
);
ok(anchaEnPortada > MINIMO_VISIBLE, 'pasa, pero por poco');

ok(
  Math.abs(visibleTrasRecorte(745, 341, CAJA_CONTENIDO) - 1) < 0.001,
  'una foto de la forma exacta de la caja conserva el 100 %',
);
ok(visibleTrasRecorte(0, 0, CAJA_CONTENIDO) === 0, 'y una sin medidas no se cuela como perfecta');

console.log('\nOrdenar sin inventar relevancia');

const conFormas = [
  { ...ficticio('vertical', 'a'), ancho: 2000, alto: 3000 },
  { ...ficticio('ancha-1', 'b'), ancho: 3000, alto: 2000 },
  { ...ficticio('ancha-2', 'c'), ancho: 2400, alto: 1600 },
];
const { encajan, recortadas } = porEncuadre(conFormas, CAJA_CONTENIDO);
ok(encajan.length === 2 && recortadas.length === 1, 'aparta la vertical y deja las dos anchas');
ok(recortadas[0].id === 'vertical', 'y la apartada es la vertical');
// El banco ya ordenó por relevancia; aquí no se sabe de eso. Solo se hunde lo
// que no cabe, y el resto conserva su orden.
ok(
  encajan[0].id === 'ancha-1' && encajan[1].id === 'ancha-2',
  'las que encajan conservan el orden del banco, no se reordenan por forma',
);

console.log(fallos === 0 ? '\nTodo en pie.' : `\n${fallos} comprobaciones fallaron.`);
if (fallos > 0) process.exitCode = 1;
