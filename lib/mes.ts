/**
 * lib/mes.ts — lo que se puede comprobar de una tanda antes de pagarla.
 *
 * Redactar un carrusel cuesta una llamada larga y unos dos minutos y medio.
 * Redactar ocho cuesta veinte minutos y ocho llamadas. Y el error que más caro
 * sale en una tanda no es que un carrusel salga flojo —eso se ve y se tira—,
 * sino que **dos temas de la misma tanda sean el mismo carrusel con otro
 * título**: se pagan los dos, se revisan los dos, y el parecido se nota al
 * final, cuando ya están escritos.
 *
 * El prompt ya pide temas distintos entre sí y el modelo suele hacerle caso.
 * "Suele" es el problema: con tres propuestas el ojo lo caza al leerlas, con
 * doce nadie las compara todas contra todas. Así que se compara aquí, con
 * números, **antes** del bucle caro. Es la forma de siempre en este proyecto:
 * la instrucción orienta, la comprobación decide.
 *
 * Sin `server-only`, sin alias `@/` y sin un solo import, por lo mismo que
 * `lib/temas.ts`: el banco tiene que poder cargarlo tal cual desde node.
 */

/**
 * Las palabras que no distinguen un tema de otro.
 *
 * Sin quitarlas, "Ronchas por el uniforme" y "Ronchas por el frío" comparten
 * "por" y "el" y salen parecidas por la gramática, no por el tema.
 */
const VACIAS = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas',
  'en', 'y', 'o', 'a', 'al', 'con', 'por', 'para', 'sin', 'sobre', 'entre',
  'hasta', 'desde', 'tras', 'que', 'se', 'su', 'sus', 'lo', 'le', 'les',
  'es', 'son', 'esta', 'este', 'esto', 'esa', 'ese', 'eso', 'esas', 'esos',
  'mi', 'mis', 'tu', 'tus', 'no', 'si', 'mas', 'ya', 'muy', 'como', 'cuando',
  'donde', 'porque', 'pero', 'todo', 'toda', 'todos', 'todas', 'cada',
  'guia',
  // Los verbos de relleno de un titular. "Qué hacer cuando salen ronchas" y
  // "Qué hacer con la piel seca" no comparten tema por compartir "hacer".
  'hay', 'ser', 'estar', 'estan', 'ir', 'van', 'va', 'viene', 'vienen',
  'hacer', 'hace', 'hacen', 'tener', 'tiene', 'tienen', 'poder', 'puede',
  'pueden', 'deber', 'debe', 'deben', 'saber', 'sabe', 'ver', 'dar', 'poner',
  'salen', 'sale', 'usar', 'usa',
]);

/**
 * Las palabras que sí dicen de qué va el tema.
 *
 * Se quitan los acentos porque "atópica" y "atopica" son la misma palabra para
 * esto, y las de dos letras o menos porque nunca son el tema.
 */
export function contenido(tema: string): Set<string> {
  return new Set(
    tema
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .split(/[^a-z0-9]+/)
      .filter((p) => p.length > 2 && !VACIAS.has(p)),
  );
}

/**
 * Cuánto se parecen dos temas, de 0 a 1.
 *
 * Se divide entre el **más corto** de los dos y no entre la unión, a propósito:
 * "Impétigo" y "Cómo se contagia el impétigo en la escuela" comparten todo lo
 * que tiene el primero. Contra la unión eso daría 0,2 y pasaría; contra el más
 * corto da 1 y se caza, que es lo correcto — el segundo se come al primero.
 */
export function parecido(a: string, b: string): number {
  const x = contenido(a);
  const y = contenido(b);
  if (x.size === 0 || y.size === 0) return 0;

  let comunes = 0;
  for (const p of x) if (y.has(p)) comunes++;

  // Con una sola palabra en común no alcanza: "dermatitis atópica" y
  // "dermatitis del pañal" comparten "dermatitis" y son dos carruseles.
  if (comunes < 2) return 0;

  return comunes / Math.min(x.size, y.size);
}

/**
 * Dos umbrales, porque en medio hay una franja que esto no puede resolver.
 *
 * El banco encontró el caso: "Protector solar en niños" y "Protector solar y
 * dermatitis" comparten dos de tres palabras y dan 0,67 — y son dos carruseles
 * distintos. Pero "Alergia al polen en primavera" y "Alergia al polen en marzo"
 * dan exactamente lo mismo, 0,67, y son uno solo. Miden igual porque **son**
 * iguales de forma: dos palabras compartidas, una distinta. Lo que los separa
 * es si la palabra distinta cambia lo que se aprende, y eso no lo dice contar
 * palabras.
 *
 * La causa es que un término de dos palabras —"protector solar", "dermatitis
 * atópica", "prueba de parche"— cuenta como dos coincidencias siendo un solo
 * concepto. Se podría atacar con un diccionario de términos, pero sería otra
 * lista que mantener a mano y que se queda vieja sola.
 *
 * Así que se parte en dos:
 *
 *  · de `IDENTICOS` para arriba **se tira**. Ahí no hay duda: son el mismo
 *    título reordenado, y los cinco casos del banco dan 100 %.
 *  · entre `PARECIDOS` e `IDENTICOS` **se escribe y se avisa**. Que se parecen
 *    es un hecho medido y se dice; cuál de los dos sobra es criterio editorial,
 *    y esa decisión no es de un umbral.
 */
export const PARECIDOS = 0.6;
export const IDENTICOS = 0.85;

export type Choque = {
  /** La posición del tema dentro de lo que propuso el modelo. */
  indice: number;
  tema: string;
  /** El tema con el que choca. */
  contra: string;
  donde: 'ya publicado' | 'la misma tanda';
  parecido: number;
  /** `tirar` no se escribe; `avisar` se escribe y se dice a quién se parece. */
  accion: 'tirar' | 'avisar';
};

/**
 * Los temas de la tanda que chocan con algo.
 *
 * Devuelve los que chocan y no los que sobreviven, porque el script tiene que
 * poder **decir cuál tiró y contra qué**. Una tanda que calladamente escribe
 * siete en vez de ocho es peor que una que explica por qué.
 *
 * Contra lo ya publicado el choque lo gana el publicado, siempre. Dentro de la
 * tanda lo gana el primero, que es el que el modelo ordenó antes. Y un tema
 * que solo se avisa **sigue contando**: el siguiente puede chocar con él.
 */
export function revisarTanda(propuestos: string[], publicados: string[]): Choque[] {
  const choques: Choque[] = [];
  const aceptados: string[] = [];

  for (const [indice, tema] of propuestos.entries()) {
    // El más parecido de la lista, no el primero que pase: si un tema roza dos,
    // el que hay que enseñar es contra el que más se parece.
    const masParecido = (lista: string[], donde: Choque['donde']) => {
      let peor: Choque | null = null;
      for (const otro of lista) {
        const cuanto = parecido(tema, otro);
        if (cuanto < PARECIDOS) continue;
        if (peor && cuanto <= peor.parecido) continue;
        peor = {
          indice, tema, contra: otro, donde,
          parecido: cuanto,
          accion: cuanto >= IDENTICOS ? 'tirar' : 'avisar',
        };
      }
      return peor;
    };

    // Lo publicado se mira primero: un choque contra el feed pesa más que uno
    // contra un tema que todavía no existe.
    const choque =
      masParecido(publicados, 'ya publicado') ?? masParecido(aceptados, 'la misma tanda');

    if (choque) choques.push(choque);
    // Aunque solo se avise, entra: el siguiente tema puede chocar con este.
    if (!choque || choque.accion === 'avisar') aceptados.push(tema);
  }

  return choques;
}
