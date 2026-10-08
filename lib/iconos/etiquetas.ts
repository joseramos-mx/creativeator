/**
 * lib/iconos/etiquetas.ts — el nombre y las etiquetas de un ícono.
 *
 * Vive aparte porque lo usan dos puertas: la ingesta de una carpeta de PNG y el
 * guardado de un ícono generado. **El ícono generado entra por la misma puerta
 * que los descargados**, y eso incluye cómo se le pone el slug y cómo se le
 * sacan las etiquetas de búsqueda. Si cada camino etiquetara a su manera, el
 * buscador encontraría unos y no otros según de dónde vinieran, que es una
 * diferencia invisible hasta el día que muerde.
 */

export function slugificar(nombre: string): string {
  return nombre
    .replace(/\.png$/i, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Los nombres vienen en inglés y aquí se busca en español, así que cada palabra
 * del slug arrastra sus sinónimos de `compartido/sinonimos.json`.
 */
export function etiquetar(
  slug: string,
  nombre: string,
  sinonimos: Record<string, string[]>,
): string[] {
  const palabras = [...slug.split('-'), ...slugificar(nombre).split('-')].filter(Boolean);
  // Se busca el slug entero y también cada palabra suelta: "cuidado-de-piel"
  // tiene sus propios sinónimos, y "piel" los suyos.
  const extra = [slug, ...palabras].flatMap((p) => sinonimos[p] ?? []);
  return [...new Set([...palabras, ...extra])];
}
