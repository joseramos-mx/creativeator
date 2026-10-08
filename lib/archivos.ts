import 'server-only';

import { extname, join } from 'node:path';

/**
 * lib/archivos.ts — qué se puede ver y qué se puede editar en el explorador.
 *
 * Las rutas van como las escribe el repositorio («proyectos/dr-edwin/posts»),
 * y solo valen dentro de las dos carpetas de la cuenta: lo que se edita y lo
 * que se sirve. Ni la de otra cuenta ni el código.
 */

export function raicesDe(proyecto: string) {
  return [`proyectos/${proyecto}`, `public/proyectos/${proyecto}`];
}

/** La ruta, si es de la cuenta; si no, null. */
export function rutaDeCuenta(proyecto: string, ruta: string): string | null {
  const limpia = ruta.replace(/^\/+|\/+$/g, '');
  if (limpia.split('/').some((s) => s === '..' || s === '.' || s === '')) return null;
  return raicesDe(proyecto).some((r) => limpia === r || limpia.startsWith(`${r}/`)) ? limpia : null;
}

export const absoluta = (ruta: string) => join(process.cwd(), ruta);

export type Clase = 'imagen' | 'texto' | 'json' | 'pdf' | 'otro';

export function claseDe(nombre: string): Clase {
  const ext = extname(nombre).toLowerCase();
  if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(ext)) return 'imagen';
  if (['.md', '.tsv', '.csv', '.txt'].includes(ext)) return 'texto';
  if (ext === '.json') return 'json';
  if (ext === '.pdf') return 'pdf';
  return 'otro';
}

/**
 * Lo que se edita a mano desde el explorador: los textos. Los JSON no —un post
 * tiene su editor, y `proyecto.json` su pantalla de identidad—, porque una coma
 * de más los deja ilegibles.
 */
export const editable = (nombre: string) => claseDe(nombre) === 'texto';
