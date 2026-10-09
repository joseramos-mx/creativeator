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

import { quitarCroma, proporcionDeFondo, orillaOpaca, colorDelBorde } from '../lib/iconos/croma.ts';

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
// Un lienzo de un solo color es un render en el que el modelo no dibujó nada.
// Antes esto no recortaba y el aviso decía "puede haber salido un cuadrado
// opaco"; ahora se inunda entero y el aviso dice "no dibujó nada", que es lo
// que de verdad pasó. Lo que importa es que los dos caminos lo cacen.
const sinCroma = lienzo(20, () => [250, 250, 250]);
ok(proporcionDeFondo(quitarCroma(sinCroma)) === 1, 'un lienzo de un solo color se caza como vacío');
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

/* ── el verde que devuelve Gemini de verdad ──────────────────────────────── */
console.log('\nEl croma que llega, no el que se pide');

/*
 * Los ocho íconos que se guardaron con un rectángulo verde encima.
 *
 * Se le pide `#00FF00` y devuelve un verde apagado. La versión anterior
 * arrancaba la inundación solo si el verde dominaba a los otros canales por más
 * de 140; estos se quedan en 119 y 94, así que no arrancaba y el fondo entero
 * sobrevivía. Son los valores medidos de los archivos guardados.
 */
const AZUL = [110, 140, 220];

for (const [nombre, fondo] of [
  ['el de moisturizer-tube', [76, 195, 70]],
  ['el de stopwatch', [82, 177, 83]],
  ['uno todavía más apagado', [95, 160, 95]],
  ['el croma puro, que sigue funcionando', [0, 255, 0]],
]) {
  const conTubo = lienzo(20, (x, y) => (x >= 7 && x < 13 && y >= 5 && y < 15 ? AZUL : fondo));
  const r = quitarCroma(conTubo);
  ok(pixel(r, 20, 1, 1)[3] === 0, `${nombre}: el fondo se va`);
  ok(pixel(r, 20, 10, 10)[3] === 255, `  y el objeto azul se queda entero`);
}

/* ── el fondo que el objeto encierra ─────────────────────────────────────── */
console.log('\nEl agujero del aro');

/*
 * La inundación entra por el borde, así que no puede alcanzar el fondo que el
 * objeto rodea. En `hoop-earring` eso dejó el verde dentro del aro y salió en
 * el carrusel: el ícono estaba "bien recortado" por fuera y con un disco verde
 * en medio.
 *
 * Un anillo es el caso mínimo que lo reproduce.
 */
const anillo = lienzo(21, (x, y) => {
  const d = Math.hypot(x - 10, y - 10);
  return d >= 5 && d <= 8 ? [230, 120, 110] : [0, 255, 0];
});
const sinAgujero = quitarCroma(anillo);

ok(pixel(sinAgujero, 21, 1, 1)[3] === 0, 'el fondo de fuera se va, como siempre');
ok(pixel(sinAgujero, 21, 10, 4)[3] === 255, 'el aro se queda entero');
ok(pixel(sinAgujero, 21, 10, 10)[3] === 0, 'y el agujero de en medio también se va');

/*
 * Y lo que protege eso de comerse un objeto: el hueco vale porque es
 * **exactamente** el color plano del fondo. Un objeto verde de verdad está
 * renderizado, con su sombreado, y se aparta mucho más que `INTERIOR`.
 */
const anilloConDisco = lienzo(21, (x, y) => {
  const d = Math.hypot(x - 10, y - 10);
  if (d >= 5 && d <= 8) return [230, 120, 110];
  // Un verde hoja sombreado dentro del aro: es objeto, no fondo.
  if (d < 5) return [70, 140, 60];
  return [0, 255, 0];
});
const conDisco = quitarCroma(anilloConDisco);
ok(pixel(conDisco, 21, 1, 1)[3] === 0, 'con un disco verde dentro, el fondo de fuera sigue yéndose');
ok(
  pixel(conDisco, 21, 10, 10)[3] === 255,
  'y el disco se queda: no es el color plano del fondo, es un verde de objeto',
);

/* ── la orilla, que es lo que faltaba comprobar ──────────────────────────── */
console.log('\nLa orilla opaca: la barrera que faltaba');

/*
 * `proporcionDeFondo` no cazaba el fallo, y por eso los ocho llegaron a la
 * librería: el render venía en 16:9 dentro de un cuadrado, así que las bandas
 * transparentes de arriba y abajo daban una proporción razonable aunque no se
 * hubiera quitado nada. Lo que sí los distingue es si lo que queda **llega
 * hasta el borde**.
 */
const bienRecortado = quitarCroma(
  lienzo(20, (x, y) => (x >= 7 && x < 13 && y >= 5 && y < 15 ? AZUL : [0, 255, 0])),
);
ok(
  orillaOpaca({ datos: bienRecortado, ancho: 20, alto: 20 }) === 0,
  'un ícono bien recortado no toca la orilla por ningún lado',
);

// El caso de verdad: el fondo no se quitó, así que hay opaco hasta el borde.
ok(
  orillaOpaca({ datos: lienzo(20, () => [76, 195, 70]).datos, ancho: 20, alto: 20 }) === 1,
  'y un render con el fondo puesto la ocupa entera',
);

// El otro caso que hay que rechazar: el objeto sale cortado por el encuadre.
const cortado = quitarCroma(lienzo(20, (x) => (x >= 7 ? AZUL : [0, 255, 0])));
ok(
  orillaOpaca({ datos: cortado, ancho: 20, alto: 20 }) > 0.02,
  'un objeto que se sale del cuadro también se caza',
);

/* ── de dónde sale el color del fondo ────────────────────────────────────── */
console.log('\nEl color del fondo se mide, no se supone');

ok(
  colorDelBorde(lienzo(20, () => [76, 195, 70]))?.join() === '76,195,70',
  'un borde de un color se reconoce tal cual',
);

// Un trozo de objeto en la orilla no puede mover la medida: por eso es la
// mediana y no el promedio.
const conMordisco = lienzo(20, (x, y) => (y === 0 && x < 5 ? [220, 60, 40] : [76, 195, 70]));
ok(
  colorDelBorde(conMordisco)?.join() === '76,195,70',
  'y un mordisco del objeto en la orilla no la mueve',
);

// Si el borde no es de un color, no se recorta nada: es preferible un ícono con
// fondo —que la orilla caza— a uno agujereado, que parece correcto.
const bordeSucio = lienzo(20, (x, y) => ((x + y) % 2 ? [220, 60, 40] : [76, 195, 70]));
ok(colorDelBorde(bordeSucio) === null, 'un borde de dos colores no se da por bueno');
ok(
  proporcionDeFondo(quitarCroma(bordeSucio)) === 0,
  '  y entonces no se recorta nada, en vez de adivinar',
);

/* ── la orilla suave ──────────────────────────────────────────────────── */
console.log('\nUn objeto claro con la orilla suave');

/*
 * El cajón de medicinas que salió vacío: Gemini dibujó el cajón blanco con la
 * orilla en rampa —del verde al blanco en una docena de píxeles— y la
 * inundación, que avanzaba por parecido entre vecinos, subió por la rampa y se
 * comió el cajón entero. Quedaron solo las cajitas de color de dentro.
 */
{
  const L = 120;
  const FONDO = [76, 195, 70];
  const mezcla = (a, b, t) => a.map((v, k) => Math.round(v * (1 - t) + b[k] * t));
  for (const [rampa, color, nombre] of [
    [16, [230, 236, 230], 'blanco con una rampa de 16 px'],
    [20, [215, 232, 214], 'gris con reflejo verde y una rampa de 20 px'],
  ]) {
    const img = lienzo(L, (x, y) => {
      const fuera = Math.max(0, 30 - x, x - 90, 30 - y, y - 90);
      return fuera === 0 ? color : fuera >= rampa ? FONDO : mezcla(color, FONDO, fuera / rampa);
    });
    const r = quitarCroma(img);
    let opacos = 0;
    for (let y = 35; y < 85; y++) for (let x = 35; x < 85; x++) if (pixel(r, L, x, y)[3] === 255) opacos++;
    ok(opacos === 50 * 50, `${nombre}: el objeto se queda entero (${Math.round((opacos / 2500) * 100)} %)`);
    ok(pixel(r, L, 2, 2)[3] === 0, '  y el fondo se va');
  }

  // Y lo que el paso grande cuidaba: un fondo con degradado, blanco al centro
  // y verde en las orillas, se sigue recorriendo entero.
  const deg = lienzo(L, (x, y) => {
    const h = Math.hypot(x - 60, y - 60);
    return h < 12 ? ROJO : mezcla([196, 255, 205], [73, 216, 96], Math.min(1, h / 85));
  });
  const r = quitarCroma(deg);
  ok(pixel(r, L, 60, 30)[3] === 0, 'un fondo con degradado se va también en su parte clara');
  ok(pixel(r, L, 60, 60)[3] === 255, '  y el objeto del centro se queda');
}

console.log(fallos === 0 ? '\nTodo en pie.' : `\n${fallos} comprobaciones fallaron.`);
if (fallos > 0) process.exitCode = 1;
