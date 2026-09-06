import Fuse from 'fuse.js';

/** Una entrada de public/iconos/manifest.json. */
export type Icono = {
  slug: string;
  nombre: string;
  etiquetas: string[];
  w: number;
  h: number;
  bytes?: number;
};

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
