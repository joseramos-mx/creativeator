/**
 * lib/iconos/croma.ts — recuperar el alfa de un render sobre verde.
 *
 * Los modelos de imagen de Gemini no devuelven canal alfa: la salida es RGB
 * plano. Se les pide fondo verde `#00FF00` y el recorte se hace aquí.
 *
 * ── Por qué no basta con mirar cada píxel ───────────────────────────────────
 * La primera versión decidía píxel a píxel: si el verde domina sobre el rojo y
 * el azul, es fondo. El banco la tumbó con un caso que no es raro en absoluto,
 * un objeto verde hoja `#468C3C`, que salía medio transparente.
 *
 * Y el problema no era el umbral. Un píxel del borde —mitad objeto rojo, mitad
 * croma— y un verde hoja saturado están a la misma distancia del verde puro:
 * `(110,158,20)` y `(70,140,60)` dan casi el mismo número. **Ninguna regla que
 * mire un píxel aislado puede separarlos**, porque aislados son el mismo color.
 *
 * Lo que sí los separa es dónde están. El fondo es una región conectada que
 * toca los bordes de la imagen; un objeto verde en el centro, no. Así que se
 * inunda desde el borde: lo que se alcanza es fondo, lo que no, es objeto,
 * aunque sea del mismo color exacto.
 *
 * Después quedan dos cosas:
 *
 *  · **El antialias.** El borde del objeto es una mezcla con el fondo, así que
 *    se le da alfa parcial en vez de recortarlo a cuchillo. Solo a los píxeles
 *    que tocan el fondo: dentro del objeto nadie tiene por qué volverse
 *    translúcido.
 *  · **El derrame**, que es lo que casi siempre se olvida. Esa mezcla deja un
 *    halo verde de uno o dos píxeles que sobre el blanco del editor no se ve y
 *    sobre el azul de la plantilla sí. Se quita bajando el verde de cada píxel
 *    hasta el mayor de sus otros dos canales.
 *
 * Es una función pura sobre píxeles, así que el banco la comprueba con
 * imágenes hechas a mano y sin gastar una sola llamada.
 */

/**
 * Cuánto tiene que dominar el verde para que la inundación siga por ahí.
 *
 * Alto a propósito. El croma puro da 255 y un fondo mal renderizado sigue
 * dando por encima de 180, mientras que los verdes de objeto se quedan
 * bastante abajo: verde hoja 70, menta 40, oliva 10. El hueco es grande y el
 * umbral va en medio, más cerca del fondo que del objeto — porque equivocarse
 * hacia el objeto agujerea el ícono, y equivocarse hacia el fondo deja un
 * borde verde que `proporcionDeFondo` denuncia enseguida.
 *
 * El límite conocido está en el banco: un verde muy saturado y muy oscuro
 * —del tipo `#14B43C`— sí se inunda. Si algún día hace falta uno así, la
 * salida no es bajar esto: es pedir el fondo en otro color.
 */
const VERDE_DE_FONDO = 140;

/** El tramo de alfa parcial en el borde, medido en dominancia del verde. */
const OBJETO = 40;
const FONDO = 90;

export type Mapa = { datos: Uint8ClampedArray | Buffer; ancho: number; alto: number };

/** Cuánto sobresale el verde respecto al más alto de los otros dos canales. */
function exceso(datos: Uint8ClampedArray | Buffer, i: number): number {
  return datos[i + 1] - Math.max(datos[i], datos[i + 2]);
}

/**
 * Convierte RGB(A) sobre verde en RGBA con transparencia.
 *
 * `datos` entra y sale en RGBA de 4 canales. El alfa que traiga se ignora: lo
 * que manda es el verde y dónde está.
 */
export function quitarCroma({ datos, ancho, alto }: Mapa): Uint8ClampedArray {
  const n = ancho * alto;
  const esFondo = new Uint8Array(n);

  // ── inundación desde el borde ──
  // Pila explícita y no recursión: un render de 1024×1024 desborda la pila.
  const pila: number[] = [];
  const meter = (p: number) => {
    if (esFondo[p] || exceso(datos, p * 4) < VERDE_DE_FONDO) return;
    esFondo[p] = 1;
    pila.push(p);
  };

  for (let x = 0; x < ancho; x++) {
    meter(x);
    meter((alto - 1) * ancho + x);
  }
  for (let y = 0; y < alto; y++) {
    meter(y * ancho);
    meter(y * ancho + ancho - 1);
  }

  while (pila.length) {
    const p = pila.pop()!;
    const x = p % ancho;
    const y = (p - x) / ancho;
    if (x > 0) meter(p - 1);
    if (x < ancho - 1) meter(p + 1);
    if (y > 0) meter(p - ancho);
    if (y < alto - 1) meter(p + ancho);
  }

  // ── alfa y desderrame ──
  const salida = new Uint8ClampedArray(n * 4);

  for (let p = 0; p < n; p++) {
    const i = p * 4;
    const r = datos[i];
    const g = datos[i + 1];
    const b = datos[i + 2];

    let alfa = 255;
    if (esFondo[p]) {
      alfa = 0;
    } else if (tocaFondo(esFondo, p, ancho, alto)) {
      // Solo el borde recibe alfa parcial. El interior del objeto se queda
      // entero aunque sea verde: la inundación ya decidió que no es fondo.
      const e = exceso(datos, i);
      if (e >= FONDO) alfa = 0;
      else if (e > OBJETO) alfa = Math.round(255 * (1 - (e - OBJETO) / (FONDO - OBJETO)));
    }

    salida[i] = r;
    salida[i + 1] = alfa === 255 ? g : Math.min(g, Math.max(r, b));
    salida[i + 2] = b;
    salida[i + 3] = alfa;
  }

  return salida;
}

function tocaFondo(esFondo: Uint8Array, p: number, ancho: number, alto: number): boolean {
  const x = p % ancho;
  const y = (p - x) / ancho;
  if (x > 0 && esFondo[p - 1]) return true;
  if (x < ancho - 1 && esFondo[p + 1]) return true;
  if (y > 0 && esFondo[p - ancho]) return true;
  if (y < alto - 1 && esFondo[p + ancho]) return true;
  return false;
}

/**
 * Cuánto del render era fondo, de 0 a 1.
 *
 * Sirve de aviso: si sale casi 0, el modelo ignoró la instrucción del fondo
 * verde y lo que se guardaría es un cuadrado opaco. Si sale casi 1, no dibujó
 * nada. Los dos casos hay que cazarlos antes de escribir el archivo, porque un
 * ícono así no se nota hasta que está puesto en un slide.
 */
export function proporcionDeFondo(rgba: Uint8ClampedArray): number {
  let transparentes = 0;
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i] === 0) transparentes++;
  return transparentes / (rgba.length / 4);
}
