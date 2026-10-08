/**
 * scripts/banco-iconos.mjs — `npm run banco-iconos`
 *
 * Que `iconoSugerido` se convierta en el ícono correcto, o en ninguno.
 *
 * El redactor devuelve el concepto en inglés y el servidor lo casa contra el
 * manifiesto. Los dos errores posibles no pesan lo mismo:
 *
 *  · **No encontrar lo que sí está** cuesta un clic en el editor. Molesto.
 *  · **Poner un ícono equivocado** no cuesta nada en el momento y sale
 *    publicado, porque nadie revisa un ícono que ya está puesto. Un carrusel
 *    sobre contagio con el ícono de un preservativo pasa desapercibido hasta
 *    que alguien lo ve en el feed.
 *
 * Por eso el umbral es el que es y por eso este banco insiste tanto en lo que
 * **no** debe casar. Corre contra el manifiesto de verdad, sin red.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mejorCoincidencia } from '../lib/iconos.ts';
import { esSignoClinico } from '../lib/iconos/clinico.ts';
import { etiquetar, slugificar } from '../lib/iconos/etiquetas.ts';

let fallos = 0;
const ok = (bien, texto) => {
  console.log(`  ${bien ? 'OK  ' : 'FALLA'} ${texto}`);
  if (!bien) fallos++;
};

const manifiesto = JSON.parse(
  readFileSync(join(process.cwd(), 'public', 'iconos', 'manifest.json'), 'utf8'),
);
const casa = (concepto) => mejorCoincidencia(manifiesto, concepto)?.slug ?? null;

console.log(`\nContra los ${manifiesto.length} íconos que hay`);

/* ── lo que sí tiene que casar ───────────────────────────────────────────── */

for (const [concepto, esperado] of [
  ['magnifying glass', 'lupa'],
  ['thermometer', 'termometro'],
  ['band aid', 'curitas'],
  // El redactor escribe en inglés y la librería mezcla los dos idiomas: el
  // puente son los sinónimos de compartido/sinonimos.json.
  ['lupa', 'lupa'],
  ['termometro', 'termometro'],
]) {
  const salida = casa(concepto);
  ok(salida === esperado, `"${concepto}" → ${salida ?? '(ninguno)'}`);
}

/* ── lo que no debe casar ────────────────────────────────────────────────── */
console.log('\nLo que no está: mejor ninguno que uno equivocado');

for (const concepto of [
  'stethoscope',   // la cuenta lo usa, pero la librería no lo tiene
  'inhaler',
  'pollen grain',
  'washing machine',
  'birthday cake',
  'submarine',
]) {
  const salida = casa(concepto);
  ok(salida === null, `"${concepto}" → ${salida ?? '(ninguno)'}`);
}

// El caso que de verdad importa, y el motivo del umbral: un concepto cercano
// que casaría con algo temáticamente vecino y visualmente equivocado.
console.log('\nLos vecinos peligrosos');
for (const concepto of ['contagion', 'infection', 'protection', 'skin rash']) {
  const salida = casa(concepto);
  ok(salida === null, `"${concepto}" no arrastra un ícono cualquiera → ${salida ?? '(ninguno)'}`);
}

ok(casa('') === null, 'un concepto vacío no casa con nada');
ok(casa('   ') === null, 'y uno de solo espacios tampoco');

/* ── la librería vacía ───────────────────────────────────────────────────── */
console.log('\nSin manifiesto');

ok(
  mejorCoincidencia([], 'magnifying glass') === null,
  'con la librería vacía no revienta: devuelve ninguno',
);

/* ── que no se genere dos veces lo mismo ─────────────────────────────────── */
console.log('\nLa librería se llena sola y no repite');

const sinonimos = JSON.parse(
  readFileSync(join(process.cwd(), 'compartido', 'sinonimos.json'), 'utf8'),
);

/** La entrada tal como la escribe `guardarIcono` cuando genera un concepto. */
function comoSeGuarda(concepto) {
  const slug = slugificar(concepto);
  return {
    slug,
    nombre: concepto,
    etiquetas: etiquetar(slug, concepto, sinonimos),
    color: '#8899AA',
    w: 1024,
    h: 1024,
    origen: 'generado',
  };
}

// Lo que sostiene que generar salga barato: el segundo carrusel que pida el
// mismo concepto lo encuentra y no vuelve a pagar. Si el slug o las etiquetas
// que escribe el guardado no fueran encontrables por el mismo buscador que
// preguntó, se generaría el mismo ícono una vez por carrusel para siempre.
for (const concepto of [
  'stethoscope',
  'water drop',
  'wind',
  'tissue box',
  'pollen grain',
  'inhaler',
]) {
  const libreria = [...manifiesto, comoSeGuarda(concepto)];
  const encontrado = mejorCoincidencia(libreria, concepto)?.slug ?? null;
  ok(
    encontrado === slugificar(concepto),
    `tras generarlo, "${concepto}" ya se encuentra → ${encontrado ?? '(ninguno)'}`,
  );
}

// Y sigue sin encontrar lo que no está, aunque la librería haya crecido.
const conUnoNuevo = [...manifiesto, comoSeGuarda('stethoscope')];
ok(
  mejorCoincidencia(conUnoNuevo, 'birthday cake') === null,
  'y lo que no está sigue sin casar',
);

/* ── lo que no se genera ─────────────────────────────────────────────────── */
console.log('\nEl signo clínico no se dibuja');

// Los tres primeros salieron de carruseles de verdad, con la generación
// automática ya enchufada. "grouped raised bumps on arm skin" produjo un
// antebrazo con ronchas: exactamente la imagen que un papá usaría para decidir
// si lo que ve en su hijo es eso. La regla estaba escrita en tres archivos y
// aun así se coló, porque estaba solo en prompts.
for (const concepto of [
  'grouped raised bumps on arm skin',
  'hives welts',
  'swollen lips',
  'rash on the face',
  'eczema patch',
  'honey colored crusts around the mouth',
  'ronchas en el brazo',
  'peeling skin',
]) {
  const motivo = esSignoClinico(concepto);
  ok(motivo !== null, `"${concepto}" no se genera — ${motivo ?? 'PASÓ'}`);
}

// Y los objetos del mismo tema sí pasan: el filtro tiene que dejar trabajar,
// no vaciar el carrusel.
console.log('\nY el objeto que lo acompaña sí');
for (const concepto of [
  'cream tube',
  'cold compress',
  'mosquito',
  'antihistamine box',
  'milk carton and egg',
  'magnifying glass',
  'fork with clock',
  'cotton clothes',
  'washing machine',
]) {
  const motivo = esSignoClinico(concepto);
  ok(motivo === null, `"${concepto}" sí${motivo ? ` — pero lo bloqueó: ${motivo}` : ''}`);
}

console.log(fallos === 0 ? '\nTodo en pie.' : `\n${fallos} comprobaciones fallaron.`);
if (fallos > 0) process.exitCode = 1;
