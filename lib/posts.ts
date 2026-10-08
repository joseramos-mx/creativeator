import 'server-only';

import { readdir, readFile } from 'node:fs/promises';
import { relative } from 'node:path';
import { Post, Proyecto, validar, type TPost, type TProyecto } from './schema';
import { existeProyecto, listarProyectos, rutasDe } from './proyecto';

/**
 * lib/posts.ts — el sistema de archivos es la base de datos.
 *
 * No hay servidor de datos ni tabla: un post es un JSON en
 * proyectos/<id>/posts/ y el historial es git. Todo lo que se lee pasa por el
 * esquema antes de llegar a la plantilla, así que un archivo mal editado falla
 * al leerse, diciendo dónde, y no a media página con un componente en blanco.
 *
 * Todo pide el proyecto. No hay uno "por defecto" a propósito: con dos cuentas,
 * el que se lee sin decir cuál es el que acaba escrito en la carpeta de la otra.
 */

const relativa = (ruta: string) => relative(process.cwd(), ruta);

/**
 * La configuración del proyecto. Es un superconjunto de la marca, así que se
 * le pasa tal cual a la plantilla donde esta pide `Marca`.
 */
export async function leerProyecto(proyecto: string): Promise<TProyecto> {
  const ruta = rutasDe(proyecto).config;
  const crudo = await readFile(ruta, 'utf8');
  return validar(Proyecto, JSON.parse(crudo), relativa(ruta));
}

/** El nombre de siempre, para lo que solo necesita lo que se pinta. */
export const leerMarca = leerProyecto;

export async function leerPost(proyecto: string, slug: string): Promise<TPost> {
  const ruta = rutasDe(proyecto).post(slug);
  const crudo = await readFile(ruta, 'utf8');
  return validar(Post, JSON.parse(crudo), relativa(ruta));
}

export async function listarSlugs(proyecto: string): Promise<string[]> {
  const archivos = await readdir(rutasDe(proyecto).posts).catch(() => [] as string[]);
  return archivos.filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));
}

/** Los posts ordenados del más nuevo al más viejo, para la lista de la portada. */
export async function listarPosts(proyecto: string): Promise<TPost[]> {
  const slugs = await listarSlugs(proyecto);
  const posts = await Promise.all(slugs.map((s) => leerPost(proyecto, s)));
  return posts.sort((a, b) => b.creado.localeCompare(a.creado));
}

/** Los proyectos con su configuración, para la pantalla de elegir. */
export async function listarProyectosConMarca(): Promise<Array<{ id: string; proyecto: TProyecto }>> {
  return Promise.all(listarProyectos().map(async (id) => ({ id, proyecto: await leerProyecto(id) })));
}

export { existeProyecto };
