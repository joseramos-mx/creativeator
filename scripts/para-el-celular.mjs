/**
 * scripts/para-el-celular.mjs — `npm run celular <slug…> [--puerto 3000]`
 *
 * Exporta un carrusel a `public/descargas/<slug>/` para poder bajarlo desde el
 * teléfono en el despliegue de Vercel.
 *
 * ── Por qué se exporta aquí y no allá ───────────────────────────────────────
 * Porque en Vercel no se puede. La exportación abre un Chromium de verdad y
 * escribe archivos, y allá el disco es de solo lectura y cada petición corre en
 * un contenedor que se destruye al terminar. Así que el trabajo pesado se queda
 * en esta máquina —donde ya funciona— y el despliegue solo **sirve** lo que este
 * script dejó hecho. No hay nada que portar.
 *
 * ── Por qué a escala 1 ──────────────────────────────────────────────────────
 * 1080 × 1350 es el tamaño nativo de Instagram y pesa 2,5 MB por carrusel
 * frente a 7,1 MB de la escala 2. Estos PNG van al repositorio para que Vercel
 * pueda servirlos, así que el peso es lo que decide si esto es viable: los
 * diecisiete a escala 2 serían 120 MB, más de lo que pesa el proyecto entero.
 *
 * ── Por qué se exporta uno y no todos ───────────────────────────────────────
 * Porque son archivos derivados y **caducan**: en cuanto edites un slide, el
 * PNG guardado deja de corresponder al carrusel. Exportar los diecisiete
 * "por si acaso" llena el repositorio de imágenes viejas. El camino de todos
 * los días es el otro: acabas un carrusel, lo exportas, lo subes, lo publicas
 * desde el teléfono.
 *
 * Y para lo que caduque igual, cada exportación guarda la **huella** del post
 * tal como estaba. Si después lo editas, la página de descargas lo dice en vez
 * de darte callado un PNG que ya no es el carrusel. Ver `app/descargas`.
 *
 * ── Por qué llama a la API en vez de exportar aquí ──────────────────────────
 * Porque es exactamente el mismo camino que usa el botón de la app, ya probado,
 * y porque `lib/exportar.ts` importa con el alias `@/`, que entiende Next pero
 * no el cargador de Node. Reimplementarlo aquí sería una segunda copia de la
 * exportación que se despegaría de la primera al primer cambio.
 */

import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import JSZip from 'jszip';

const DESTINO = join(process.cwd(), 'public', 'descargas');
const INDICE = join(DESTINO, 'indice.json');

const args = process.argv.slice(2);
const iPuerto = args.indexOf('--puerto');
const puerto = iPuerto === -1 ? '3000' : args[iPuerto + 1];
const base = `http://localhost:${puerto}`;
const slugs = args.filter((a, i) => !a.startsWith('--') && i !== iPuerto + 1);

const CARPETA_POSTS = join(process.cwd(), 'content', 'posts');

/** La huella del carrusel tal como está en disco ahora mismo. */
async function huellaDe(slug) {
  const crudo = await readFile(join(CARPETA_POSTS, `${slug}.json`), 'utf8');
  return createHash('sha1').update(crudo).digest('hex').slice(0, 12);
}

async function leerPostCrudo(slug) {
  return JSON.parse(await readFile(join(CARPETA_POSTS, `${slug}.json`), 'utf8').catch(() => 'null'));
}

async function leerIndice() {
  return JSON.parse(await readFile(INDICE, 'utf8').catch(() => '[]'));
}

if (slugs.length === 0) {
  const archivos = (await readdir(CARPETA_POSTS)).filter((a) => a.endsWith('.json'));
  const posts = await Promise.all(archivos.map(async (a) => await leerPostCrudo(a.replace(/\.json$/, ''))));
  const indice = await leerIndice();
  console.log('\nVa así:  npm run celular <slug> [--puerto 3000]\n');
  console.log('Carruseles que hay:\n');
  for (const p of posts.filter(Boolean).sort((a, b) => b.fecha.localeCompare(a.fecha))) {
    const ya = indice.find((e) => e.slug === p.slug);
    const marca = !ya ? '' : (await huellaDe(p.slug)) === ya.huella ? '  ← ya exportado' : '  ← exportado, pero cambió después';
    console.log(`  ${p.estado.padEnd(10)} ${p.slug}${marca}`);
  }
  console.log('\n  --quitar <slug>   lo borra de las descargas\n');
  process.exit(0);
}

/* ── quitar ───────────────────────────────────────────────────────────────── */

if (args.includes('--quitar')) {
  const indice = (await leerIndice()).filter((e) => !slugs.includes(e.slug));
  for (const slug of slugs) await rm(join(DESTINO, slug), { recursive: true, force: true });
  await writeFile(INDICE, `${JSON.stringify(indice, null, 2)}\n`, 'utf8');
  console.log(`\nQuitado(s) de las descargas: ${slugs.join(', ')}\n`);
  process.exit(0);
}

/* ── exportar ─────────────────────────────────────────────────────────────── */

// El servidor tiene que estar corriendo: la app se captura a sí misma.
const vivo = await fetch(base)
  .then((r) => r.ok)
  .catch(() => false);
if (!vivo) {
  console.error(`\nALTO: no hay nada en ${base}. Arranca \`npm run dev\` y dime el puerto con --puerto.\n`);
  process.exit(1);
}

const indice = await leerIndice();

for (const slug of slugs) {
  const post = await leerPostCrudo(slug);
  if (!post) {
    console.error(`  no existe  ${slug}`);
    continue;
  }

  process.stdout.write(`  ${slug} … `);

  // Escala 1: el tamaño nativo de Instagram, y el que hace que esto quepa en
  // el repositorio.
  const r = await fetch(`${base}/api/exportar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug, escala: 1 }),
  });
  if (!r.ok) {
    const { error } = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
    console.error(`falló — ${error}`);
    continue;
  }

  const zip = await JSZip.loadAsync(await r.arrayBuffer());
  const hechos = [];
  for (const nombre of Object.keys(zip.files).filter((n) => n.endsWith('.png')).sort()) {
    hechos.push({ nombre, png: await zip.files[nombre].async('nodebuffer') });
  }

  await mkdir(join(DESTINO, slug), { recursive: true });
  await Promise.all(hechos.map((a) => writeFile(join(DESTINO, slug, a.nombre), a.png)));

  const entrada = {
    slug,
    tema: post.tema,
    estado: post.estado,
    exportado: new Date().toISOString(),
    huella: await huellaDe(slug),
    slides: hechos.map((a) => a.nombre),
  };
  const i = indice.findIndex((e) => e.slug === slug);
  if (i === -1) indice.push(entrada);
  else indice[i] = entrada;

  const peso = hechos.reduce((s, a) => s + a.png.length, 0) / 1048576;
  console.log(`${hechos.length} slides · ${peso.toFixed(1)} MB`);
}

indice.sort((a, b) => b.exportado.localeCompare(a.exportado));
await mkdir(DESTINO, { recursive: true });
await writeFile(INDICE, `${JSON.stringify(indice, null, 2)}\n`, 'utf8');

console.log(`\nListo. ${indice.length} carrusel(es) en /descargas.`);
console.log('Haz commit de public/descargas/ y súbelo para verlo en el teléfono.\n');
