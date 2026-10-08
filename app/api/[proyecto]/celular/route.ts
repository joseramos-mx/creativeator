import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { exportarSlides } from '@/lib/exportar';
import { proyectoDe, proyectoInexistente, type ConProyecto } from '@/lib/peticion';
import { leerPost } from '@/lib/posts';
import { rutasDe } from '@/lib/proyecto';
import { validar } from '@/lib/schema';
import { avisoDeSoloLectura, soloLectura } from '@/lib/soloLectura';

/**
 * POST /api/<proyecto>/celular — `{ slug, quitar? }`
 *
 * Deja un carrusel listo para bajarlo desde el teléfono: lo exporta a
 * `public/proyectos/<id>/descargas/<slug>/` y lo apunta en el índice que lee /<proyecto>/descargas.
 *
 * ── Por qué esto existe además del script ───────────────────────────────────
 * Porque `npm run celular <slug>` obliga a saberse el slug y a estar en la
 * terminal. Lo normal es acabar un carrusel, mirarlo en la lista y querer
 * mandarlo al teléfono desde ahí mismo.
 *
 * ── Por qué solo corre en tu máquina ────────────────────────────────────────
 * Porque exportar abre un Chromium de verdad y escribe archivos, y en Vercel no
 * hay ni lo uno ni lo otro. Allá esta ruta contesta que no y dice dónde sí. El
 * despliegue **sirve** lo que aquí se preparó; no lo genera.
 *
 * ── Y por qué hace falta un push ────────────────────────────────────────────
 * Los PNG viven en el repositorio, que es de donde Vercel los sirve. Así que
 * preparar deja el archivo aquí, y para verlo en el teléfono hay que subirlo.
 * La página lo dice; no es algo que deba adivinarse.
 */

export const maxDuration = 300;

const Peticion = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  quitar: z.boolean().optional(),
});

async function leerIndice(proyecto: string): Promise<Array<Record<string, unknown>>> {
  return JSON.parse(await readFile(rutasDe(proyecto).indiceDescargas, 'utf8').catch(() => '[]'));
}

/** La huella del carrusel tal como está en disco: ver `app/[proyecto]/descargas`. */
async function huellaDe(proyecto: string, slug: string) {
  const crudo = await readFile(rutasDe(proyecto).post(slug), 'utf8');
  return createHash('sha1').update(crudo).digest('hex').slice(0, 12);
}

async function guardarIndice(proyecto: string, indice: Array<Record<string, unknown>>) {
  indice.sort((a, b) => String(b.exportado).localeCompare(String(a.exportado)));
  const rutas = rutasDe(proyecto);
  await mkdir(rutas.descargas, { recursive: true });
  await writeFile(rutas.indiceDescargas, `${JSON.stringify(indice, null, 2)}\n`, 'utf8');
}

export async function POST(req: Request, ctx: ConProyecto) {
  if (soloLectura) return avisoDeSoloLectura();
  const proyecto = await proyectoDe(ctx);
  if (!proyecto) return proyectoInexistente();
  const DESTINO = rutasDe(proyecto).descargas;

  try {
    const { slug, quitar } = validar(Peticion, await req.json(), 'la petición');

    if (quitar) {
      await rm(join(DESTINO, slug), { recursive: true, force: true });
      await guardarIndice(proyecto, (await leerIndice(proyecto)).filter((e) => e.slug !== slug));
      return Response.json({ ok: true, quitado: slug });
    }

    const post = await leerPost(proyecto, slug);
    const base = process.env.BASE_URL ?? new URL(req.url).origin;

    // Escala 1: 1080 × 1350, el tamaño nativo de Instagram. Es también lo que
    // hace que esto quepa en el repositorio — ver scripts/para-el-celular.mjs.
    const archivos = await exportarSlides({
      proyecto,
      slug,
      slides: post.slides.map((_, i) => i + 1),
      base,
      escala: 1,
    });

    await mkdir(join(DESTINO, slug), { recursive: true });
    await Promise.all(archivos.map((a) => writeFile(join(DESTINO, slug, a.nombre), a.png)));

    const indice = await leerIndice(proyecto);
    const entrada = {
      slug,
      tema: post.tema,
      estado: post.estado,
      exportado: new Date().toISOString(),
      huella: await huellaDe(proyecto, slug),
      slides: archivos.map((a) => a.nombre),
    };
    const i = indice.findIndex((e) => e.slug === slug);
    if (i === -1) indice.push(entrada);
    else indice[i] = entrada;
    await guardarIndice(proyecto, indice);

    const pesoMB = archivos.reduce((s, a) => s + a.png.length, 0) / 1048576;
    return Response.json({ ok: true, slides: archivos.length, pesoMB: Number(pesoMB.toFixed(1)) });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'No se pudo preparar.' }, { status: 400 });
  }
}
