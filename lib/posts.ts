import 'server-only';

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Marca, Post, validar, type TMarca, type TPost } from './schema';

/**
 * lib/posts.ts — el sistema de archivos es la base de datos.
 *
 * No hay servidor de datos ni tabla: un post es un JSON en content/posts/ y el
 * historial es git. Todo lo que se lee pasa por el esquema antes de llegar a la
 * plantilla, así que un archivo mal editado falla al leerse, diciendo dónde, y
 * no a media página con un componente en blanco.
 */

const CONTENIDO = join(process.cwd(), 'content');
const POSTS = join(CONTENIDO, 'posts');

export async function leerMarca(): Promise<TMarca> {
  const crudo = await readFile(join(CONTENIDO, 'marca.json'), 'utf8');
  return validar(Marca, JSON.parse(crudo), 'content/marca.json');
}

export async function leerPost(slug: string): Promise<TPost> {
  const ruta = join(POSTS, `${slug}.json`);
  const crudo = await readFile(ruta, 'utf8');
  return validar(Post, JSON.parse(crudo), `content/posts/${slug}.json`);
}

export async function listarSlugs(): Promise<string[]> {
  const archivos = await readdir(POSTS).catch(() => [] as string[]);
  return archivos.filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));
}

/** Los posts ordenados del más nuevo al más viejo, para la lista de la portada. */
export async function listarPosts(): Promise<TPost[]> {
  const slugs = await listarSlugs();
  const posts = await Promise.all(slugs.map(leerPost));
  return posts.sort((a, b) => b.creado.localeCompare(a.creado));
}
