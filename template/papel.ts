/** Doce variantes de papel rasgado; cada post se queda siempre con la suya. */
export const VARIANTES_PAPEL = 12;

/**
 * Elige el papel a partir del slug del post. Es determinista, así que el mismo
 * carrusel siempre sale con el mismo rasgado, pero dos carruseles seguidos casi
 * nunca comparten el suyo y el feed no se ve repetido.
 */
export function papelDePost(slug: string): string {
  let h = 7;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) % 100003;
  return `/marca/papel-${String((h % VARIANTES_PAPEL) + 1).padStart(2, '0')}.svg`;
}
