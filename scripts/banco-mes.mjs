/**
 * scripts/banco-mes.mjs — `npm run banco-mes`
 *
 * Que la tanda del mes no escriba dos veces el mismo carrusel.
 *
 * Es el único punto de `npm run mes` que se puede comprobar sin gastar: el
 * resto de la tanda es el mismo camino que ya cubren los otros bancos, llamado
 * ocho veces. Lo que la tanda añade de nuevo es decidir, antes del bucle caro,
 * cuáles de los temas propuestos **no** se escriben.
 *
 * Y esa decisión tiene dos errores de peso muy distinto:
 *
 *  · **Dejar pasar un repetido** cuesta una llamada larga, una carpeta de fotos
 *    y una revisión entera de nueve afirmaciones, para tirar el resultado.
 *  · **Tirar un tema bueno** cuesta un carrusel menos en el mes, y nadie se
 *    entera de que faltaba: el script dice que lo tiró, pero por el motivo
 *    equivocado.
 *
 * El segundo es peor, porque es silencioso. Por eso este banco insiste más en
 * lo que **debe** pasar que en lo que debe caer.
 *
 * Y por eso hay dos umbrales en vez de uno: corriendo este banco salió el caso
 * que un solo umbral no puede resolver —"Protector solar en niños" y "Protector
 * solar y dermatitis" miden igual que "Alergia al polen en primavera" y
 * "Alergia al polen en marzo", y son dos carruseles los primeros y uno los
 * segundos—, así que en esa franja se escribe y se avisa. Ver lib/mes.ts.
 *
 * Corre sin red, sin navegador y sin servidor.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { contenido, parecido, revisarTanda, PARECIDOS, IDENTICOS } from '../lib/mes.ts';
import { PROYECTO_DE_PRUEBAS, rutasDe } from '../lib/proyecto.ts';
import { instrucciones } from '../lib/temas.ts';

let fallos = 0;
const ok = (bien, texto) => {
  console.log(`  ${bien ? 'OK  ' : 'FALLA'} ${texto}`);
  if (!bien) fallos++;
};

const pct = (a, b) => `${Math.round(parecido(a, b) * 100)} %`;

/* ── lo que es el mismo carrusel ─────────────────────────────────────────── */
console.log('\nEl mismo carrusel con otro título — se tira');

for (const [a, b] of [
  ['Impétigo en el regreso a clases', 'El impétigo del regreso a clases'],
  ['Dermatitis atópica en invierno', 'Dermatitis atópica y el clima seco de invierno'],
  ['Alergia al polen en primavera', 'Polen y alergia: qué hacer en primavera'],
  // El caso que la unión no cazaría: el largo se come al corto.
  ['Impétigo en la escuela', 'Cómo se contagia el impétigo en la escuela'],
  // Los acentos no son una diferencia de tema.
  ['Dermatitis atopica del pañal', 'Dermatitis atópica del panal'],
]) {
  ok(parecido(a, b) >= IDENTICOS, `«${a}» ≡ «${b}» (${pct(a, b)})`);
}

/* ── lo que NO lo es ─────────────────────────────────────────────────────── */
console.log('\nLa misma condición, distinto carrusel — se escribe');

// Los que más importan: si estos cayeran, el mes saldría corto sin motivo y el
// script diría que fue por repetido.
for (const [a, b] of [
  ['Dermatitis atópica en invierno', 'Dermatitis de contacto por el uniforme'],
  ['Ronchas por el uniforme nuevo', 'Ronchas por el frío'],
  ['Cómo se contagia el impétigo', 'Cómo distinguir el impétigo de un fuego labial'],
  ['Alergia alimentaria en las fiestas', 'Alergia al polen en primavera'],
  ['Picaduras de mosquito en vacaciones', 'Picaduras y ronchas: cuándo preocuparse'],
  ['Protector solar en niños', 'Protector solar y dermatitis'],
]) {
  ok(parecido(a, b) < IDENTICOS, `«${a}» ≠ «${b}» (${pct(a, b)})`);
}

/* ── la franja que no se puede decidir contando ──────────────────────────── */
console.log('\nEn medio: se escribe, pero se dice');

// Los dos pares que miden igual y no significan lo mismo. Ninguno se tira; de
// los dos se avisa. Que estén juntos aquí es el punto: si algún día alguien
// sube IDENTICOS para "arreglar" el segundo, el primero cae con él.
for (const [a, b, comentario] of [
  ['Protector solar en niños', 'Protector solar y dermatitis', 'dos carruseles'],
  ['Alergia al polen en primavera', 'Alergia al polen en marzo', 'uno solo, pero no se puede saber contando'],
]) {
  const cuanto = parecido(a, b);
  ok(
    cuanto >= PARECIDOS && cuanto < IDENTICOS,
    `«${a}» / «${b}» → ${pct(a, b)}, se avisa (${comentario})`,
  );
}

const franja = revisarTanda(
  ['Protector solar en niños', 'Protector solar y dermatitis', 'Picaduras en el patio'],
  [],
);
ok(franja.length === 1 && franja[0].accion === 'avisar', 'y en la tanda sale como aviso, no como tirón');
ok(
  revisarTanda(['Impétigo en la escuela', 'Cómo se contagia el impétigo en la escuela'], [])[0]
    ?.accion === 'tirar',
  'mientras que el idéntico sí se tira',
);

// Un tema que solo se avisó sigue en la lista: el tercero puede chocar con él.
const encadenado = revisarTanda(
  ['Protector solar en niños', 'Protector solar y dermatitis', 'Protector solar y dermatitis'],
  [],
);
ok(
  encadenado.length === 2 && encadenado[1].accion === 'tirar',
  'y el que solo se avisó sigue contando para el siguiente',
);

// Una sola palabra en común nunca alcanza: "dermatitis" está en media cuenta.
console.log('\nUna palabra compartida no es un tema compartido');
for (const [a, b] of [
  ['Dermatitis atópica', 'Dermatitis del pañal'],
  ['Alergia al polen', 'Alergia alimentaria'],
]) {
  ok(parecido(a, b) === 0, `«${a}» vs «${b}» → 0`);
}

/* ── la gramática no cuenta ──────────────────────────────────────────────── */
console.log('\nLas palabras que no dicen nada del tema');

const palabras = contenido('El brote de la dermatitis en los niños que van a la escuela');
for (const vacia of ['el', 'de', 'la', 'los', 'que', 'van']) {
  ok(!palabras.has(vacia), `"${vacia}" no cuenta como tema`);
}
for (const llena of ['brote', 'dermatitis', 'ninos', 'escuela']) {
  ok(palabras.has(llena), `"${llena}" sí`);
}

/* ── quién gana el choque ────────────────────────────────────────────────── */
console.log('\nCuál de los dos se tira');

const publicados = ['Impétigo en el regreso a clases'];
const tanda = [
  'Dermatitis de contacto por el uniforme',       // 0 — pasa
  'El impétigo del regreso a clases',             // 1 — choca con lo publicado
  'Dermatitis de contacto y los broches del uniforme', // 2 — choca con el 0
  'Picaduras de mosquito en el patio',            // 3 — pasa
];
const choques = revisarTanda(tanda, publicados);

ok(choques.length === 2, `de cuatro temas chocan dos (chocaron ${choques.length})`);
ok(choques.every((c) => c.accion === 'tirar'), 'y los dos son idénticos, así que se tiran');
ok(
  choques.some((c) => c.indice === 1 && c.donde === 'ya publicado'),
  'el que repite lo publicado cae, y dice contra qué',
);
ok(
  choques.some((c) => c.indice === 2 && c.donde === 'la misma tanda'),
  'y dentro de la tanda gana el primero, que es el que el modelo ordenó antes',
);
ok(
  !choques.some((c) => c.indice === 0),
  'el primero de los dos gemelos sobrevive: se tira uno, no los dos',
);
ok(
  choques.every((c) => c.contra && c.tema),
  'cada choque dice qué tema y contra cuál — el script tiene que poder explicarlo',
);

/* ── contra los temas de verdad ──────────────────────────────────────────── */
console.log('\nContra lo que la cuenta ya publicó');

const POSTS = rutasDe(PROYECTO_DE_PRUEBAS).posts;
const reales = readdirSync(POSTS)
  .filter((f) => f.endsWith('.json') && !f.startsWith('laboratorio-'))
  .map((f) => JSON.parse(readFileSync(join(POSTS, f), 'utf8')).tema);

// Ninguno de los publicados choca con otro publicado: si chocaran, el umbral
// estaría llamando repetido a lo que esta cuenta considera dos carruseles.
const entreSi = revisarTanda(reales, []);
ok(
  entreSi.length === 0,
  entreSi.length
    ? `el umbral llama repetidos a dos que ya se publicaron: ${entreSi.map((c) => `«${c.tema}» vs «${c.contra}»`).join('; ')}`
    : `los ${reales.length} publicados son distintos entre sí para el umbral`,
);

// Y cada uno choca consigo mismo: la comprobación más tonta y la que caza que
// alguien rompa la normalización.
ok(
  reales.every((t) => parecido(t, t) >= IDENTICOS),
  'cada tema publicado se reconoce a sí mismo',
);

/* ── casos raros ─────────────────────────────────────────────────────────── */
console.log('\nLo que no debe reventar');

ok(parecido('', 'Dermatitis atópica') === 0, 'un tema vacío no se parece a nada');
ok(parecido('   ', '...') === 0, 'ni uno de solo signos');
ok(revisarTanda([], ['Impétigo']).length === 0, 'una tanda vacía no da choques');
ok(revisarTanda(['Impétigo en la escuela'], []).length === 0, 'sin publicados tampoco');

/* ── el prompt escala con la cantidad ────────────────────────────────────── */
console.log('\nPedir ocho no es pedir tres ocho veces');

const CONTEXTO = {
  mes: 'septiembre',
  publicados: reales,
  especialidad: 'Especialista en alergología y dermatología',
  ciudad: 'Durango',
  alcance: readFileSync(rutasDe(PROYECTO_DE_PRUEBAS).prompt('alcance'), 'utf8').trimEnd(),
  paletas: [{ nombre: 'azul', cuando: 'la respuesta cuando no hay color obvio' }],
};

const tres = instrucciones(CONTEXTO);
const ocho = instrucciones(CONTEXTO, 8);

ok(tres.includes('Propón tres temas'), 'con tres se piden tres');
ok(ocho.includes('Propón ocho temas'), 'con ocho se piden ocho');

// Lo que se rompería en silencio: pedir ocho y que el prompt siga diciendo
// "tres propuestas distintas entre sí" al final. El modelo obedecería al
// esquema y devolvería ocho, y el cierre le estaría pidiendo otra cosa.
ok(!ocho.includes('tres'), 'y no queda ni un "tres" suelto en el prompt de ocho');

// El bloque que solo tiene sentido en tanda: repartir el mes y no gastarlo en
// una condición. Con tres estorba, porque tres no son un mes.
ok(!tres.includes('mismo mes'), 'con tres no se habla del mes como cuadrícula');
ok(ocho.includes('mismo mes'), 'con ocho sí');
ok(/cuadr[ií]cula/.test(ocho), 'y se le dice que se va a ver como cuadrícula');

// El contexto sigue llegando entero, que es lo que comprueba banco-proponer.
for (const tema of reales) {
  ok(ocho.includes(tema), `el publicado "${tema}" sigue en el prompt de la tanda`);
}

console.log(fallos === 0 ? '\nTodo en pie.' : `\n${fallos} comprobaciones fallaron.`);
if (fallos > 0) process.exitCode = 1;
