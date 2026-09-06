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
 * Licencia: los íconos de Thiings no se pueden redistribuir, así que
 * public/iconos/ está en .gitignore. Los íconos propios —los generados— sí se
 * versionan: la restricción es de ellos, no nuestra, y las excepciones las
 * escribe esta misma función a partir del campo `origen`.
 */

import { watch } from 'chokidar';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { etiquetar, slugificar } from '../lib/iconos/etiquetas.ts';
import { fusionar, gitignoreDeIconos } from '../lib/manifiesto.ts';

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
  // Las excepciones de git salen del campo `origen` de cada entrada, no de una
  // lista escrita a mano. Ver lib/manifiesto.ts.
  await fs.writeFile(path.join(DESTINO, '.gitignore'), gitignoreDeIconos(lista));
  return lista.length;
}

/**
 * El color dominante de la parte opaca del ícono.
 *
 * Los íconos de Thiings traen color fijo y no se recolorean, así que sobre un
 * fondo de su mismo tono se funden. Guardarlo aquí es lo que le permite al
 * buscador avisar antes, en vez de que la falla aparezca en el PNG exportado.
 *
 * Solo cuentan los píxeles bien opacos: el halo semitransparente del borde
 * mezcla con el fondo y arrastraría el promedio hacia el gris.
 */
async function colorDominante(png) {
  const { data, info } = await sharp(png)
    .resize(64, 64, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const cubos = new Map();
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i + 3] < 200) continue;
    // Se agrupa en cubos de 32 para que un degradado no se reparta en mil
    // colores distintos y ninguno gane.
    const clave = `${data[i] >> 5},${data[i + 1] >> 5},${data[i + 2] >> 5}`;
    const c = cubos.get(clave) ?? { n: 0, r: 0, g: 0, b: 0 };
    c.n++; c.r += data[i]; c.g += data[i + 1]; c.b += data[i + 2];
    cubos.set(clave, c);
  }

  let mejor = null;
  for (const c of cubos.values()) if (!mejor || c.n > mejor.n) mejor = c;
  if (!mejor) return null;

  const hex = (v) => Math.round(v / mejor.n).toString(16).padStart(2, '0');
  return `#${hex(mejor.r)}${hex(mejor.g)}${hex(mejor.b)}`.toUpperCase();
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

  // Se fusiona con lo que ya hubiera en vez de reconstruir la entrada entera:
  // la ingesta es dueña de lo que deriva del PNG y de nada más. Sin esto, un
  // ícono generado perdía su `origen`, su `proveedor` y sobre todo su `prompt`
  // —lo único que permite regenerarlo— cada vez que volvía a pasar por aquí.
  // Ver lib/manifiesto.ts.
  indice.set(
    slug,
    fusionar(indice.get(slug), {
      slug,
      nombre: nombre.replace(/\.png$/i, ''),
      etiquetas: etiquetar(slug, nombre.replace(/\.png$/i, ''), sinonimos),
      color: await colorDominante(png),
      w: TAM,
      h: TAM,
      bytes: size,
    }),
  );
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
      // Se relee el manifiesto en cada archivo nuevo. El vigía se queda horas
      // corriendo junto al servidor, y en ese rato alguien puede haber borrado
      // un ícono a mano; con el índice solo en memoria, el siguiente guardado
      // resucitaría lo borrado.
      const enDisco = await cargarManifiesto();
      for (const [slug, entrada] of indice) if (!enDisco.has(slug)) indice.delete(slug);
      for (const [slug, entrada] of enDisco) indice.set(slug, entrada);

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
