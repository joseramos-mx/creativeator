import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import JSZip from 'jszip';
import { z } from 'zod';
import { exportarSlides, guardarEnDisco } from '@/lib/exportar';
import { leerPost } from '@/lib/posts';
import { validar, type TPost } from '@/lib/schema';
import { avisoDeSoloLectura, soloLectura } from '@/lib/soloLectura';

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
  if (soloLectura) return avisoDeSoloLectura();

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

    // El copy viaja con las imágenes: es la otra mitad del trabajo de publicar,
    // y buscarlo aparte es justo lo que se hace a mano hoy.
    if (post.copy) {
      zip.file('copy.txt', post.copy);
      await writeFile(join(carpeta, 'copy.txt'), post.copy, 'utf8');
    }

    // Y los créditos de las fotos viajan igual, por la misma razón: el ZIP es
    // lo que sale de aquí, y si la licencia se queda en el JSON, quien publique
    // no la tiene. Se escribe también cuando falta, diciendo que falta: una
    // línea en blanco no distingue "sin foto" de "sin registrar".
    const creditos = creditosDe(post);
    if (creditos) {
      zip.file('creditos.txt', creditos);
      await writeFile(join(carpeta, 'creditos.txt'), creditos, 'utf8');
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

/**
 * Las fotos del carrusel, con su procedencia, en el orden en que van.
 *
 * Devuelve undefined si el carrusel no lleva ninguna foto: un archivo vacío en
 * el ZIP es ruido. Pero si lleva fotos sin registrar, el archivo se escribe y
 * lo dice, que es distinto de no escribirlo.
 */
function creditosDe(post: TPost): string | undefined {
  const fotos = post.slides.flatMap((slide, i) => {
    if (slide.tipo === 'portada' && slide.foto) {
      return [{ n: i, src: slide.foto, credito: slide.fotoCredito }];
    }
    if (slide.tipo === 'contenido' && slide.visual.clase === 'foto') {
      return [{ n: i, src: slide.visual.src, credito: slide.visual.credito }];
    }
    return [];
  });

  if (fotos.length === 0) return undefined;

  const lineas = fotos.map(({ n, src, credito }) => {
    const cabecera = `${String(n).padStart(2, '0')} · ${src}`;
    if (!credito) return `${cabecera}\n   SIN REGISTRAR de dónde salió ni bajo qué licencia.`;
    return [
      cabecera,
      `   fuente: ${credito.fuente}`,
      `   licencia: ${credito.licencia}`,
      credito.autor ? `   autor: ${credito.autor}` : null,
      credito.url ? `   original: ${credito.url}` : null,
      credito.consentimiento ? `   consentimiento: ${credito.consentimiento}` : null,
    ]
      .filter(Boolean)
      .join('\n');
  });

  return `Fotos de "${post.tema}" (${post.slug})\n\n${lineas.join('\n\n')}\n`;
}
