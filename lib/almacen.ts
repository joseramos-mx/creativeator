import 'server-only';

import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';

/**
 * lib/almacen.ts — dónde se leen y se escriben los archivos de las cuentas.
 *
 * Dos sitios, la misma interfaz:
 *
 *  · **El disco**, en tu computadora. Lo de siempre: `npm run dev` lee y
 *    escribe en la carpeta del proyecto y git es el historial.
 *  · **El repositorio de GitHub**, en Vercel. Allá el disco es de solo lectura
 *    y se borra en cada petición, así que cada cambio es un commit en la rama
 *    del despliegue, por la API de GitHub. Leer también va contra la rama, no
 *    contra los archivos del despliegue: lo que se guardó desde el teléfono
 *    hace un minuto todavía no está en ningún build.
 *
 * Con eso el repositorio sigue siendo la única fuente: lo que se escribe desde
 * el celular aparece en la computadora con un `git pull`, y al revés con un
 * `git push`. No hay una segunda base de datos que sincronizar.
 *
 * Las rutas se pasan **absolutas**, como las arma `rutasDe()`; aquí se
 * convierten a rutas del repositorio. Solo pasan por aquí las carpetas de
 * contenido (ver `CONTENIDO`): el código, las fuentes y las muestras siempre
 * se leen del despliegue.
 */

export type Entrada = { nombre: string; tipo: 'archivo' | 'carpeta'; bytes: number };
export type Cambio = { ruta: string; datos: Buffer | string | null };

export interface Almacen {
  readonly remoto: boolean;
  leer(ruta: string): Promise<Buffer | null>;
  leerTexto(ruta: string): Promise<string | null>;
  existe(ruta: string): Promise<boolean>;
  listar(dir: string): Promise<Entrada[]>;
  /** Todos los archivos debajo de `dir`, con su ruta absoluta. */
  listarTodo(dir: string): Promise<string[]>;
  /** Varios archivos de una vez; `datos: null` borra. En GitHub, un solo commit. */
  escribir(cambios: Cambio[], mensaje: string): Promise<void>;
}

/** Las carpetas que son de las cuentas y no del código. */
const CONTENIDO = ['proyectos/', 'public/proyectos/', 'public/iconos/', 'compartido/'];

/** La ruta dentro del repositorio, con barras normales. */
export function rutaDelRepo(ruta: string): string {
  const rel = relative(process.cwd(), ruta).split(sep).join('/');
  if (rel.startsWith('..') || !CONTENIDO.some((c) => `${rel}/`.startsWith(c))) {
    throw new Error(`"${rel}" no es una carpeta de contenido.`);
  }
  return rel;
}

/* ── el disco ─────────────────────────────────────────────────────────────── */

const disco: Almacen = {
  remoto: false,

  leer: (ruta) => readFile(ruta).catch(() => null),
  leerTexto: (ruta) => readFile(ruta, 'utf8').catch(() => null),

  async existe(ruta) {
    return stat(ruta).then(
      () => true,
      () => false,
    );
  },

  async listar(dir) {
    const entradas = await readdir(dir, { withFileTypes: true }).catch(() => []);
    return Promise.all(
      entradas
        .filter((e) => e.isFile() || e.isDirectory())
        .map(async (e) => ({
          nombre: e.name,
          tipo: e.isDirectory() ? ('carpeta' as const) : ('archivo' as const),
          bytes: e.isFile() ? (await stat(join(dir, e.name))).size : 0,
        })),
    );
  },

  async listarTodo(dir) {
    const salida: string[] = [];
    for (const e of await disco.listar(dir)) {
      const ruta = join(dir, e.nombre);
      if (e.tipo === 'carpeta') salida.push(...(await disco.listarTodo(ruta)));
      else salida.push(ruta);
    }
    return salida;
  },

  async escribir(cambios) {
    for (const { ruta, datos } of cambios) {
      if (datos === null) {
        await rm(ruta, { recursive: true, force: true });
      } else {
        await mkdir(dirname(ruta), { recursive: true });
        await writeFile(ruta, datos);
      }
    }
  },
};

/* ── el repositorio de GitHub ─────────────────────────────────────────────── */

/**
 * Lo que hace falta para escribir en el repositorio. En Vercel el dueño, el
 * repositorio y la rama del despliegue vienen solos (`VERCEL_GIT_*`); lo único
 * que hay que poner a mano es el token.
 */
function configDeGithub() {
  const token = process.env.GITHUB_TOKEN?.trim();
  const repo =
    process.env.GITHUB_REPO?.trim() ||
    (process.env.VERCEL_GIT_REPO_OWNER && process.env.VERCEL_GIT_REPO_SLUG
      ? `${process.env.VERCEL_GIT_REPO_OWNER}/${process.env.VERCEL_GIT_REPO_SLUG}`
      : '');
  const rama = process.env.GITHUB_RAMA?.trim() || process.env.VERCEL_GIT_COMMIT_REF || 'main';
  const api = (process.env.GITHUB_API_URL?.trim() || 'https://api.github.com').replace(/\/$/, '');
  return token && repo ? { token, repo, rama, api } : null;
}

/**
 * Por qué no se puede escribir en el repositorio, en palabras de quien tiene
 * que arreglarlo. `null` si se puede. Lo enseñan las pantallas de solo
 * lectura: «falta configurar algo» no dice qué, y en Vercel hay tres sitios
 * donde se puede haber quedado a medias.
 */
export function faltaParaEscribir(): string | null {
  if (configDeGithub()) return null;
  const entorno = process.env.VERCEL_ENV === 'production' ? 'Production' : process.env.VERCEL_ENV === 'preview' ? 'Preview' : 'este entorno';
  if (!process.env.GITHUB_TOKEN?.trim()) {
    return (
      `Este despliegue (${entorno}${process.env.VERCEL_GIT_COMMIT_REF ? `, rama ${process.env.VERCEL_GIT_COMMIT_REF}` : ''}) ` +
      'no ve la variable GITHUB_TOKEN. En Vercel → Settings → Environment Variables, revisa que exista, que esté ' +
      `marcada para ${entorno} y vuelve a desplegar: las variables nuevas no llegan a un despliegue que ya estaba hecho.`
    );
  }
  return (
    'Hay GITHUB_TOKEN, pero no se sabe en qué repositorio escribir: Vercel no pasó VERCEL_GIT_REPO_OWNER ni ' +
    'VERCEL_GIT_REPO_SLUG. Agrega la variable GITHUB_REPO con el valor «dueño/repositorio» y vuelve a desplegar.'
  );
}

function github(config: NonNullable<ReturnType<typeof configDeGithub>>): Almacen {
  const { token, repo, rama, api } = config;
  const cabeceras = (accept = 'application/vnd.github+json') => ({
    Authorization: `Bearer ${token}`,
    Accept: accept,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'carruseles',
  });
  const camino = (ruta: string) => rutaDelRepo(ruta).split('/').map(encodeURIComponent).join('/');

  async function pedir(metodo: string, url: string, cuerpo?: unknown) {
    const r = await fetch(`${api}/repos/${repo}${url}`, {
      method: metodo,
      headers: { ...cabeceras(), ...(cuerpo ? { 'Content-Type': 'application/json' } : {}) },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      cache: 'no-store',
    });
    if (!r.ok) {
      const texto = await r.text().catch(() => '');
      // Leer funciona y escribir no: es el permiso del token, no la app. Se
      // dice qué tocar en vez de enseñar la respuesta de GitHub en crudo.
      const mensaje =
        r.status === 403 || r.status === 404
          ? `GitHub no deja escribir en ${repo} con este token (${r.status}). En GitHub → Settings → ` +
            'Developer settings → Fine-grained tokens → el token → Edit: que «Repository access» incluya este ' +
            'repositorio y que «Contents» sea «Read and write». Si el repositorio es de una organización, un ' +
            'dueño tiene que aprobar el token en la organización → Settings → Personal access tokens.'
          : r.status === 401
            ? 'GitHub no reconoce el token (401): caducó o se copió mal. Crea otro y actualiza GITHUB_TOKEN en Vercel.'
            : `GitHub respondió ${r.status} en ${metodo} ${url}: ${texto.slice(0, 200)}`;
      const error = new Error(mensaje);
      (error as Error & { estado?: number }).estado = r.status;
      throw error;
    }
    return r.json();
  }

  async function leer(ruta: string): Promise<Buffer | null> {
    const r = await fetch(`${api}/repos/${repo}/contents/${camino(ruta)}?ref=${encodeURIComponent(rama)}`, {
      headers: cabeceras('application/vnd.github.raw+json'),
      cache: 'no-store',
    });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`GitHub respondió ${r.status} al leer ${rutaDelRepo(ruta)}.`);
    return Buffer.from(await r.arrayBuffer());
  }

  async function listar(dir: string): Promise<Entrada[]> {
    const r = await fetch(`${api}/repos/${repo}/contents/${camino(dir)}?ref=${encodeURIComponent(rama)}`, {
      headers: cabeceras(),
      cache: 'no-store',
    });
    if (r.status === 404) return [];
    if (!r.ok) throw new Error(`GitHub respondió ${r.status} al listar ${rutaDelRepo(dir)}.`);
    const cuerpo = await r.json();
    if (!Array.isArray(cuerpo)) return [];
    return cuerpo
      .filter((e: { type: string }) => e.type === 'file' || e.type === 'dir')
      .map((e: { name: string; type: string; size: number }) => ({
        nombre: e.name,
        tipo: e.type === 'dir' ? ('carpeta' as const) : ('archivo' as const),
        bytes: e.size ?? 0,
      }));
  }

  /**
   * Si la ruta es un archivo. No sirve `leer`: pedida a una carpeta, la API de
   * contenidos contesta con la lista en JSON, que parecería un archivo. Se
   * pregunta a la carpeta de arriba.
   */
  async function esArchivo(ruta: string): Promise<boolean> {
    const nombre = ruta.split(sep).pop();
    return (await listar(dirname(ruta))).some((e) => e.nombre === nombre && e.tipo === 'archivo');
  }

  async function listarTodo(dir: string): Promise<string[]> {
    const salida: string[] = [];
    for (const e of await listar(dir)) {
      const ruta = join(dir, e.nombre);
      if (e.tipo === 'carpeta') salida.push(...(await listarTodo(ruta)));
      else salida.push(ruta);
    }
    return salida;
  }

  /**
   * Un commit con todos los cambios, por la API de Git: blobs, árbol, commit
   * y mover la rama. Si otra escritura movió la rama en medio —el guardado
   * automático y una foto que termina de bajar—, se vuelve a armar encima de
   * la nueva punta. Los archivos son distintos, así que no se pisa nada.
   */
  async function escribir(cambios: Cambio[], mensaje: string) {
    if (!cambios.length) return;
    const entradas = await Promise.all(
      cambios.map(async ({ ruta, datos }) => {
        const path = rutaDelRepo(ruta);
        if (datos === null) return { path, mode: '100644', type: 'blob', sha: null };
        const blob = await pedir('POST', '/git/blobs', {
          content: Buffer.from(datos).toString('base64'),
          encoding: 'base64',
        });
        return { path, mode: '100644', type: 'blob', sha: blob.sha as string };
      }),
    );

    // Borrar una carpeta es borrar cada archivo de debajo: en un árbol de git
    // no hay carpetas vacías que quitar. Lo que se borra y se vuelve a escribir
    // en el mismo commit —reexportar un carrusel— se queda solo como escrito.
    const escritas = new Set(entradas.filter((e) => e.sha !== null).map((e) => e.path));
    const expandidas: typeof entradas = [];
    for (const e of entradas) {
      if (e.sha !== null) {
        expandidas.push(e);
        continue;
      }
      const debajo = await listarTodo(join(process.cwd(), e.path));
      if (debajo.length) {
        for (const ruta of debajo) {
          const path = rutaDelRepo(ruta);
          if (!escritas.has(path)) expandidas.push({ ...e, path });
        }
      } else if (!escritas.has(e.path) && (await esArchivo(join(process.cwd(), e.path)))) {
        expandidas.push(e);
      }
    }
    if (!expandidas.length) return;

    for (let intento = 0; ; intento++) {
      const ref = await pedir('GET', `/git/ref/heads/${encodeURIComponent(rama)}`);
      const padre = ref.object.sha as string;
      const commitPadre = await pedir('GET', `/git/commits/${padre}`);
      const arbol = await pedir('POST', '/git/trees', { base_tree: commitPadre.tree.sha, tree: expandidas });
      const commit = await pedir('POST', '/git/commits', { message: mensaje, tree: arbol.sha, parents: [padre] });
      try {
        await pedir('PATCH', `/git/refs/heads/${encodeURIComponent(rama)}`, { sha: commit.sha, force: false });
        return;
      } catch (e) {
        const estado = (e as Error & { estado?: number }).estado;
        if (intento >= 4 || (estado !== 409 && estado !== 422)) throw e;
        await new Promise((r) => setTimeout(r, 300 * (intento + 1)));
      }
    }
  }

  return {
    remoto: true,
    leer,
    leerTexto: async (ruta) => (await leer(ruta))?.toString('utf8') ?? null,
    // Pedida a una carpeta, la API contesta con su lista: existe también.
    existe: async (ruta) => (await leer(ruta)) !== null,
    listar,
    listarTodo,
    escribir,
  };
}

/* ── cuál ─────────────────────────────────────────────────────────────────── */

/**
 * En Vercel con `GITHUB_TOKEN`, el repositorio; si no, el disco. Se puede
 * forzar con `ALMACEN=github` (para probar en local contra un repositorio) o
 * `ALMACEN=disco`.
 */
function elegir(): Almacen {
  const pedido = process.env.ALMACEN?.trim();
  const config = configDeGithub();
  if (pedido === 'disco') return disco;
  if (pedido === 'github' || (process.env.VERCEL === '1' && config)) {
    if (!config) throw new Error('ALMACEN=github pide GITHUB_TOKEN y GITHUB_REPO.');
    return github(config);
  }
  return disco;
}

/**
 * Las escrituras de este proceso, en fila. En GitHub dos commits a la vez se
 * pelean por la punta de la rama; aquí se ordenan antes de llegar allá.
 */
let fila: Promise<unknown> = Promise.resolve();

const elegido = elegir();

export const almacen: Almacen = {
  ...elegido,
  escribir(cambios, mensaje) {
    const turno = fila.then(() => elegido.escribir(cambios, mensaje));
    fila = turno.catch(() => {});
    return turno;
  },
};

/** Si se escribe en el repositorio y no en el disco. */
export const remoto = almacen.remoto;

/** Para una escritura de texto o binario sola. */
export function guardar(ruta: string, datos: Buffer | string, mensaje: string) {
  return almacen.escribir([{ ruta, datos }], mensaje);
}

/**
 * La URL con la que el navegador pide un archivo de `public/`.
 *
 * En la computadora, la de siempre: Next sirve `public/` tal cual. En Vercel
 * lo que hay en `public/` es lo del último build, y un PNG reexportado desde el
 * teléfono tiene el mismo nombre que el viejo: pedido por su ruta, saldría el
 * del build. Por eso allá se pide a /archivo, que lee del repositorio, con la
 * versión en la URL para que el teléfono no se quede con la copia de antes.
 */
export function urlServida(rutaPublica: string, version?: string): string {
  if (!remoto) return rutaPublica;
  return `/archivo${rutaPublica}${version ? `?v=${encodeURIComponent(version)}` : ''}`;
}
