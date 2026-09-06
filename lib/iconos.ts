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
export function separacion(icono: Icono, fondo: string): number | null {
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
 * y se casa contra el manifiesto. Con puntaje bueno se asigna el slug; con
 * puntaje dudoso se deja vacío y el editor marca "falta ícono", que es mejor
 * que poner un ícono equivocado y que nadie lo note.
 */
export function mejorCoincidencia(fuse: Fuse<Icono>, concepto: string): Icono | null {
  const r = fuse.search(concepto, { limit: 1 })[0];
  if (!r || (r.score ?? 1) > 0.35) return null;
  return r.item;
}
