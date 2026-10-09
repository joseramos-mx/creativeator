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
 * Cuánto puede cambiar el color entre dos píxeles vecinos del fondo.
 *
 * La inundación crece por **parecido local** y no solo por distancia al color
 * del borde, y eso resuelve un caso que apareció en producción: Gemini no
 * siempre devuelve un fondo liso. En `cold-compress-cloth` devolvió blanco en
 * el centro y verde en las orillas, con un degradado entre los dos —medido:
 * `(196,255,205)`, `(153,255,162)`, `(73,216,96)`—. Contra la mediana del borde,
 * que salió blanca, ese verde está a 245 y no se inundaba nunca.
 *
 * Por parecido local sí: un degradado se recorre paso a paso. Y el borde de un
 * objeto no, porque en estos renders 3D es un salto mucho mayor que esto.
 *
 * **Era 16, y se comía objetos claros.** Un cajón blanco con la orilla suave
 * —una rampa de doce píxeles del verde al blanco, que Gemini dibuja así a
 * menudo— avanza unos 15 por píxel: la inundación subía por la rampa y vaciaba
 * el objeto entero, y quedaban solo las piezas de color de encima. Un fondo con
 * degradado de verdad cambia mucho más despacio —el de `cold-compress-cloth`
 * recorre 170 en cientos de píxeles—, así que bajar el paso no lo pierde.
 */
const PASO = 6;

/**
 * Lo que le queda del tono del fondo a un píxel para que el avance por
 * parecido local siga por él: una fracción de lo que el canal dominante del
 * fondo le saca a los otros dos (en el verde de Gemini, 195 − 76 = 119).
 *
 * Es el otro freno de lo mismo. El degradado de fondo sigue siendo verdoso
 * hasta su parte más clara —`(196,255,205)` le saca 50 al resto—; un objeto
 * blanco o gris con un reflejo verde encima se queda muy por debajo, así que
 * por ahí la inundación ya no entra aunque la orilla sea suave.
 */
const TONO = 0.3;

/**
 * Lo cerca del fondo que tiene que estar un hueco encerrado para irse.
 *
 * La inundación entra por el borde, así que **no puede alcanzar el fondo que el
 * objeto rodea**: el agujero de un aro, el hueco del asa de una taza. En
 * `hoop-earring` eso dejó el verde dentro del aro, y en el carrusel se ve.
 *
 * Muy estrecho a propósito, y esa estrechez es la que protege lo que la
 * conectividad protegía: un objeto verde de verdad está *renderizado*, con su
 * sombreado y su brillo, así que sus píxeles se apartan del color plano del
 * fondo mucho más que esto. El verde hoja del banco está a 146 del croma puro y
 * a 56 del verde apagado de Gemini; el fondo que asoma por un agujero está a
 * cero, porque es literalmente el mismo fondo.
 */
const INTERIOR = 30;

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
  let mirados = 0;

  /*
   * Los píxeles ya transparentes no cuentan.
   *
   * Un render recién llegado de Gemini no tiene alfa y esto no cambia nada.
   * Pero a esta misma función se le pasan íconos **ya recortados** —la
   * reparación de scripts/recortar-iconos.mjs lo hace—, y ahí la orilla es
   * transparente con RGB en negro. Contándola, la mediana salía negra y el
   * recorte se comía las partes oscuras del objeto creyendo que eran fondo.
   */
  const anotar = (p: number) => {
    mirados++;
    const i = p * 4;
    if (datos[i + 3] < 8) return;
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

  // Si la orilla ya es casi toda transparente, a esta imagen ya le quitaron el
  // fondo: no hay nada que medir y nada que recortar.
  if (canales[0].length / mirados < BORDE_LIMPIO) return null;

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
  for (let k = 0; k < canales[0].length; k++) {
    const d = Math.hypot(canales[0][k] - color[0], canales[1][k] - color[1], canales[2][k] - color[2]);
    if (d <= TOLERANCIA) cerca++;
  }

  return cerca / mirados >= BORDE_LIMPIO ? color : null;
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

  /*
   * Sin un borde de un color no se recorta nada, y la imagen sale **como
   * entró**, con el alfa que traía.
   *
   * Antes salía toda opaca, que era destructivo por partida doble: a un render
   * sin fondo reconocible lo dejaba igual —bien— pero a un ícono ya recortado
   * le borraba la transparencia que ya tenía. Es preferible devolverlo intacto:
   * lo caza `orillaOpaca`, y adivinar cuál era el fondo agujerea el objeto.
   */
  if (!fondo) {
    for (let p = 0; p < n; p++) {
      const i = p * 4;
      salida[i] = datos[i];
      salida[i + 1] = datos[i + 1];
      salida[i + 2] = datos[i + 2];
      salida[i + 3] = datos[i + 3];
    }
    return salida;
  }

  /*
   * ── inundación desde el borde ──
   *
   * Crece por dos motivos y basta con uno: que el píxel se parezca al color del
   * borde, o que se parezca **al vecino por el que se llegó**. Lo segundo es lo
   * que recorre un fondo con degradado o con dos tonos, que es lo que Gemini
   * devuelve a veces; lo primero es lo que le deja saltar el ruido de
   * compresión sin quedarse atascado.
   *
   * El borde de un objeto para la inundación porque en un render 3D es un salto
   * de color mucho mayor que `PASO`.
   *
   * Pila explícita y no recursión: un render de 1024×1024 desborda la pila.
   */
  const esFondo = new Uint8Array(n);
  const pila: number[] = [];

  // El canal que manda en el fondo y cuánto le saca a los otros dos. Con un
  // fondo neutro —blanco, gris— no hay tono que seguir y el freno no aplica.
  const dominante = fondo.indexOf(Math.max(...fondo));
  const exceso = (i: number) =>
    datos[i + dominante] - Math.max(...[0, 1, 2].filter((c) => c !== dominante).map((c) => datos[i + c]));
  const excesoDelFondo = fondo[dominante] - Math.max(...fondo.filter((_, c) => c !== dominante));
  const conTono = (i: number) => excesoDelFondo < 40 || exceso(i) >= TONO * excesoDelFondo;

  const meter = (p: number, desde: number | null) => {
    if (esFondo[p]) return;
    const i = p * 4;

    /*
     * La semilla y el avance no piden lo mismo, y la diferencia importa.
     *
     * **Sembrar** solo se hace donde el píxel se parece al color medido del
     * borde. Sembrar la orilla entera parecía razonable —"el objeto va
     * centrado, la orilla es fondo"— y se comía objetos: en un ícono que ya
     * está recortado la orilla es el contorno del objeto, y el avance por
     * parecido local entraba por ahí y lo vaciaba desde fuera.
     *
     * **Avanzar** sí se hace por parecido al vecino, y eso es lo que recorre un
     * fondo con degradado o con dos tonos. El borde de un objeto lo para,
     * porque en un render 3D es un salto mucho mayor que `PASO`.
     */
    const vale =
      desde === null
        ? distancia(datos, i, fondo) <= TOLERANCIA
        : distancia(datos, i, fondo) <= TOLERANCIA ||
          (conTono(i) &&
            Math.hypot(
              datos[i] - datos[desde * 4],
              datos[i + 1] - datos[desde * 4 + 1],
              datos[i + 2] - datos[desde * 4 + 2],
            ) <= PASO);

    if (!vale) return;
    esFondo[p] = 1;
    pila.push(p);
  };

  for (let x = 0; x < ancho; x++) {
    meter(x, null);
    meter((alto - 1) * ancho + x, null);
  }
  for (let y = 0; y < alto; y++) {
    meter(y * ancho, null);
    meter(y * ancho + ancho - 1, null);
  }

  while (pila.length) {
    const p = pila.pop()!;
    const x = p % ancho;
    const y = (p - x) / ancho;
    if (x > 0) meter(p - 1, p);
    if (x < ancho - 1) meter(p + 1, p);
    if (y > 0) meter(p - ancho, p);
    if (y < alto - 1) meter(p + ancho, p);
  }

  /*
   * ── el fondo que el objeto encierra ──
   *
   * Lo que la inundación no puede alcanzar por venir de fuera: el agujero de un
   * aro, el hueco de un asa. Se acepta solo si es **casi exactamente** el color
   * del fondo, que es lo que distingue "el mismo fondo asomando" de "una parte
   * verde del objeto", porque la parte del objeto está renderizada con su
   * sombreado y el fondo es plano. Ver `INTERIOR`.
   */
  for (let p = 0; p < n; p++) {
    if (!esFondo[p] && distancia(datos, p * 4, fondo) <= INTERIOR) esFondo[p] = 1;
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
