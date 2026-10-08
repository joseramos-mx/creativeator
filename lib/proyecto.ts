/**
 * lib/proyecto.ts — dónde vive cada cosa de un proyecto.
 *
 * Un proyecto es una cuenta: el Dr. Edwin, la Dra. Mildreth, Adimex. Todos
 * usan la misma app y cada uno tiene su carpeta:
 *
 *   proyectos/<id>/              lo que se edita: configuración, voz, posts
 *   public/proyectos/<id>/       lo que se sirve: fotos, logos, descargas
 *
 * **Ninguna otra parte del código arma una ruta de proyecto a mano.** Antes
 * había veinticinco `join(process.cwd(), 'content', …)` repartidos entre rutas,
 * librerías y scripts, y con dos proyectos cada uno es un sitio donde el
 * carrusel de una cuenta acaba guardado en la carpeta de otra. Aquí se resuelve
 * una vez.
 *
 * Sin `server-only`, sin alias `@/` y sin más imports que los de Node, igual
 * que lib/temas.ts: los scripts de `npm run` lo cargan tal cual.
 */

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Lo que comparten todos: la librería de íconos y su estilo, y los sinónimos
 * del buscador. Un ícono generado para una cuenta le sirve a la siguiente.
 */
export const COMPARTIDO = 'compartido';

/** Un id de proyecto es también un segmento de URL y un nombre de carpeta. */
const ID = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Los nombres que ya son rutas de la app o carpetas de `public/`. Un proyecto
 * que se llamara `api` taparía las rutas de la API, y uno llamado `iconos`
 * quedaría escondido detrás de la carpeta estática.
 */
const RESERVADOS = new Set([
  'api',
  'plantilla',
  'proyectos',
  'iconos',
  'fonts',
  'referencia',
  'compartido',
  'media',
  'descargas',
  'render',
  'post',
]);

export function esIdValido(id: string): boolean {
  return ID.test(id) && !RESERVADOS.has(id);
}

function comprobar(id: string): string {
  if (!esIdValido(id)) {
    throw new Error(
      `"${id}" no sirve como id de proyecto: solo minúsculas, números y guiones, ` +
        `y no puede ser ninguno de estos: ${[...RESERVADOS].join(', ')}.`,
    );
  }
  return id;
}

/**
 * El proyecto donde viven los carruseles de laboratorio, sobre los que corren
 * las pruebas (`npm run pruebas`). Son de una cuenta porque necesitan una
 * marca de verdad —el cierre, el nombre de quien firma—, y es la del Dr. Edwin
 * porque la plantilla se midió contra su carrusel publicado.
 */
export const PROYECTO_DE_PRUEBAS = 'dr-edwin';

/** Todas las rutas de un proyecto, en disco y en URL. */
export function rutasDe(id: string, raiz = process.cwd()) {
  comprobar(id);
  const carpeta = join(raiz, 'proyectos', id);
  const publico = join(raiz, 'public', 'proyectos', id);
  const url = `/proyectos/${id}`;

  return {
    id,
    carpeta,
    /** Marca y configuración. Ver `Proyecto` en lib/schema.ts. */
    config: join(carpeta, 'proyecto.json'),
    /** El system prompt de la redacción. */
    voz: join(carpeta, 'voz.md'),
    /** Las piezas de los prompts que son de la cuenta y no de la app. */
    prompt: (nombre: string) => join(carpeta, 'prompts', `${nombre}.md`),
    calendario: join(carpeta, 'calendario.tsv'),
    calendarioAlterno: join(carpeta, 'calendario.csv'),
    posts: join(carpeta, 'posts'),
    post: (slug: string) => join(carpeta, 'posts', `${slug}.json`),

    /** Logos y retrato: lo que `proyecto.json` nombra en `logo` y compañía. */
    marca: join(publico, 'marca'),
    /** Las fotos de un carrusel, en disco. */
    media: (slug: string) => join(publico, 'media', slug),
    /** Y la misma foto, como la escribe el JSON del post. */
    urlMedia: (slug: string, nombre: string) => `${url}/media/${slug}/${nombre}`,

    descargas: join(publico, 'descargas'),
    indiceDescargas: join(publico, 'descargas', 'indice.json'),
    urlDescargas: `${url}/descargas`,

    /** Los PNG de la exportación a mano. No se versionan. */
    salidas: join(raiz, 'salidas', id),
  };
}

export type Rutas = ReturnType<typeof rutasDe>;

/** Los ids de los proyectos que hay en disco, en orden alfabético. */
export function listarProyectos(raiz = process.cwd()): string[] {
  const dir = join(raiz, 'proyectos');
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && esIdValido(d.name))
    .filter((d) => existsSync(join(dir, d.name, 'proyecto.json')))
    .map((d) => d.name)
    .sort();
}

export function existeProyecto(id: string, raiz = process.cwd()): boolean {
  return esIdValido(id) && existsSync(join(raiz, 'proyectos', id, 'proyecto.json'));
}

/**
 * El proyecto de un script: `--proyecto <id>`, o el único que haya.
 *
 * Con un solo proyecto pedirlo sería ceremonia. Con dos, adivinar sería el
 * error que esto existe para evitar —escribir el mes de una cuenta en la
 * carpeta de la otra—, así que se pide y se dice cuáles hay.
 */
export function proyectoDeArgumentos(argv: string[] = process.argv, raiz = process.cwd()): string {
  const i = argv.indexOf('--proyecto');
  const pedido = i !== -1 ? argv[i + 1] : undefined;
  const hay = listarProyectos(raiz);

  if (pedido) {
    if (!existeProyecto(pedido, raiz)) {
      throw new Error(`No existe el proyecto "${pedido}". Hay: ${hay.join(', ') || 'ninguno'}.`);
    }
    return pedido;
  }
  if (hay.length === 1) return hay[0];
  if (hay.length === 0) throw new Error('No hay ningún proyecto en proyectos/.');
  throw new Error(`Hay ${hay.length} proyectos (${hay.join(', ')}). Di cuál con --proyecto <id>.`);
}

/**
 * Los argumentos de un script sin `--proyecto <id>`, para que los que leen
 * posiciones (`npm run celular <slug>`) no confundan el id con un slug.
 */
export function sinProyecto(argv: string[]): string[] {
  const i = argv.indexOf('--proyecto');
  return i === -1 ? argv : [...argv.slice(0, i), ...argv.slice(i + 2)];
}
