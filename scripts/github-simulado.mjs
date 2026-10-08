/**
 * scripts/github-simulado.mjs — `npm run github-simulado [puerto]`
 *
 * Un GitHub de mentira, para probar el modo Vercel sin token y sin red.
 *
 * Habla la parte de la API que usa lib/almacen.ts —leer y listar contenidos,
 * y escribir con blobs, árboles, commits y mover la rama— y por debajo es la
 * carpeta del proyecto: leer es leer el disco, y mover la rama aplica el commit
 * al disco. Así la suite de Playwright, que comprueba lo que quedó escrito
 * leyendo los archivos, corre igual en los dos modos:
 *
 *   npm run github-simulado 3999
 *   ALMACEN=github GITHUB_TOKEN=prueba GITHUB_REPO=yo/carruseles \
 *     GITHUB_API_URL=http://localhost:3999 npm run dev:solo -- -p 3002
 *   ALMACEN=github npm run pruebas 3002
 *
 * Lo que sí comprueba de verdad: que los commits van encima de la punta de la
 * rama (si no, contesta 422 como GitHub, y el almacén tiene que reintentar),
 * que un commit trae todos sus archivos, y que se borra lo que se pide borrar.
 * Cuenta los commits en GET /__commits, para ver cuántos genera un uso normal.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';

const puerto = Number(process.argv[2] ?? 3999);
const RAIZ = process.cwd();

const sha = (texto) => createHash('sha1').update(texto).digest('hex');
const blobs = new Map();
const arboles = new Map(); // sha → { base, entradas }
const commits = new Map(); // sha → { arbol, padres, mensaje }
let punta = 'inicio';
commits.set(punta, { arbol: 'arbol-inicial', padres: [], mensaje: 'inicio' });
let cuantos = 0;

/** Los cambios de un árbol respecto a su base: lo único que hay que aplicar. */
function cambiosDe(arbolSha) {
  const arbol = arboles.get(arbolSha);
  return arbol ? arbol.entradas : [];
}

function aplicar(commitSha) {
  for (const e of cambiosDe(commits.get(commitSha).arbol)) {
    const ruta = join(RAIZ, e.path);
    if (e.sha === null) {
      // Un árbol de git no tiene carpetas vacías: al borrar el último archivo,
      // la carpeta desaparece. Se imita, o el disco diría que sigue ahí.
      rmSync(ruta, { force: true });
      for (let dir = dirname(ruta); dir.startsWith(RAIZ) && dir !== RAIZ; dir = dirname(dir)) {
        if (readdirSync(dir).length) break;
        rmSync(dir, { recursive: true, force: true });
      }
    } else {
      mkdirSync(dirname(ruta), { recursive: true });
      writeFileSync(ruta, blobs.get(e.sha));
    }
  }
}

function leerCuerpo(req) {
  return new Promise((resolver) => {
    const trozos = [];
    req.on('data', (t) => trozos.push(t));
    req.on('end', () => resolver(trozos.length ? JSON.parse(Buffer.concat(trozos).toString('utf8')) : {}));
  });
}

const json = (res, estado, cuerpo) => {
  res.writeHead(estado, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(cuerpo));
};

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${puerto}`);
  if (url.pathname === '/__commits') return json(res, 200, { commits: cuantos });
  if (!/^Bearer \S+/.test(req.headers.authorization ?? '')) return json(res, 401, { message: 'Bad credentials' });

  const m = url.pathname.match(/^\/repos\/[^/]+\/[^/]+(\/.*)$/);
  if (!m) return json(res, 404, { message: 'Not Found' });
  const resto = m[1];

  // ── contenidos ──
  if (req.method === 'GET' && resto.startsWith('/contents/')) {
    const ruta = decodeURIComponent(resto.slice('/contents/'.length));
    const absoluta = join(RAIZ, ruta);
    if (!existsSync(absoluta)) return json(res, 404, { message: 'Not Found' });
    if (statSync(absoluta).isDirectory()) {
      const lista = readdirSync(absoluta, { withFileTypes: true }).map((e) => ({
        name: e.name,
        path: `${ruta}/${e.name}`,
        type: e.isDirectory() ? 'dir' : 'file',
        size: e.isDirectory() ? 0 : statSync(join(absoluta, e.name)).size,
      }));
      return json(res, 200, lista);
    }
    if ((req.headers.accept ?? '').includes('raw')) {
      res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
      return res.end(readFileSync(absoluta));
    }
    return json(res, 200, { type: 'file', name: ruta.split('/').pop(), path: ruta, size: statSync(absoluta).size });
  }

  // ── git ──
  if (req.method === 'GET' && resto.startsWith('/git/ref/heads/')) {
    return json(res, 200, { ref: 'refs/heads/main', object: { sha: punta, type: 'commit' } });
  }
  if (req.method === 'GET' && resto.startsWith('/git/commits/')) {
    const c = commits.get(resto.slice('/git/commits/'.length));
    return c ? json(res, 200, { sha: resto.slice(13), tree: { sha: c.arbol } }) : json(res, 404, { message: 'Not Found' });
  }
  if (req.method === 'POST' && resto === '/git/blobs') {
    const { content, encoding } = await leerCuerpo(req);
    const datos = Buffer.from(content, encoding === 'base64' ? 'base64' : 'utf8');
    const s = sha(datos);
    blobs.set(s, datos);
    return json(res, 201, { sha: s });
  }
  if (req.method === 'POST' && resto === '/git/trees') {
    const { base_tree, tree } = await leerCuerpo(req);
    for (const e of tree) {
      if (e.sha !== null && !blobs.has(e.sha)) return json(res, 422, { message: `blob ${e.sha} no existe` });
    }
    const s = sha(JSON.stringify({ base_tree, tree, t: Date.now(), r: Math.random() }));
    arboles.set(s, { base: base_tree, entradas: tree });
    return json(res, 201, { sha: s });
  }
  if (req.method === 'POST' && resto === '/git/commits') {
    const { message, tree, parents } = await leerCuerpo(req);
    if (!arboles.has(tree)) return json(res, 422, { message: 'tree no existe' });
    const s = sha(JSON.stringify({ message, tree, parents, t: Date.now(), r: Math.random() }));
    commits.set(s, { arbol: tree, padres: parents, mensaje: message });
    return json(res, 201, { sha: s });
  }
  if (req.method === 'PATCH' && resto.startsWith('/git/refs/heads/')) {
    const { sha: nuevo, force } = await leerCuerpo(req);
    const c = commits.get(nuevo);
    if (!c) return json(res, 422, { message: 'commit no existe' });
    // Lo que hace GitHub: sin force, solo avanza si el commit va encima.
    if (!force && c.padres[0] !== punta) return json(res, 422, { message: 'Update is not a fast forward' });
    aplicar(nuevo);
    punta = nuevo;
    cuantos++;
    console.log(`  commit ${cuantos}: ${c.mensaje}`);
    return json(res, 200, { ref: 'refs/heads/main', object: { sha: nuevo } });
  }

  return json(res, 404, { message: `No simulado: ${req.method} ${resto}` });
}).listen(puerto, () => console.log(`GitHub simulado en http://localhost:${puerto}, sobre ${RAIZ}`));
