/**
 * lib/variedad.ts — que el mes no salga todo del mismo color.
 *
 * El problema, medido: el redactor elige la paleta por el tema y hace bien,
 * pero la mayoría de los temas de esta cuenta **no tienen color**. Impétigo no
 * es de ningún color; dermatitis atópica tampoco. En esos casos la respuesta
 * correcta es azul, y así está escrito en el prompt: es la respuesta, no un
 * relleno. El resultado es que doce carruseles de un mes salen con doce fondos
 * azules, y la cuadrícula del perfil se ve de un vistazo.
 *
 * Aquí no se toca ninguna asociación de verdad. Si el modelo dijo turquesa
 * porque el carrusel va de albercas, se queda turquesa. Lo único que cambia es
 * **el caso en el que no había ninguna razón**: ahí, en vez de azul siempre, se
 * reparte.
 *
 * ── Por qué no es aleatorio ─────────────────────────────────────────────────
 * Al azar, doce tiradas sobre quince colores repiten: la probabilidad de que no
 * haya ni una repetición es de aproximadamente un 20 %, y una repetición en dos
 * carruseles seguidos se ve tanto como el mes azul. Elegir **la que hace más
 * que no se usa** da el mismo efecto que se buscaba —que no se parezcan— sin
 * dejarlo a la suerte, y además es reproducible: el mismo calendario da el
 * mismo reparto, así que se puede probar.
 *
 * Sin `server-only`, sin alias `@/` y sin un solo import, como el resto de la
 * familia: el banco lo carga tal cual desde node.
 */

export type Reparto = {
  paleta: string;
  /** Qué mandó, para poder enseñarlo. */
  porque: 'la eligió por el tema' | 'el tema no pide color, así que se repartió';
};

/**
 * La paleta que le toca a este carrusel.
 *
 * @param elegida    lo que contestó el modelo.
 * @param pordefecto la respuesta de "este tema no tiene color" — `azul`.
 * @param recientes  las paletas ya usadas, **de la más nueva a la más vieja**.
 * @param candidatas las que pueden entrar al reparto, en orden estable.
 */
export function repartir(
  elegida: string,
  pordefecto: string,
  recientes: readonly string[],
  candidatas: readonly string[],
): Reparto {
  // El modelo tenía una razón. No se discute.
  if (elegida !== pordefecto) return { paleta: elegida, porque: 'la eligió por el tema' };

  if (candidatas.length === 0) return { paleta: pordefecto, porque: 'la eligió por el tema' };

  /*
   * La que hace más que no se usa gana.
   *
   * `recientes` viene de la más nueva a la más vieja, así que la posición en esa
   * lista **es** la antigüedad: 0 es la última usada. Una candidata que no
   * aparece nunca se ha usado y gana a cualquiera que sí.
   *
   * El desempate es el orden de `candidatas`, que es el de tokens.ts. Sin un
   * desempate estable el reparto dependería del orden en que node recorra un
   * objeto, y dos corridas del mismo calendario darían meses distintos.
   */
  let mejor = candidatas[0];
  let mejorEdad = -1;

  for (const candidata of candidatas) {
    const i = recientes.indexOf(candidata);
    const edad = i === -1 ? Number.POSITIVE_INFINITY : i;
    if (edad > mejorEdad) {
      mejor = candidata;
      mejorEdad = edad;
    }
  }

  return { paleta: mejor, porque: 'el tema no pide color, así que se repartió' };
}
