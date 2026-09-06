/**
 * scripts/ingesta-iconos.mjs
 *
 *   node scripts/ingesta-iconos.mjs <carpeta>        una pasada
 *   node scripts/ingesta-iconos.mjs <carpeta> --vigilar   se queda mirando
 *
 * Indexa una carpeta de PNG de íconos 3D para usarlos sin red y con tamaños
 * homogéneos. Con cada archivo:
 *
 *   1. Normaliza el nombre a slug.
 *   2. Recorta el margen transparente y lo recentra sobre un lienzo cuadrado
 *      con 4 % de aire. Sin esto, dos íconos puestos al mismo tamaño en CSS se
 *      ven de tamaños distintos, que es la queja número uno al maquetar.
 *   3. Escribe 1024 px en public/iconos/ y una miniatura de 192 px en thumbs/.
 *   4. Acumula public/iconos/manifest.json con las etiquetas de búsqueda.
 *
 * Es incremental: si el slug ya existe y el archivo pesa lo mismo, lo salta.
 * Correrlo dos veces no duplica trabajo.
 *
 * Con `--vigilar` se queda observando la carpeta y procesa cada PNG nuevo en
 * cuanto aparece. Es para el goteo: bajas un ícono y dos segundos después ya
 * está en el buscador del editor, sin copiar archivos a mano. `npm run dev` lo
 * arranca junto al servidor.
 *
 * Licencia: los íconos de Thiings no se pueden redistribuir. public/iconos/
 * está en .gitignore y solo se versiona el manifiesto.
 */

import { watch } from 'chokidar';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const VIGILAR = process.argv.includes('--vigilar');

/**
 * De dónde salen los íconos, en este orden: el argumento, la variable de
 * entorno ICONOS_ORIGEN, o `iconos-entrada/` dentro del proyecto.
 *
 * La carpeta propia es el valor por omisión a propósito. Vigilar ~/Descargas es
 * más cómodo —el navegador deja ahí lo que bajas— pero también significa que
 * cualquier PNG que caiga ahí entra a la librería. Si lo prefieres así:
 *
 *     ICONOS_ORIGEN=~/Descargas npm run dev
 */
const argumento = process.argv[2]?.startsWith('--') ? undefined : process.argv[2];
const ORIGEN = argumento ?? process.env.ICONOS_ORIGEN ?? path.join(process.cwd(), 'iconos-entrada');

const DESTINO = path.join(process.cwd(), 'public', 'iconos');
const THUMBS = path.join(DESTINO, 'thumbs');
const MANIFEST = path.join(DESTINO, 'manifest.json');
const SINONIMOS = path.join(process.cwd(), 'content', 'sinonimos.json');

const TAM = 1024;
const THUMB = 192;
const AIRE = 0.04;
const BYTES_MINIMOS = 2048; // para no tragarse cualquier captura de pantalla

const slugificar = (nombre) =>
  nombre
    .replace(/\.png$/i, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/**
 * Los nombres vienen en inglés y aquí se busca en español, así que cada palabra
 * del slug arrastra sus sinónimos. El diccionario está en content/sinonimos.json
 * y se edita a mano: para las doscientas palabras que de verdad se usan en
 * dermatología alcanza y sobra.
 */
async function leerSinonimos() {
  return fs
    .readFile(SINONIMOS, 'utf8')
    .then(JSON.parse)
    .catch(() => ({}));
}

function etiquetar(slug, nombre, sinonimos) {
  const palabras = [...slug.split('-'), ...slugificar(nombre).split('-')].filter(Boolean);
  // Se busca el slug entero y también cada palabra suelta: "cuidado-de-piel"
  // tiene sus propios sinónimos, y "piel" los suyos.
  const extra = [slug, ...palabras].flatMap((p) => sinonimos[p] ?? []);
  return [...new Set([...palabras, ...extra])];
}

async function cargarManifiesto() {
  const previo = await fs
    .readFile(MANIFEST, 'utf8')
    .then(JSON.parse)
    .catch(() => []);
  return new Map(previo.map((e) => [e.slug, e]));
}

async function guardarManifiesto(indice) {
  const lista = [...indice.values()].sort((a, b) => a.slug.localeCompare(b.slug));
  await fs.writeFile(MANIFEST, `${JSON.stringify(lista, null, 1)}\n`);
  return lista.length;
}

/** Recorta el transparente y recentra con aire. Devuelve el PNG a 1024 px. */
async function normalizar(origen) {
  const recortado = await sharp(origen).trim({ threshold: 1 }).toBuffer();
  const lado = Math.round(TAM * (1 - AIRE * 2));
  const borde = Math.round(TAM * AIRE);
  return sharp(recortado)
    .resize(lado, lado, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({
      top: borde,
      bottom: borde,
      left: borde,
      right: borde,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function procesar(origen, indice, sinonimos) {
  const nombre = path.basename(origen);
  if (!/\.png$/i.test(nombre)) return 'ignorado';

  const slug = slugificar(nombre);
  if (!slug) return 'ignorado';

  const { size } = await fs.stat(origen);
  if (size < BYTES_MINIMOS) return 'ignorado';
  if (indice.get(slug)?.bytes === size) return 'sin cambios';

  // Los íconos 3D vienen con fondo transparente; una captura de pantalla no.
  // Es el filtro más barato para que la carpeta vigilada no se trague
  // cualquier PNG que caiga ahí.
  const meta = await sharp(origen).metadata();
  if (!meta.hasAlpha) return 'ignorado';

  const png = await normalizar(origen);
  await fs.writeFile(path.join(DESTINO, `${slug}.png`), png);
  await sharp(png).resize(THUMB, THUMB).png().toFile(path.join(THUMBS, `${slug}.png`));

  indice.set(slug, {
    slug,
    nombre: nombre.replace(/\.png$/i, ''),
    etiquetas: etiquetar(slug, nombre.replace(/\.png$/i, ''), sinonimos),
    w: TAM,
    h: TAM,
    bytes: size,
  });
  return 'nuevo';
}

async function main() {
  await fs.mkdir(THUMBS, { recursive: true });
  await fs.mkdir(ORIGEN, { recursive: true });
  const sinonimos = await leerSinonimos();
  const indice = await cargarManifiesto();

  const entradas = await fs.readdir(ORIGEN, { recursive: true, withFileTypes: true });
  const cuenta = { nuevo: 0, 'sin cambios': 0, ignorado: 0, error: 0 };

  for (const d of entradas) {
    if (!d.isFile()) continue;
    const origen = path.join(d.parentPath ?? d.path ?? ORIGEN, d.name);
    try {
      cuenta[await procesar(origen, indice, sinonimos)]++;
    } catch (e) {
      cuenta.error++;
      console.warn(`  saltado ${d.name}: ${e.message}`);
    }
  }

  const total = await guardarManifiesto(indice);
  console.log(
    `${cuenta.nuevo} nuevos, ${cuenta['sin cambios']} sin cambios, ` +
      `${cuenta.ignorado} ignorados, ${cuenta.error} con error. ${total} íconos en el manifiesto.`,
  );

  if (!VIGILAR) return;

  console.log(`\nVigilando ${ORIGEN}. Baja un ícono y aparece solo en el buscador.`);
  const vigia = watch(ORIGEN, {
    ignoreInitial: true,
    // Un PNG que todavía se está bajando pesa distinto cada milisegundo: se
    // espera a que deje de crecer antes de tocarlo.
    awaitWriteFinish: { stabilityThreshold: 700, pollInterval: 100 },
  });

  vigia.on('add', async (ruta) => {
    try {
      const que = await procesar(ruta, indice, sinonimos);
      if (que !== 'nuevo') return;
      const total = await guardarManifiesto(indice);
      console.log(`  + ${slugificar(path.basename(ruta))} (${total} en total)`);
    } catch (e) {
      console.warn(`  saltado ${path.basename(ruta)}: ${e.message}`);
    }
  });
}

main();
