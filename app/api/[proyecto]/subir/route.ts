import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { proyectoDe, proyectoInexistente, type ConProyecto } from '@/lib/peticion';
import { rutasDe } from '@/lib/proyecto';
import { avisoDeSoloLectura, soloLectura } from '@/lib/soloLectura';

/**
 * POST /api/<proyecto>/subir — recibe una imagen y devuelve su ruta pública.
 *
 * Guarda siempre una copia local en public/proyectos/<id>/media/<slug>/. Nada de URLs
 * externas: Pinterest no es un CDN y los enlaces caducan, así que el PNG sale
 * con un hueco meses después de publicado y nadie sabe por qué.
 *
 * De paso la baja a 1600 px de ancho. Un JPEG de cámara de 8 MB no aporta nada
 * a un slide de 1080 px y hace la captura más lenta.
 */

const ANCHO_MAX = 1600;

export async function POST(req: Request, ctx: ConProyecto) {
  if (soloLectura) return avisoDeSoloLectura();
  const proyecto = await proyectoDe(ctx);
  if (!proyecto) return proyectoInexistente();

  try {
    const form = await req.formData();
    const archivo = form.get('archivo');
    const slug = String(form.get('slug') ?? '');

    if (!(archivo instanceof File)) return Response.json({ error: 'Falta el archivo.' }, { status: 400 });
    if (!/^[a-z0-9-]+$/.test(slug)) return Response.json({ error: 'Slug inválido.' }, { status: 400 });
    if (!archivo.type.startsWith('image/')) {
      return Response.json({ error: 'Eso no es una imagen.' }, { status: 400 });
    }

    const entrada = sharp(Buffer.from(await archivo.arrayBuffer()));
    const meta = await entrada.metadata();
    const redimensionar = (meta.width ?? 0) > ANCHO_MAX;
    const tuboAlfa = Boolean(meta.hasAlpha);

    let salida = redimensionar ? entrada.resize({ width: ANCHO_MAX }) : entrada;
    // Con transparencia se queda en PNG; si no, JPEG de calidad 88.
    salida = tuboAlfa ? salida.png() : salida.jpeg({ quality: 88, mozjpeg: true });

    const nombre = normalizar(archivo.name, tuboAlfa ? 'png' : 'jpg');
    const rutas = rutasDe(proyecto);
    const carpeta = rutas.media(slug);
    await mkdir(carpeta, { recursive: true });
    await writeFile(join(carpeta, nombre), await salida.toBuffer());

    return Response.json({ ruta: rutas.urlMedia(slug, nombre) });
  } catch (e) {
    const error = e instanceof Error ? e.message : 'No se pudo subir la imagen.';
    return Response.json({ error }, { status: 400 });
  }
}

/** Minúsculas, sin acentos y sin espacios: los nombres de archivo raros dan guerra. */
function normalizar(nombre: string, extension: string) {
  const base = nombre
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return `${base || 'imagen'}-${Date.now().toString(36)}.${extension}`;
}
