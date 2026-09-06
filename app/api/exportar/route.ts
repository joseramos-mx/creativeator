import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import JSZip from 'jszip';
import { z } from 'zod';
import { exportarSlides, guardarEnDisco } from '@/lib/exportar';
import { leerPost } from '@/lib/posts';
import { validar } from '@/lib/schema';

/**
 * POST /api/exportar
 *
 * `{ slug, slides?: number[], escala?: number }` → un PNG si es un solo slide,
 * o un ZIP con el carrusel completo y su pie de foto.
 *
 * Las posiciones empiezan en 1 y son las del carrusel, no el número que se
 * pinta en la esquina: la portada es la 1 aunque no lleve número.
 */

export const maxDuration = 300;

const Peticion = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  slides: z.array(z.number().int().positive()).optional(),
  /** 1 sirve para verificar contra la vista previa píxel a píxel. */
  escala: z.number().int().min(1).max(3).optional(),
});

export async function POST(req: Request) {
  try {
    const cuerpo = validar(Peticion, await req.json(), 'la petición de exportación');
    const post = await leerPost(cuerpo.slug);
    const todas = post.slides.map((_, i) => i + 1);
    const pedidas = (cuerpo.slides ?? todas).filter((n) => n >= 1 && n <= post.slides.length);

    if (pedidas.length === 0) {
      return Response.json({ error: 'No hay slides que exportar.' }, { status: 400 });
    }

    // La app se captura a sí misma, así que el origen sale de esta petición.
    // Así funciona en el puerto que sea, sin configurar nada.
    const base = process.env.BASE_URL ?? new URL(req.url).origin;

    const archivos = await exportarSlides({
      slug: cuerpo.slug,
      slides: pedidas,
      base,
      escala: cuerpo.escala,
    });
    const carpeta = await guardarEnDisco(cuerpo.slug, archivos);

    if (archivos.length === 1) {
      const uno = archivos[0];
      return new Response(new Uint8Array(uno.png), {
        headers: {
          'Content-Type': 'image/png',
          'Content-Disposition': `attachment; filename="${cuerpo.slug}-${uno.nombre}"`,
          'X-Salida': carpeta,
        },
      });
    }

    const zip = new JSZip();
    for (const a of archivos) zip.file(a.nombre, a.png);

    // El pie de foto viaja con las imágenes: es la otra mitad del trabajo de
    // publicar, y buscarlo aparte es justo lo que se hace a mano hoy.
    if (post.pieDeFoto) {
      zip.file('pie-de-foto.txt', post.pieDeFoto);
      await writeFile(join(carpeta, 'pie-de-foto.txt'), post.pieDeFoto, 'utf8');
    }

    const blob = await zip.generateAsync({ type: 'nodebuffer' });
    return new Response(new Uint8Array(blob), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="carrusel-${cuerpo.slug}.zip"`,
        'X-Salida': carpeta,
      },
    });
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : 'Error desconocido al exportar.';
    return Response.json({ error: mensaje }, { status: 400 });
  }
}
