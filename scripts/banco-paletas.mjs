/**
 * scripts/banco-paletas.mjs — `npm run banco-paletas`
 *
 * Que las veinticinco paletas sean la misma paleta con otro tono.
 *
 * La idea que sostiene el diseño es que **el contraste no dependa del color**:
 * si todos los fondos están a la misma luminancia, el mismo texto crema se lee
 * igual encima de cualquiera y nadie tiene que revisar carrusel por carrusel.
 * Eso es una propiedad numérica y por eso se puede comprobar aquí, en vez de
 * mirando veinticinco carruseles.
 *
 * Las tres publicadas —azul, naranja y verde— son la referencia: sus valores
 * están medidos de los carruseles reales. Las otras veintidós se derivaron para
 * dar lo mismo, y esto lo verifica.
 *
 * Corre sin red, sin navegador y sin servidor.
 */

import { paletas } from '../template/tokens.ts';

let fallos = 0;
const ok = (bien, texto) => {
  console.log(`  ${bien ? 'OK  ' : 'FALLA'} ${texto}`);
  if (!bien) fallos++;
};

const h2r = (h) => { const x = h.replace('#',''); return [0,2,4].map((i) => parseInt(x.slice(i,i+2),16)); };
const lin = (c) => { c /= 255; return c <= 0.03928 ? c/12.92 : ((c+0.055)/1.055) ** 2.4; };
const relL = (h) => { const [r,g,b] = h2r(h).map(lin); return 0.2126*r + 0.7152*g + 0.0722*b; };
const contraste = (a, b) => { const [x,y] = [relL(a), relL(b)].sort((p,q) => q-p); return (x+0.05)/(y+0.05); };

function aLab(h) {
  const [r,g,b] = h2r(h).map(lin);
  const X = (0.4124*r + 0.3576*g + 0.1805*b) / 0.95047;
  const Y = 0.2126*r + 0.7152*g + 0.0722*b;
  const Z = (0.0193*r + 0.1192*g + 0.9505*b) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787*t + 16/116);
  const [fx,fy,fz] = [f(X), f(Y), f(Z)];
  return [116*fy - 16, 500*(fx - fy), 200*(fy - fz)];
}
const dE = (a, b) => {
  const [l1,a1,b1] = aLab(a), [l2,a2,b2] = aLab(b);
  return Math.hypot(l1-l2, a1-a2, b1-b2);
};

const todas = Object.entries(paletas);
const OBJETIVO = 0.348;

/* ── la luminancia, que es toda la idea ──────────────────────────────────── */
console.log(`\nLas ${todas.length} a la misma luminancia`);

let peor = 0;
for (const [nombre, p] of todas) {
  const d = Math.abs(relL(p.fondo) - OBJETIVO);
  peor = Math.max(peor, d);
  if (d > 0.006) ok(false, `${nombre} está a ${relL(p.fondo).toFixed(3)}, fuera del objetivo ${OBJETIVO}`);
}
ok(peor <= 0.006, `ninguna se aleja más de ${peor.toFixed(4)} del objetivo ${OBJETIVO}`);

/* ── y por eso el contraste es el mismo ──────────────────────────────────── */
console.log('\nEl mismo contraste con cualquier tono');

const contrastes = todas.map(([, p]) => contraste(p.fondo, p.crema));
const min = Math.min(...contrastes), max = Math.max(...contrastes);
ok(
  max - min < 0.05,
  `la crema del título da entre ${min.toFixed(2)} y ${max.toFixed(2)} sobre las ${todas.length}`,
);

// El texto del cuerpo y la bajada son tintes claros sobre el fondo: ahí lo que
// importa es que se despeguen del fondo, no de la crema.
for (const [nombre, p] of todas) {
  const c = contraste(p.cuerpo, p.fondo);
  if (c < 2) ok(false, `el cuerpo de ${nombre} solo da ${c.toFixed(2)} sobre su fondo`);
}
ok(
  todas.every(([, p]) => contraste(p.cuerpo, p.fondo) >= 2),
  'y el cuerpo se despega del fondo en todas',
);

// La tinta del papel va sobre el papel crema, no sobre el fondo.
for (const [nombre, p] of todas) {
  const c = contraste(p.tintaPapel, p.papel);
  if (c < 7) ok(false, `la tinta del papel de ${nombre} solo da ${c.toFixed(2)}`);
}
ok(
  todas.every(([, p]) => contraste(p.tintaPapel, p.papel) >= 7),
  'la tinta del papel pasa de 7 en todas',
);

/* ── la palomita ─────────────────────────────────────────────────────────── */
console.log('\nLa palomita se ve en las veinticinco');

// Es el caso que ya existía en verde, donde la verde clara daba ΔE 11 y
// desaparecía. Con veinticinco fondos hay que comprobarlo en todos.
const flojas = todas.filter(([, p]) => dE(p.check, p.fondo) < 40);
ok(flojas.length === 0, flojas.length ? `se funde en: ${flojas.map(([n]) => n).join(', ')}` : 'ninguna se funde');
const peorCheck = todas.reduce((a, [n, p]) => (dE(p.check, p.fondo) < a[1] ? [n, dE(p.check, p.fondo)] : a), ['', 999]);
ok(true, `la más apretada es ${peorCheck[0]} con ΔE ${Math.round(peorCheck[1])}`);

/* ── la forma de la entrada ──────────────────────────────────────────────── */
console.log('\nNinguna a medias');

const CAMPOS = ['nombre', 'cuando', 'automatica', 'fondo', 'cuerpo', 'bajada', 'tintaPapel', 'check', 'velo', 'sombraIcono'];
const incompletas = todas.filter(([, p]) => CAMPOS.some((c) => p[c] === undefined));
ok(incompletas.length === 0, incompletas.length ? `faltan campos en: ${incompletas.map(([n]) => n).join(', ')}` : 'las veinticinco tienen los diez campos');

// El velo termina fundido en el fondo plano: si no, se ve el corte.
const veloMalo = todas.filter(([, p]) => !p.velo.includes(`${p.fondo} 100%`));
ok(veloMalo.length === 0, veloMalo.length ? `el velo no cierra en su fondo: ${veloMalo.map(([n]) => n).join(', ')}` : 'y el velo de todas cierra en su propio fondo');

/* ── las tres publicadas no se tocan ─────────────────────────────────────── */
console.log('\nLas tres publicadas siguen exactas');

// azul es el control de medir.py y el fondo del carrusel publicado. Si alguien
// las "mejorara" al derivar el resto, la comparación contra las capturas
// dejaría de medir el diseño y empezaría a medir el cambio de color.
for (const [nombre, fondo] of [['azul','#51A2FF'], ['naranja','#ED842F'], ['verde','#48B45D']]) {
  ok(paletas[nombre].fondo === fondo, `${nombre} sigue siendo ${fondo}`);
}

console.log(fallos === 0 ? '\nTodo en pie.' : `\n${fallos} comprobaciones fallaron.`);
if (fallos > 0) process.exitCode = 1;
