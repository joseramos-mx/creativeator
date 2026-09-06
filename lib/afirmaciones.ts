/**
 * lib/afirmaciones.ts — qué hay que revisar antes de aprobar un carrusel.
 *
 * El problema que resuelve: un modelo puede escribir una cifra plausible con
 * una institución real al lado. "Cerca del 10% de las consultas de piel en
 * niños (StatPearls)" llega ya vestido de verificado, y por eso es más difícil
 * de cazar que un error obvio: leyéndolo de corrido, el ojo se resbala.
 *
 * La extracción es determinista y no depende de lo que el modelo diga haber
 * afirmado. Un modelo que inventa una cifra también puede omitirla de su propia
 * lista. Al redactor se le pide igualmente que declare sus afirmaciones, pero
 * solo para cruzarlas: **lo que encuentra el extractor y el modelo no declaró
 * es más sospechoso, no menos.**
 *
 * ── Lo que este archivo NO hace ─────────────────────────────────────────────
 * No comprueba nada. No abre StatPearls, no verifica que ahí diga ese 10 %, no
 * valida el enlace que pegue el médico. Lo único que garantiza es que ninguna
 * afirmación con cifra, con fuente o con indicación de seguridad llegue al
 * estado `aprobado` sin que una persona la haya mirado a propósito, y que
 * editarla la devuelva a la cola. Una revisión guardada aquí quiere decir
 * "alguien la leyó", nunca "el sistema la comprobó".
 */

/** Lo mínimo que hace falta de un post para revisarlo. */
export type PostRevisable = {
  // `tipo` va aquí aunque no se use: sin un campo obligatorio, TypeScript trata
  // el resto como tipo débil y rechaza la portada, que no tiene ninguno.
  slides: ReadonlyArray<{
    tipo: string;
    bajada?: string;
    cuerpo?: string;
    puntos?: readonly string[];
    fuente?: string;
  }>;
  copy?: string;
};

export type Disparador = 'cifra' | 'fuente' | 'seguridad';

export type Afirmacion = {
  /** Hash del texto y su fuente. Si el texto cambia, cambia la huella. */
  huella: string;
  /** Dónde está, para poder ir a corregirlo: "slide 02 · cuerpo", "copy". */
  donde: string;
  /** El bloque completo: es como se lee y como se edita. */
  texto: string;
  fuente?: string;
  disparadores: Disparador[];
  /** Lo que hizo saltar cada disparador, para resaltarlo en la cola. */
  marcas: string[];
  /**
   * Las que llevan cifra exigen enlace. Pegar la URL obliga a haber abierto la
   * fuente; con el campo opcional, "la verifiqué" se vuelve trámite.
   */
  exigeEnlace: boolean;
};

const INSTITUCIONES = [
  'Mayo Clinic',
  'Cleveland Clinic',
  'AAP',
  'AAD',
  'KidsHealth',
  'StatPearls',
  'OMS',
  'CDC',
  'NIH',
  'AEDV',
];

/** Porcentajes, proporciones y cantidades con unidad. */
const CIFRA =
  /(\d+[.,]?\d*\s*%|\d+\s+de\s+cada\s+\d+|\b\d+[.,]?\d*\s*(?:horas?|d[ií]as?|semanas?|meses|a[ñn]os|veces)\b)/gi;

/**
 * El cuarto disparador: la indicación de seguridad, que no lleva cifra ni
 * necesariamente fuente y es la que más pesa clínicamente. "Necesita
 * antibiótico", "puede volver a clases", "no lo trates a ciegas".
 *
 * Salta cuando coinciden las dos cosas: un modal o una directiva, y una palabra
 * del terreno donde una indicación equivocada hace daño —tratamiento, contagio,
 * vuelta a clases, consulta—. Pedir las dos es lo que separa "necesita
 * antibiótico" de "suele picar": las dos tienen verbo, solo una manda hacer algo.
 */
const MODAL =
  /\b(necesita\w*|hace falta|puede[ns]?|pueden|debe[ns]?|hay que|tiene[n]? que|conviene|termina\w*|acude\w*|acudir|agenda\w*|cubre\w*|evita\w*|aplica\w*|suspend\w*)\b/i;

/** El terreno donde una indicación equivocada hace daño. */
const TERRENO =
  '(?:antibi[oó]tico\\w*|trat\\w*|remedio\\w*|automedic\\w*|crema|pomada|medicamento\\w*|dosis|receta|clases|escuela|guarder[ií]a|volver|regresar|aisla\\w*|contagi\\w*|compart\\w*|toalla\\w*|s[aá]bana\\w*|llaga\\w*|valoraci[oó]n|consulta|m[eé]dico|urgencias?)';

const ACCION = new RegExp(`\\b${TERRENO}\\b`, 'i');

/**
 * "No lo trates a ciegas" es una indicación y hay que revisarla. "La crema ya
 * no alcanza" no lo es, y "no despierta al niño de noche" tampoco.
 *
 * La regla que las separa: **una negación cuenta como directiva solo cuando lo
 * negado es la acción misma.** Antes bastaba con `no` seguido de cualquier
 * palabra, y con eso tres frases del terreno —donde "crema" aparece a dos
 * renglones de cualquier negación— entraban en la cola sin ser indicaciones.
 * Un revisor que abre tres fichas para nada aprende a pasarlas de corrido.
 */
const NEGACION = new RegExp(
  `\\bno\\s+(?:(?:se|lo|la|le|les|los|te|nos|me)\\s+)?${TERRENO}`,
  'i',
);

/**
 * La unidad de revisión es el bloque, no la frase.
 *
 * Es como se lee y como se edita: pedirle al médico que apruebe "Cleveland
 * Clinic." suelto no significa nada; lo que tiene que mirar es el párrafo
 * entero con su atribución al lado.
 */
export function afirmacionesDe(post: PostRevisable): Afirmacion[] {
  const bloques: { donde: string; texto: string; fuente?: string }[] = [];

  post.slides.forEach((slide, i) => {
    const etiqueta = `slide ${String(i).padStart(2, '0')}`;

    // La bajada y el cuerpo son una unidad, no dos. Comparten la atribución
    // del slide y se leen seguidos: la bajada es la entrada del párrafo. Cuando
    // se contaban por separado, una sola fuente citada abría dos revisiones
    // idénticas, y revisar dos veces lo mismo es lo que enseña a revisar de
    // corrido, que es justo lo que la cola existe para impedir.
    const texto = [slide.bajada, slide.cuerpo].filter(Boolean).join('\n');
    if (texto) {
      const parte = slide.bajada && slide.cuerpo ? 'texto' : slide.bajada ? 'bajada' : 'cuerpo';
      bloques.push({ donde: `${etiqueta} · ${parte}`, texto, fuente: slide.fuente });
    }

    if (slide.puntos?.length) {
      bloques.push({ donde: `${etiqueta} · lista`, texto: slide.puntos.join('\n'), fuente: slide.fuente });
    }
  });

  // El copy se parte por bloques, que es como está escrito: cada uno con su
  // emoji, su idea y, cuando afirma un dato, su institución entre paréntesis.
  for (const parrafo of (post.copy ?? '').split('\n\n').map((p) => p.trim()).filter(Boolean)) {
    const fuente = INSTITUCIONES.find((i) => parrafo.includes(`(${i})`));
    bloques.push({ donde: 'copy', texto: parrafo, fuente });
  }

  const afirmaciones: Afirmacion[] = [];
  for (const bloque of bloques) {
    const disparadores: Disparador[] = [];
    const marcas: string[] = [];

    const cifras = bloque.texto.match(CIFRA);
    if (cifras) {
      disparadores.push('cifra');
      marcas.push(...cifras.map((c) => c.trim()));
    }
    if (bloque.fuente) {
      disparadores.push('fuente');
      marcas.push(bloque.fuente);
    }
    const modal = MODAL.exec(bloque.texto);
    const accion = ACCION.exec(bloque.texto);
    const negacion = NEGACION.exec(bloque.texto);
    if ((modal && accion) || negacion) {
      disparadores.push('seguridad');
      // La negación ya lleva la acción dentro, así que se marca entera.
      marcas.push(negacion && !modal ? negacion[0] : `${modal?.[0]} … ${accion?.[0]}`);
    }

    if (disparadores.length === 0) continue;

    afirmaciones.push({
      huella: huellaDe(bloque.texto, bloque.fuente),
      donde: bloque.donde,
      texto: bloque.texto,
      fuente: bloque.fuente,
      disparadores,
      marcas,
      exigeEnlace: disparadores.includes('cifra'),
    });
  }

  return afirmaciones;
}

/**
 * La huella de una afirmación: su texto normalizado más su fuente.
 *
 * Es la pieza que hace que una revisión no se pueda heredar. Si el texto cambia
 * una coma, la huella cambia y la afirmación vuelve sola a la cola. No hay
 * forma de aprobar una frase y después cambiarla sin que el sistema lo note.
 */
export function huellaDe(texto: string, fuente?: string): string {
  const normal = `${texto.replace(/\s+/g, ' ').trim()}||${fuente ?? ''}`;
  // FNV-1a de 32 bits: determinista, igual en el servidor y en el navegador, y
  // de sobra para las quince o veinte afirmaciones que tiene un carrusel.
  let h = 0x811c9dc5;
  for (let i = 0; i < normal.length; i++) {
    h ^= normal.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Las que todavía no ha mirado nadie, o cuyo enlace falta y hace falta. */
export function pendientes(
  post: PostRevisable,
  revisiones: Record<string, { enlace?: string }> | undefined,
): Afirmacion[] {
  const hechas = revisiones ?? {};
  return afirmacionesDe(post).filter((a) => {
    const revision = hechas[a.huella];
    if (!revision) return true;
    return a.exigeEnlace && !revision.enlace;
  });
}
