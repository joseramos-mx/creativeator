import 'server-only';

import { join, relative } from 'node:path';
import { almacen } from './almacen';
import { Post, Proyecto, validar, type TPost, type TProyecto } from './schema';
import { esIdValido, rutasDe } from './proyecto';

/**
 * lib/posts.ts — el sistema de archivos es la base de datos.
 *
 * No hay servidor de datos ni tabla: un post es un JSON en
 * proyectos/<id>/posts/ y el historial es git. Todo lo que se lee pasa por el
 * esquema antes de llegar a la plantilla, así que un archivo mal editado falla
 * al leerse, diciendo dónde, y no a media página con un componente en blanco.
 *
 * Todo se lee por lib/almacen.ts: del disco en tu computadora, del repositorio
 * de GitHub en Vercel.
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
  const crudo = await almacen.leerTexto(ruta);
  if (crudo === null) throw new Error(`No existe ${relativa(ruta)}.`);
  return validar(Proyecto, JSON.parse(crudo), relativa(ruta));
}

/** El nombre de siempre, para lo que solo necesita lo que se pinta. */
export const leerMarca = leerProyecto;

export async function leerPost(proyecto: string, slug: string): Promise<TPost> {
  const ruta = rutasDe(proyecto).post(slug);
  const crudo = await almacen.leerTexto(ruta);
  if (crudo === null) throw new Error(`No existe ${relativa(ruta)}.`);
  return validar(Post, JSON.parse(crudo), relativa(ruta));
}

export async function listarSlugs(proyecto: string): Promise<string[]> {
  const archivos = await almacen.listar(rutasDe(proyecto).posts);
  return archivos
    .filter((f) => f.tipo === 'archivo' && f.nombre.endsWith('.json'))
    .map((f) => f.nombre.replace(/\.json$/, ''));
}

/** Los posts ordenados del más nuevo al más viejo, para la lista de la portada. */
export async function listarPosts(proyecto: string): Promise<TPost[]> {
  const slugs = await listarSlugs(proyecto);
  const posts = await Promise.all(slugs.map((s) => leerPost(proyecto, s)));
  return posts.sort((a, b) => b.creado.localeCompare(a.creado));
}

/**
 * Si el proyecto existe. Asíncrono porque en Vercel se pregunta al
 * repositorio; por eso no se llama `existeProyecto` como el de lib/proyecto.ts,
 * que es síncrono y lee el disco: un `!existeProyecto(id)` con la versión
 * asíncrona sería siempre falso, y TypeScript no lo marcaría.
 */
export async function hayProyecto(id: string): Promise<boolean> {
  return esIdValido(id) && (await almacen.existe(rutasDe(id).config));
}

/** Los ids de los proyectos, en orden alfabético. */
export async function proyectosDisponibles(): Promise<string[]> {
  const raiz = join(process.cwd(), 'proyectos');
  const carpetas = (await almacen.listar(raiz)).filter((e) => e.tipo === 'carpeta' && esIdValido(e.nombre));
  const con = await Promise.all(
    carpetas.map(async (c) => ((await almacen.existe(rutasDe(c.nombre).config)) ? c.nombre : null)),
  );
  return con.filter((c): c is string => c !== null).sort();
}

/** Los proyectos con su configuración, para la pantalla de elegir. */
export async function listarProyectosConMarca(): Promise<Array<{ id: string; proyecto: TProyecto }>> {
  const ids = await proyectosDisponibles();
  return Promise.all(ids.map(async (id) => ({ id, proyecto: await leerProyecto(id) })));
}
