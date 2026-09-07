/**
 * scripts/banco-variedad.mjs — `npm run banco-variedad`
 *
 * Que el mes no salga de un solo color, y que el reparto no pise una elección.
 *
 * El reparto tiene dos formas de salir mal y pesan distinto:
 *
 *  · **Pisar una asociación de verdad.** Si el carrusel va de albercas y el
 *    modelo eligió turquesa, cambiarlo por "el que toca" rompe lo único que la
 *    paleta aporta al contenido. Eso no se ve en la cuadrícula: se ve leyendo
 *    el carrusel, y para entonces ya está publicado.
 *  · **No repartir.** Se vuelve al mes azul, que es el problema que trajo esto.
 *
 * El primero es peor, así que el banco insiste en que lo elegido con razón
 * sobreviva intacto.
 *
 * Corre sin red, sin navegador y sin servidor.
 */

import { repartir } from '../lib/variedad.ts';
import { NOMBRES_PALETA, PALETA_POR_DEFECTO, paletas } from '../template/tokens.ts';

let fallos = 0;
const ok = (bien, texto) => {
  console.log(`  ${bien ? 'OK  ' : 'FALLA'} ${texto}`);
  if (!bien) fallos++;
};

const CANDIDATAS = NOMBRES_PALETA.filter((n) => paletas[n].variedad);
const reparte = (elegida, recientes) =>
  repartir(elegida, PALETA_POR_DEFECTO, recientes, CANDIDATAS);

/* ── lo elegido con razón no se toca ─────────────────────────────────────── */
console.log('\nLa asociación de verdad manda');

for (const [paleta, porque] of [
  ['turquesa', 'agua y alberca'],
  ['cian', 'frío'],
  ['ambar', 'piel seca de invierno'],
  ['lima', 'higiene'],
  ['naranja', 'una de las tres publicadas'],
]) {
  const r = reparte(paleta, [paleta, paleta, paleta]);
  ok(
    r.paleta === paleta,
    `"${paleta}" (${porque}) sobrevive aunque sea la más usada → ${r.paleta}`,
  );
  ok(r.porque === 'la eligió por el tema', '  y se dice que fue el tema quien decidió');
}

/* ── y donde no había razón, se reparte ──────────────────────────────────── */
console.log('\nDonde el modelo dijo "sin color", se reparte');

const r1 = reparte(PALETA_POR_DEFECTO, ['azul', 'azul', 'azul']);
ok(r1.paleta !== PALETA_POR_DEFECTO, `tres azules seguidos y el cuarto no es azul → ${r1.paleta}`);
ok(CANDIDATAS.includes(r1.paleta), 'y sale del reparto, no de cualquier sitio');
ok(r1.porque.startsWith('el tema no pide color'), 'diciendo por qué cambió');

/*
 * El caso que trajo todo esto: doce temas sin color, que es la mayoría de los
 * de esta cuenta. Antes eran doce fondos azules.
 */
console.log('\nUn mes entero de temas sin color');

const mes = [];
for (let i = 0; i < 12; i++) {
  // Se simula la tanda: cada carrusel ve las paletas de los anteriores, del
  // más nuevo al más viejo, que es como llegan de listarPosts().
  mes.push(reparte(PALETA_POR_DEFECTO, [...mes].reverse()).paleta);
}
console.log(`  ${mes.join(' · ')}`);
ok(new Set(mes).size === 12, `las doce son distintas (salieron ${new Set(mes).size})`);
ok(
  mes.every((p, i) => i === 0 || p !== mes[i - 1]),
  'y ninguna repite con la anterior, que es lo que se ve en la cuadrícula',
);

// Con más carruseles que colores tiene que dar la vuelta, no romperse ni
// atascarse en uno.
const largo = [];
for (let i = 0; i < 40; i++) largo.push(reparte(PALETA_POR_DEFECTO, [...largo].reverse()).paleta);
ok(
  largo.every((p, i) => i === 0 || p !== largo[i - 1]),
  `con ${largo.length} seguidos sigue sin repetir con la anterior`,
);
ok(new Set(largo).size === CANDIDATAS.length, `y usa las ${CANDIDATAS.length} del reparto`);

/* ── el mismo calendario, el mismo mes ───────────────────────────────────── */
console.log('\nReproducible');

// Al azar esto no se cumpliría, y es lo que permite probar el reparto: dos
// corridas del mismo calendario tienen que dar los mismos colores.
const otra = [];
for (let i = 0; i < 12; i++) otra.push(reparte(PALETA_POR_DEFECTO, [...otra].reverse()).paleta);
ok(otra.join() === mes.join(), 'dos corridas del mismo mes dan el mismo reparto');

/* ── lo que no entra al reparto ──────────────────────────────────────────── */
console.log('\nLo que no se reparte solo');

// Rojo y carmín son el color de la alarma y esta cuenta no alarma. Que salgan
// por turno en un carrusel de dermatitis sería exactamente el tono equivocado.
for (const alarma of ['rojo', 'carmin']) {
  ok(!CANDIDATAS.includes(alarma), `"${alarma}" no entra: es el color de la alarma`);
}

// Los ocho neutros funden entre diez y catorce de los diecisiete íconos. Un
// carrusel repartido a un neutro saldría sin ícono visible y nadie sabría por
// qué. Ver el token.
for (const neutro of ['piedra', 'gris', 'zinc', 'neutro', 'topo', 'malva', 'niebla', 'oliva']) {
  ok(!CANDIDATAS.includes(neutro), `"${neutro}" tampoco: sobre neutro los íconos se funden`);
}

ok(CANDIDATAS.length === 15, `quedan ${CANDIDATAS.length} en el reparto`);

// Y las diez con regla siguen ahí: el reparto no puede quitarle candidatas al
// modelo, solo añadirlas para cuando no elige.
const conRegla = NOMBRES_PALETA.filter((n) => paletas[n].automatica);
ok(
  conRegla.every((n) => CANDIDATAS.includes(n)),
  'las diez que el modelo puede elegir están todas en el reparto',
);

/* ── casos raros ─────────────────────────────────────────────────────────── */
console.log('\nLo que no debe reventar');

ok(reparte(PALETA_POR_DEFECTO, []).paleta === CANDIDATAS[0], 'sin historial, la primera');
ok(
  repartir(PALETA_POR_DEFECTO, PALETA_POR_DEFECTO, [], []).paleta === PALETA_POR_DEFECTO,
  'sin candidatas se queda con la de por defecto en vez de devolver nada',
);
ok(
  reparte(PALETA_POR_DEFECTO, ['inventada', 'otra']).paleta !== undefined,
  'un historial con paletas que ya no existen no rompe el reparto',
);

console.log(fallos === 0 ? '\nTodo en pie.' : `\n${fallos} comprobaciones fallaron.`);
if (fallos > 0) process.exitCode = 1;
