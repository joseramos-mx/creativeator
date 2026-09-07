/**
 * lib/iconos/croma.ts — recuperar el alfa de un render sobre croma.
 *
 * Los modelos de imagen de Gemini no devuelven canal alfa: la salida es RGB
 * plano. Se les pide un fondo de color liso y el recorte se hace aquí.
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
 * aunque sea del mismo color exacto. Eso sigue igual y es lo que sostiene todo.
 *
 * ── Por qué ya no se busca "verde" ──────────────────────────────────────────
 * La versión anterior arrancaba la inundación solo donde el verde dominaba a
 * los otros dos canales por más de 140, un número elegido para no comerse un
 * objeto verde. **Y se rompió en producción con ocho íconos.** Gemini no
 * devuelve el `#00FF00` que se le pide: devuelve un verde apagado —medido,
 * `rgb(76,195,70)` y `rgb(82,177,83)`—, que se queda en 119 y 94. La
 * inundación no arrancaba, el fondo entero sobrevivía, y lo que se guardaba era
 * el objeto encima de un rectángulo verde opaco.
 *
 * Bajar el umbral era lo que el propio archivo decía que no había que hacer:
 * se comería los objetos verdes, que es el caso que lo puso ahí.
 *
 * Así que se dejó de preguntar "¿esto es verde?" y se pregunta **"¿esto es del
 * color que tiene el borde?"**. El borde es fondo por construcción —el objeto
 * va centrado y con aire— así que su color se puede medir en vez de suponerlo.
 * Con eso:
 *
 *  · da igual qué verde devuelva el modelo, y da igual que un día se pida el
 *    fondo en magenta: no hay ninguna constante de color que actualizar;
 *  · el objeto verde del centro sigue protegido, ahora por dos cosas — la
 *    conectividad y la distancia al color medido;
 *  · si el modelo ignora la instrucción y devuelve una escena opaca, el borde
 *    es la escena, se inunda casi todo y `proporcionDeFondo` lo denuncia.
 *
 * ── El derrame ─────────────────────────────────────────────────────────────
 * Es lo que casi siempre se olvida. El borde del objeto es una mezcla con el
 * fondo, y esa mezcla deja un halo que sobre el blanco del editor no se ve y
 * sobre el color de la plantilla sí. Antes se quitaba bajando el verde a mano;
 * ahora se deshace la mezcla con la fórmula que la produjo, que además vale
 * para cualquier color de fondo.
 *
 * Es una función pura sobre píxeles, así que el banco la comprueba con
 * imágenes hechas a mano y sin gastar una sola llamada.
 */

/**
 * Hasta qué distancia del color del borde se sigue considerando fondo.
 *
 * En distancia euclídea sobre RGB. Los números que tiene que separar, medidos
 * de renders de verdad: el tubo azul sobre el croma que falló está a 165 del
 * fondo, y el verde hoja del banco a 146 del croma puro. Un fondo con degradado
 * suave o ruido de compresión no se aleja de 40. El umbral va en medio y con
 * sitio de sobra por los dos lados.
 */
const TOLERANCIA = 70;

/**
 * A partir de aquí el píxel es objeto entero: ni una gota de fondo mezclada.
 *
 * Es una aproximación y conviene saber por qué. Un píxel del borde es
 * `mezcla = a·objeto + (1−a)·fondo`, así que su distancia al fondo vale
 * `a · |objeto − fondo|`: para sacar `a` de verdad haría falta saber el color
 * del objeto, que es justo lo que no se sabe. Se usa una distancia fija en su
 * lugar, calibrada con el caso del banco —un rojo `(220,60,40)` mezclado al
 * 50 % con croma verde queda a 148 del fondo, y aquí sale alfa 133—.
 *
 * El error que queda es hacia el objeto: un objeto muy claro sale un poco más
 * opaco de lo que toca. Es la dirección buena. Equivocarse hacia el fondo
 * adelgaza el ícono por los bordes, y eso sí se ve.
 */
const OPACO = 220;

/**
 * Cuánto del borde tiene que ser de un mismo color para fiarse de él.
 *
 * Si el objeto se sale del encuadre y ocupa media orilla, la mediana del borde
 * deja de ser el fondo y la inundación se comería el objeto. Por debajo de esto
 * se prefiere no recortar nada: un ícono con fondo lo caza `proporcionDeFondo`
 * y se vuelve a generar, mientras que un ícono agujereado parece correcto.
 */
const BORDE_LIMPIO = 0.6;

export type Mapa = { datos: Uint8ClampedArray | Buffer; ancho: number; alto: number };

const distancia = (
  datos: Uint8ClampedArray | Buffer,
  i: number,
  [r, g, b]: readonly number[],
): number => Math.hypot(datos[i] - r, datos[i + 1] - g, datos[i + 2] - b);

/**
 * El color del fondo, medido en el borde de la imagen.
 *
 * La mediana de cada canal y no el promedio: si un trozo del objeto toca la
 * orilla, el promedio se va hacia él y la mediana no se entera.
 *
 * Devuelve `null` cuando el borde no es de un color: ver `BORDE_LIMPIO`.
 */
export function colorDelBorde({ datos, ancho, alto }: Mapa): [number, number, number] | null {
  const canales: number[][] = [[], [], []];
  const anotar = (p: number) => {
    const i = p * 4;
    canales[0].push(datos[i]);
    canales[1].push(datos[i + 1]);
    canales[2].push(datos[i + 2]);
  };

  for (let x = 0; x < ancho; x++) {
    anotar(x);
    anotar((alto - 1) * ancho + x);
  }
  for (let y = 1; y < alto - 1; y++) {
    anotar(y * ancho);
    anotar(y * ancho + ancho - 1);
  }

  const mediana = (v: number[]) => {
    v.sort((a, b) => a - b);
    return v[Math.floor(v.length / 2)];
  };
  const color: [number, number, number] = [
    mediana(canales[0]),
    mediana(canales[1]),
    mediana(canales[2]),
  ];

  // Y ahora la comprobación que decide si esa mediana significa algo.
  let cerca = 0;
  const total = canales[0].length;
  for (let k = 0; k < total; k++) {
    const d = Math.hypot(canales[0][k] - color[0], canales[1][k] - color[1], canales[2][k] - color[2]);
    if (d <= TOLERANCIA) cerca++;
  }

  return cerca / total >= BORDE_LIMPIO ? color : null;
}

/**
 * Convierte un render sobre croma en RGBA con transparencia.
 *
 * `datos` entra y sale en RGBA de 4 canales. El alfa que traiga se ignora: lo
 * que manda es el color del borde y dónde está cada píxel.
 */
export function quitarCroma({ datos, ancho, alto }: Mapa): Uint8ClampedArray {
  const n = ancho * alto;
  const salida = new Uint8ClampedArray(n * 4);
  const fondo = colorDelBorde({ datos, ancho, alto });

  // Sin un borde de un color no se recorta nada. Devolver el render entero y
  // opaco es lo correcto: lo caza el aviso, y es preferible a agujerear el
  // objeto por haber adivinado mal cuál era el fondo.
  if (!fondo) {
    for (let p = 0; p < n; p++) {
      const i = p * 4;
      salida[i] = datos[i];
      salida[i + 1] = datos[i + 1];
      salida[i + 2] = datos[i + 2];
      salida[i + 3] = 255;
    }
    return salida;
  }

  // ── inundación desde el borde ──
  // Pila explícita y no recursión: un render de 1024×1024 desborda la pila.
  const esFondo = new Uint8Array(n);
  const pila: number[] = [];
  const meter = (p: number) => {
    if (esFondo[p] || distancia(datos, p * 4, fondo) > TOLERANCIA) return;
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
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    let alfa = 255;

    if (esFondo[p]) {
      alfa = 0;
    } else if (tocaFondo(esFondo, p, ancho, alto)) {
      // Solo el borde recibe alfa parcial. El interior del objeto se queda
      // entero aunque sea del color del fondo: la inundación ya decidió.
      const d = distancia(datos, i, fondo);
      if (d <= TOLERANCIA) alfa = 0;
      else if (d < OPACO) alfa = Math.round((255 * (d - TOLERANCIA)) / (OPACO - TOLERANCIA));
    }

    /*
     * Deshacer la mezcla, no taparla.
     *
     * El píxel del borde es `mezcla = a·objeto + (1−a)·fondo`, así que el color
     * de verdad sale despejando. Antes esto se hacía bajando el canal verde a
     * mano, que funcionaba solo con croma verde; la fórmula vale para
     * cualquier color y además acierta el tono en vez de aproximarlo.
     */
    for (let c = 0; c < 3; c++) {
      salida[i + c] =
        alfa === 255 || alfa === 0
          ? datos[i + c]
          : Math.round((datos[i + c] - ((255 - alfa) / 255) * fondo[c]) / (alfa / 255));
    }
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
 * Sirve de aviso: si sale casi 0, el modelo ignoró la instrucción del fondo y
 * lo que se guardaría es un cuadrado opaco. Si sale casi 1, no dibujó nada. Los
 * dos casos hay que cazarlos **antes** de escribir el archivo, porque un ícono
 * así no se nota hasta que está puesto en un slide — y ahí ya está en la
 * librería, y el siguiente carrusel que pida ese concepto lo reutiliza.
 */
export function proporcionDeFondo(rgba: Uint8ClampedArray): number {
  let transparentes = 0;
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i] === 0) transparentes++;
  return transparentes / (rgba.length / 4);
}

/**
 * Cuánta orilla queda opaca después de recortar, de 0 a 1.
 *
 * **Es la comprobación que faltaba**, y la que habría evitado los ocho íconos
 * con el rectángulo verde. `proporcionDeFondo` mide *cuánto* se quitó, y por
 * eso no los cazaba: en esos renders no se quitó nada, pero la imagen traía
 * bandas transparentes arriba y abajo por venir en 16:9, así que la proporción
 * salía razonable y el aviso no saltaba.
 *
 * Esto mide otra cosa: **si lo que quedó llega hasta el borde**. Un ícono bien
 * recortado es un objeto centrado con aire alrededor, así que ni un píxel opaco
 * debería tocar la orilla. Si la toca, solo puede ser por dos motivos, y los
 * dos son un ícono que no sirve: el fondo sigue ahí, o el objeto está cortado
 * por el encuadre.
 *
 * Se mide en proporción y no como un sí o un no porque un píxel suelto de
 * antialias en la esquina no es motivo para tirar un render que costó dinero.
 */
export function orillaOpaca({ datos, ancho, alto }: Mapa): number {
  let opacos = 0;
  let total = 0;
  const mirar = (p: number) => {
    total++;
    if (datos[p * 4 + 3] > 8) opacos++;
  };

  for (let x = 0; x < ancho; x++) {
    mirar(x);
    mirar((alto - 1) * ancho + x);
  }
  for (let y = 1; y < alto - 1; y++) {
    mirar(y * ancho);
    mirar(y * ancho + ancho - 1);
  }

  return total === 0 ? 0 : opacos / total;
}
