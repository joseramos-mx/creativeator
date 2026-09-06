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
  // puente son los sinónimos de content/sinonimos.json.
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

console.log(fallos === 0 ? '\nTodo en pie.' : `\n${fallos} comprobaciones fallaron.`);
if (fallos > 0) process.exitCode = 1;
