/**
 * scripts/banco-croma.mjs — `npm run banco-croma`
 *
 * El banco del recorte por croma, sobre imágenes hechas a mano. Sin llamadas.
 *
 * Recortar el fondo verde de un render es de las cosas que parecen funcionar
 * hasta que se ven sobre el fondo azul de la plantilla: el halo verde del
 * antialias no se nota contra el blanco del editor y sí contra el azul del
 * slide. Por eso se mide aquí, en píxeles, y no mirando el PNG.
 *
 * Los casos que importan son tres, y ninguno se puede comprobar a ojo:
 * que el verde se vaya, que el objeto no pierda sus propias partes verdes, y
 * que el borde no arrastre derrame.
 */

import { quitarCroma, proporcionDeFondo } from '../lib/iconos/croma.ts';

let fallos = 0;
const ok = (bien, texto) => {
  console.log(`  ${bien ? 'OK  ' : 'FALLA'} ${texto}`);
  if (!bien) fallos++;
};

/** Una imagen de N×N píxeles a partir de una función (x, y) → [r, g, b]. */
function lienzo(lado, pintar) {
  const datos = new Uint8ClampedArray(lado * lado * 4);
  for (let y = 0; y < lado; y++) {
    for (let x = 0; x < lado; x++) {
      const i = (y * lado + x) * 4;
      const [r, g, b] = pintar(x, y);
      datos[i] = r;
      datos[i + 1] = g;
      datos[i + 2] = b;
      datos[i + 3] = 255;
    }
  }
  return { datos, ancho: lado, alto: lado };
}

const pixel = (rgba, lado, x, y) => {
  const i = (y * lado + x) * 4;
  return [rgba[i], rgba[i + 1], rgba[i + 2], rgba[i + 3]];
};

/* ── el fondo se va ──────────────────────────────────────────────────────── */
console.log('\nEl fondo se va y el objeto se queda');

const VERDE = [0, 255, 0];
const ROJO = [220, 60, 40];

// Un cuadrado rojo en medio de verde croma.
const conObjeto = lienzo(20, (x, y) => (x >= 6 && x < 14 && y >= 6 && y < 14 ? ROJO : VERDE));
const recortado = quitarCroma(conObjeto);

ok(pixel(recortado, 20, 1, 1)[3] === 0, 'la esquina de fondo queda transparente');
ok(pixel(recortado, 20, 10, 10)[3] === 255, 'el centro del objeto queda opaco');
ok(
  Math.abs(proporcionDeFondo(recortado) - (400 - 64) / 400) < 0.01,
  `el fondo es el ${Math.round(proporcionDeFondo(recortado) * 100)} % de la imagen`,
);

// Un render que ignoró la instrucción y salió sobre blanco: todo opaco.
const sinCroma = lienzo(20, () => [250, 250, 250]);
ok(proporcionDeFondo(quitarCroma(sinCroma)) === 0, 'un render sin fondo verde no recorta nada');
// Y uno donde no dibujó nada.
ok(proporcionDeFondo(quitarCroma(lienzo(20, () => VERDE))) === 1, 'y uno vacío recorta todo');

/* ── el objeto puede ser verde ───────────────────────────────────────────── */
console.log('\nUn objeto verde no es fondo');

// Es la razón de medir dominancia y no distancia al color: un ícono de una
// planta, una toalla verde o el propio aro de una lupa verde tienen verde, y un
// umbral por cercanía a #00FF00 se los comería a medias.
for (const [nombre, color] of [
  ['verde hoja', [70, 140, 60]],
  ['verde menta', [150, 220, 180]],
  ['verde oliva', [120, 130, 60]],
  ['verde botella', [20, 90, 50]],
]) {
  const conVerde = lienzo(10, (x, y) => (x >= 3 && x < 7 && y >= 3 && y < 7 ? color : VERDE));
  const r = quitarCroma(conVerde);
  ok(pixel(r, 10, 5, 5)[3] === 255, `un objeto ${nombre} se conserva entero`);
  ok(pixel(r, 10, 0, 0)[3] === 0, `  y su fondo croma se va igual`);
}

/* ── el derrame del borde ────────────────────────────────────────────────── */
console.log('\nEl derrame del antialias');

// El píxel de borde es una mezcla del objeto con el fondo: rojo a medias con
// verde croma. Sin desderrame se queda con un verde que sobre el azul de la
// plantilla se ve como un halo.
const mezcla = [Math.round(220 / 2), Math.round((60 + 255) / 2), Math.round(40 / 2)];
const conBorde = lienzo(9, (x, y) => {
  if (x >= 3 && x < 6 && y >= 3 && y < 6) return ROJO;
  if (x >= 2 && x < 7 && y >= 2 && y < 7) return mezcla;
  return VERDE;
});
const sinDerrame = quitarCroma(conBorde);

const [br, bg, bb, ba] = pixel(sinDerrame, 9, 2, 4);
ok(ba > 0 && ba < 255, `el borde queda semitransparente (alfa ${ba})`);
ok(bg <= Math.max(br, bb), `y su verde baja a ${bg}, que no supera al rojo (${br}) ni al azul (${bb})`);
ok(mezcla[1] > Math.max(mezcla[0], mezcla[2]), `  —antes del recorte era ${mezcla[1]}, el canal dominante—`);

// Y no se toca el color de lo que se conserva entero.
const [cr, cg, cb] = pixel(sinDerrame, 9, 4, 4);
ok(
  cr === ROJO[0] && cg === ROJO[1] && cb === ROJO[2],
  'el interior del objeto no cambia de color',
);

/* ── grises y blancos ────────────────────────────────────────────────────── */
console.log('\nLo que no tiene color');

// Un ícono con partes metálicas o blancas: en un gris los tres canales son
// iguales, así que el exceso de verde es cero y tiene que conservarse entero.
for (const gris of [[255, 255, 255], [200, 200, 200], [90, 90, 90], [20, 20, 20]]) {
  const conGris = lienzo(8, (x, y) => (x >= 2 && x < 6 && y >= 2 && y < 6 ? gris : VERDE));
  ok(
    pixel(quitarCroma(conGris), 8, 4, 4)[3] === 255,
    `el gris ${gris[0]} se conserva entero`,
  );
}

console.log(fallos === 0 ? '\nTodo en pie.' : `\n${fallos} comprobaciones fallaron.`);
if (fallos > 0) process.exitCode = 1;
