/**
 * lib/slug.ts — el nombre de archivo de un carrusel.
 *
 * Vivía dentro de `lib/brief.ts` y sale aquí por una razón concreta: el slug
 * decide el nombre del JSON en proyectos/<id>/posts/, y la tanda del mes
 * (`scripts/mes.mjs`) necesita **calcular el mismo** antes de llamar al
 * servidor, para saber si ese carrusel ya existe y saltarlo sin pagar la
 * llamada. Un script de node no puede cargar `brief.ts`, que importa con el
 * alias `@/`.
 *
 * Copiarlo en el script habría sido lo fácil y lo peor: el día que las dos
 * copias se separen, la tanda comprobaría la existencia de un archivo con un
 * nombre y el servidor escribiría otro, y la protección contra sobrescribir
 * dejaría de proteger sin dar ninguna señal.
 *
 * Por eso aquí no hay `server-only`, ni alias, ni un solo import. Es la misma
 * regla que en `lib/temas.ts` y `lib/mes.ts`.
 */

export function sinAcentos(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * El nombre de archivo, a partir del tema.
 *
 * Se corta a 60 porque los temas de esta cuenta son largos de verdad —hay
 * publicados de más de ciento cincuenta caracteres— y un nombre de archivo de
 * esa longitud es incómodo en cualquier sitio. Es idempotente: pasarle un slug
 * devuelve el mismo slug.
 */
export function aSlug(s: string): string {
  return (
    sinAcentos(s)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'carrusel'
  );
}
