import Fuse from 'fuse.js';

/** Una entrada de public/iconos/manifest.json. */
export type Icono = {
  slug: string;
  nombre: string;
  etiquetas: string[];
  /** Color dominante de la parte opaca, para saber si se funde con el fondo. */
  color?: string | null;
  w: number;
  h: number;
  bytes?: number;
};

/**
 * Cuánto se despega un ícono del fondo de la paleta.
 *
 * Es diferencia de color en Lab, no contraste de luminancia: dos colores del
 * mismo tono pueden tener el mismo contraste y aun así fundirse. Es justo lo
 * que le pasa a `palomita-verde` sobre la paleta verde (ΔE 21) o a `silencio`
 * sobre naranja (27), mientras que sobre azul los dos se ven perfectamente.
 */
export function separacion(icono: Pick<Icono, 'color'>, fondo: string): number | null {
  if (!icono.color) return null;
  return deltaE(icono.color, fondo);
}

/**
 * Por debajo de esto el ícono se pierde. El umbral sale de medir la librería
 * contra las tres paletas: lo que funciona está por encima de 55, lo que
 * desaparece por debajo de 30.
 */
export const SEPARACION_MINIMA = 40;

function deltaE(a: string, b: string) {
  const [l1, a1, b1] = aLab(a);
  const [l2, a2, b2] = aLab(b);
  return Math.sqrt((l1 - l2) ** 2 + (a1 - a2) ** 2 + (b1 - b2) ** 2);
}

function aLab(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const canal = (i: number) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const r = canal(0);
  const g = canal(2);
  const bl = canal(4);
  const X = (0.4124 * r + 0.3576 * g + 0.1805 * bl) / 0.95047;
  const Y = 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  const Z = (0.0193 * r + 0.1192 * g + 0.9505 * bl) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const [fx, fy, fz] = [f(X), f(Y), f(Z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/**
 * La búsqueda de íconos.
 *
 * Diez mil entradas son unos pocos cientos de kilobytes de JSON: se carga el
 * manifiesto entero una vez y se busca en memoria. No hace falta paginar en el
 * servidor ni montar un índice.
 *
 * El umbral de 0.4 es lo que hace que "estetoscopio" encuentre el ícono aunque
 * el archivo se llame "stethoscope": la tolerancia cubre la distancia entre lo
 * que el usuario teclea y lo que el diccionario de sinónimos alcanzó a cubrir.
 */
export function crearBuscador(manifiesto: Icono[]) {
  return new Fuse(manifiesto, {
    keys: [
      { name: 'nombre', weight: 2 },
      { name: 'etiquetas', weight: 1.5 },
      { name: 'slug', weight: 1 },
    ],
    threshold: 0.4,
    ignoreLocation: true,
    includeScore: true,
  });
}

export function buscar(fuse: Fuse<Icono>, consulta: string, limite = 60): Icono[] {
  const q = consulta.trim();
  if (!q) return [];
  return fuse.search(q, { limit: limite }).map((r) => r.item);
}

/**
 * Lo que hace la IA con `iconoSugerido`: se le pide un concepto corto en inglés
 * y se casa contra el manifiesto, para poner el ícono sin abrir el buscador.
 *
 * ── Por qué no basta con buscar la frase ────────────────────────────────────
 * La primera versión buscaba el concepto entero y se quedaba con el primero. No
 * encontraba nada: `fuse` compara la consulta contra **cada etiqueta suelta**, y
 * ninguna etiqueta es "magnifying glass", así que la frase que el redactor
 * escribe de verdad —siempre de dos palabras— sacaba 0.72 y se descartaba,
 * mientras que "magnifying" a secas sacaba 0.000. El buscador del editor no lo
 * notó nunca porque ahí se teclea una palabra.
 *
 * Ahora se miran dos señales:
 *
 *  · **la frase**, contra el nombre y las etiquetas juntas en un solo texto, que
 *    es lo que permite que "magnifying glass" case como frase;
 *  · **las palabras**, cada una por separado, que es lo que rescata
 *    "warning triangle" cuando solo "warning" está en la librería.
 *
 * ── Por qué los umbrales son tan estrictos ──────────────────────────────────
 * Los dos errores posibles no cuestan lo mismo. No encontrar lo que sí está
 * cuesta un clic en el editor; poner un ícono equivocado no cuesta nada en el
 * momento y sale publicado, porque nadie revisa un ícono que ya está puesto.
 *
 * Por eso la vía de las palabras exige un acierto **exacto** en al menos una y
 * que ninguna otra palabra apunte a otro ícono. Es lo que separa
 * "warning triangle" —donde "warning" es la palabra que manda— de "skin rash",
 * donde "skin" arrastraría el ícono de cuidado de piel para un carrusel sobre
 * una erupción. La segunda es la que hay que impedir.
 *
 * Cuando algo que sí está en la librería no se encuentra, el arreglo no es
 * bajar el umbral: es añadir la palabra a `compartido/sinonimos.json`.
 */
const FRASE = 0.25;
const PALABRA_EXACTA = 0.05;
const PALABRA_FLOJA = 0.2;

/**
 * Conectores, fuera. No aportan significado y sí arrastran íconos.
 *
 * No es una precaución teórica: "milk carton and egg" devolvía **curitas**,
 * porque "and" es subcadena de "band" y "bandaid" y casaba a 0.001 — más
 * exacto que ninguna palabra de verdad. Lo mismo hacían "the" con termometro
 * (0.023) y "for" con informacion (0.001).
 *
 * Es el fallo que este archivo existe para impedir, y se coló por donde no se
 * estaba mirando: el umbral estricto no sirve de nada si la palabra que lo
 * cumple es una que no significa nada.
 */
const CONECTORES = new Set([
  'and', 'or', 'the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for', 'with',
  'from', 'by', 'as', 'into', 'over', 'under', 'up', 'out', 'off',
  'y', 'o', 'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'en', 'con',
  'por', 'para', 'sin', 'sobre',
]);

export function mejorCoincidencia(manifiesto: Icono[], concepto: string): Icono | null {
  const q = concepto.trim().toLowerCase();
  if (!q || manifiesto.length === 0) return null;

  const fuse = crearBuscador(manifiesto);

  // 1. La frase, contra el texto completo de cada ícono.
  const porFrase = buscadorDeFrase(manifiesto).search(q, { limit: 1 })[0];
  if (porFrase && (porFrase.score ?? 1) <= FRASE) return porFrase.item;

  // 2. Las palabras. Hace falta un acierto exacto, y que las demás palabras que
  //    acierten algo apunten al mismo ícono.
  const palabras = q
    .split(/[\s-]+/)
    .filter((p) => p.length > 2 && !CONECTORES.has(p));
  if (palabras.length < 2) return null;

  let elegido: Icono | null = null;
  let exacto = false;
  let aciertos = 0;

  for (const palabra of palabras) {
    const r = fuse.search(palabra, { limit: 1 })[0];
    if (!r || (r.score ?? 1) > PALABRA_FLOJA) continue;
    if (elegido && r.item.slug !== elegido.slug) return null; // dos palabras, dos íconos
    elegido = r.item;
    aciertos++;
    if ((r.score ?? 1) <= PALABRA_EXACTA) exacto = true;
  }

  // Más de la mitad de las palabras, no una suelta. Una sola palabra que acierta
  // es casi siempre la genérica del concepto, y la genérica arrastra cualquier
  // cosa: "skin rash" devolvía el ícono de la prueba de alergia porque "skin"
  // está en su slug, y "rash" no estaba en ningún sitio.
  //
  // El precio es perder "warning triangle" → alerta, donde solo "warning"
  // acierta. Se paga con gusto: fallar cuesta generar un ícono parecido por unos
  // centavos, y acertar mal cuesta publicar la imagen equivocada.
  return exacto && aciertos * 2 > palabras.length ? elegido : null;
}

/**
 * El mismo manifiesto, con el nombre y las etiquetas juntas en un campo.
 *
 * Va aparte de `crearBuscador` porque el buscador del editor no lo necesita:
 * ahí se teclea una palabra. Es la búsqueda por frase la que necesita un texto
 * donde "magnifying glass" aparezca seguido.
 */
const cache = new WeakMap<Icono[], Fuse<Icono & { texto: string }>>();

function buscadorDeFrase(manifiesto: Icono[]) {
  const guardado = cache.get(manifiesto);
  if (guardado) return guardado;

  const conTexto = manifiesto.map((i) => ({
    ...i,
    texto: `${i.nombre} ${i.slug} ${(i.etiquetas ?? []).join(' ')}`.toLowerCase(),
  }));
  const nuevo = new Fuse(conTexto, {
    keys: ['texto'],
    threshold: 0.45,
    ignoreLocation: true,
    includeScore: true,
  });
  cache.set(manifiesto, nuevo);
  return nuevo;
}
