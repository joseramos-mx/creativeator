/**
 * scripts/comparar.mjs — `node scripts/comparar.mjs [puerto] [slug]`
 *
 * Hace las dos comparaciones que sostienen el proyecto:
 *
 *  1. Captura los slides del banco de pruebas a tamaño real en
 *     salidas/comparar/. Después, `python scripts/medir.py` los compara contra
 *     las capturas de los posts publicados y dice en qué renglón se corrió el
 *     diseño y cuántos píxeles. Eso responde "¿se parece a la referencia?".
 *
 *  2. Exporta el carrusel por la ruta real de exportación, a escala 1 para que
 *     los dos lados midan lo mismo, y lo diferencia píxel a píxel contra la
 *     vista previa de /post/[slug]. Eso responde "¿el PNG es lo que vi?".
 *
 * La segunda es la que conviene vigilar. Si sale distinta, casi siempre es que
 * el ajuste automático de texto no corrió en /render: el hook vive en template/
 * y lo usan las dos rutas justamente para que no pueda pasar, pero es el error
 * clásico de este tipo de proyecto y más vale que salte solo.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import JSZip from 'jszip';

const puerto = process.argv[2] ?? '3000';
const slug = process.argv[3] ?? 'impetigo-regreso-a-clases';
const base = `http://localhost:${puerto}`;

const dirComparar = join(process.cwd(), 'salidas', 'comparar');
const dirVerificar = join(process.cwd(), 'salidas', 'verificar');
mkdirSync(dirComparar, { recursive: true });
mkdirSync(dirVerificar, { recursive: true });

/**
 * Deja la página con los slides y nada más.
 *
 * Aparte de quitar el cromo, aplana la maquetación: sin padding, sin títulos de
 * sección y sin separación entre marcos. No es cosmética. Los encabezados miden
 * una altura fraccionaria, así que el slide acaba apoyado en media coordenada,
 * y entonces la captura sale de 1351 px y el texto se rasteriza con medio píxel
 * de corrimiento. La exportación siempre pinta el slide en 0,0 de un lienzo
 * exacto; para que la comparación diga algo, la vista previa tiene que estar
 * apoyada en enteros también.
 */
const SIN_CROMO =
  '.cromo,.etiqueta,nextjs-portal{display:none!important}' +
  '.banco > section > h2,.banco > section > p{display:none!important}' +
  '.banco{padding:0!important}.mazo{gap:0!important;padding:0!important}' +
  // el editor: fuera el panel y la barra, y el lienzo pegado a la esquina
  '.panel,.lienzo__barra{display:none!important}' +
  '.editor,.lienzo{display:block!important;height:auto!important;overflow:visible!important;padding:0!important}' +
  '.marco{margin:0!important;border-radius:0!important;box-shadow:none!important;background:none!important}';

const navegador = await chromium.launch();
const ctx = await navegador.newContext({
  viewport: { width: 1400, height: 1000 },
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();

/**
 * Abre una página del visor a 1:1 y devuelve los slides de un mazo.
 *
 * El mazo se pide por nombre y no por posición: /plantilla pinta ahora un mazo
 * por paleta, y una comparación que dependa del orden empieza a medir otra cosa
 * el día que se agregue una paleta nueva.
 */
async function abrirVisor(ruta, mazo) {
  await page.goto(`${base}${ruta}`, { waitUntil: 'networkidle', timeout: 120_000 });
  await page.getByRole('button', { name: '100%' }).click();
  await page.addStyleTag({ content: SIN_CROMO });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  const selector = mazo ? `[data-mazo="${mazo}"]` : '.mazo';
  return page.locator(selector).first().locator('.slide');
}

// ── 1. el banco de pruebas contra las capturas publicadas ───────────────────
console.log(`Capturando el banco de pruebas de ${base}/plantilla …`);
const banco = await abrirVisor('/plantilla', 'referencia');
const nBanco = await banco.count();
for (let i = 0; i < nBanco; i++) {
  await banco.nth(i).screenshot({ path: join(dirComparar, `${String(i).padStart(2, '0')}.png`) });
}
console.log(`  ${nBanco} slides en salidas/comparar/ — ahora: python scripts/medir.py\n`);

// ── 2. la exportación contra la vista previa ────────────────────────────────
console.log(`Capturando la vista previa de ${base}/post/${slug} …`);
const previa = await abrirVisor(`/post/${slug}`);
const total = await previa.count();
const vistas = [];
for (let i = 0; i < total; i++) {
  const ruta = join(dirVerificar, `vista-${String(i + 1).padStart(2, '0')}.png`);
  await previa.nth(i).screenshot({ path: ruta });
  vistas.push(ruta);
}

console.log('Exportando por /api/exportar a escala 1 …');
const r = await fetch(`${base}/api/exportar`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ slug, escala: 1 }),
});
if (!r.ok) {
  console.error('  la exportación falló:', await r.text());
  await navegador.close();
  process.exit(1);
}

const zip = await JSZip.loadAsync(Buffer.from(await r.arrayBuffer()));
const exportados = [];
for (let i = 1; i <= total; i++) {
  const nombre = `${String(i).padStart(2, '0')}.png`;
  const archivo = zip.file(nombre);
  if (!archivo) {
    console.error(`  el ZIP no trae ${nombre}`);
    continue;
  }
  const ruta = join(dirVerificar, `export-${nombre}`);
  writeFileSync(ruta, await archivo.async('nodebuffer'));
  exportados.push(ruta);
}

const copy = zip.file('copy.txt');
console.log(copy ? '  el ZIP incluye copy.txt' : '  ATENCIÓN: el ZIP no trae copy.txt');

// ── 3. la diferencia ───────────────────────────────────────────────────────
console.log('\nDiferencia entre el PNG exportado y la vista previa:');
/**
 * Umbral del veredicto, en píxeles que se mueven más de 8 de 255.
 *
 * Por debajo hay siempre algo: el borde antialiaseado de un ícono que se pinta
 * escalado y el tramado de los degradados no salen bit a bit iguales en dos
 * páginas distintas, y son diferencias que nadie ve.
 *
 * Lo que esta prueba busca es otra cosa: que el texto salga pintado en otro
 * tamaño porque el ajuste automático no corrió en /render. Eso mueve decenas de
 * miles de píxeles con deltas grandes y queda muy por encima de este número.
 */
const TOLERANCIA = 400;
let malos = 0;

for (let i = 0; i < exportados.length; i++) {
  const d = await diferencia(vistas[i], exportados[i]);
  const etiqueta = `slide ${String(i + 1).padStart(2, '0')}`;

  if (d.error) {
    console.log(`   ${etiqueta}  ${d.error}`);
    malos++;
    continue;
  }

  if (d.distintos === 0) {
    console.log(`   ${etiqueta}  idéntico (${d.ancho}×${d.alto})`);
    continue;
  }

  const mapa = `diff-${String(i + 1).padStart(2, '0')}.png`;
  if (d.mapa) writeFileSync(join(dirVerificar, mapa), Buffer.from(d.mapa, 'base64'));
  const detalle =
    `${d.distintos} px distintos, ${d.visibles} por encima de 8, delta máx ${d.maxDelta}` +
    `, el primero en ${d.primero.x},${d.primero.y} → ${mapa}`;

  if (d.visibles <= TOLERANCIA) {
    console.log(`   ${etiqueta}  misma maqueta · ${detalle}`);
  } else {
    console.log(`   ${etiqueta}  DISTINTO · ${detalle}`);
    malos++;
  }
}

console.log(
  malos === 0
    ? '\nLa maqueta del PNG es la de la vista previa: lo que ves es lo que sale.'
    : `\n${malos} slides no coinciden. Revisa que el ajuste automático corra también en /render.`,
);
if (malos > 0) process.exitCode = 1;

await navegador.close();

/**
 * Compara dos PNG píxel a píxel. La comparación la hace el mismo Chromium que
 * ya está abierto: decodifica los dos archivos en un canvas y recorre los
 * cuatro canales. Así el proyecto no carga una librería de imágenes solo para
 * esta verificación.
 */
async function diferencia(rutaA, rutaB) {
  const a = readFileSync(rutaA).toString('base64');
  const b = readFileSync(rutaB).toString('base64');

  return page.evaluate(
    async ([a, b]) => {
      const carga = (d) =>
        new Promise((res, rej) => {
          const img = new Image();
          img.onload = () => res(img);
          img.onerror = rej;
          img.src = `data:image/png;base64,${d}`;
        });

      const [ia, ib] = await Promise.all([carga(a), carga(b)]);
      if (ia.width !== ib.width || ia.height !== ib.height) {
        return { error: `miden distinto: ${ia.width}×${ia.height} vs ${ib.width}×${ib.height}` };
      }

      const pixeles = (img) => {
        const cv = document.createElement('canvas');
        cv.width = img.width;
        cv.height = img.height;
        const cx = cv.getContext('2d', { willReadFrequently: true });
        cx.drawImage(img, 0, 0);
        return cx.getImageData(0, 0, img.width, img.height).data;
      };

      const da = pixeles(ia);
      const db = pixeles(ib);
      let distintos = 0;
      let visibles = 0;
      let maxDelta = 0;
      let primero = null;

      for (let i = 0; i < da.length; i += 4) {
        const d = Math.max(
          Math.abs(da[i] - db[i]),
          Math.abs(da[i + 1] - db[i + 1]),
          Math.abs(da[i + 2] - db[i + 2]),
          Math.abs(da[i + 3] - db[i + 3]),
        );
        if (d === 0) continue;
        distintos++;
        // Un canal que se mueve 8 de 255 no lo ve nadie: es el borde
        // antialiaseado de un ícono o el tramado de un degradado. Lo que hay
        // que cazar es el texto pintado en otro tamaño, y eso mueve miles de
        // píxeles a la vez.
        if (d > 8) visibles++;
        if (d > maxDelta) maxDelta = d;
        if (!primero) {
          const p = i / 4;
          primero = { x: p % ia.width, y: Math.floor(p / ia.width) };
        }
      }

      // Una imagen con las diferencias en rojo sobre el export apagado, para
      // poder mirar dónde están en vez de adivinar por las coordenadas.
      let mapa = null;
      if (distintos > 0) {
        const cv = document.createElement('canvas');
        cv.width = ia.width;
        cv.height = ia.height;
        const cx = cv.getContext('2d');
        const salida = cx.createImageData(ia.width, ia.height);
        for (let i = 0; i < da.length; i += 4) {
          const dif =
            da[i] !== db[i] ||
            da[i + 1] !== db[i + 1] ||
            da[i + 2] !== db[i + 2] ||
            da[i + 3] !== db[i + 3];
          if (dif) {
            salida.data[i] = 255;
            salida.data[i + 1] = 0;
            salida.data[i + 2] = 80;
          } else {
            const gris = (db[i] + db[i + 1] + db[i + 2]) / 6 + 100;
            salida.data[i] = salida.data[i + 1] = salida.data[i + 2] = gris;
          }
          salida.data[i + 3] = 255;
        }
        cx.putImageData(salida, 0, 0);
        mapa = cv.toDataURL('image/png').split(',')[1];
      }

      return {
        ancho: ia.width,
        alto: ia.height,
        total: da.length / 4,
        distintos,
        visibles,
        maxDelta,
        primero,
        mapa,
      };
    },
    [a, b],
  );
}
