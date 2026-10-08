import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { archivoDe } from '@/lib/bancos';
import { proyectoDe, proyectoInexistente, type ConProyecto } from '@/lib/peticion';
import { leerProyecto } from '@/lib/posts';
import { rutasDe } from '@/lib/proyecto';
import { Aprobacion, Credito, validar } from '@/lib/schema';
import { avisoDeSoloLectura, soloLectura } from '@/lib/soloLectura';

/**
 * POST /api/<proyecto>/fotos/aprobar — `{ slug, candidato, aprobadaPor, nota? }`
 *
 * Baja la imagen clínica y la deja firmada, en un solo movimiento. Lo mismo que
 * hace la búsqueda contextual con el crédito, pero con una cosa más: **solo la
 * puede firmar el médico**. No es una preferencia del editor, se comprueba
 * aquí: `aprobadaPor` tiene que ser el nombre de proyecto.json.
 *
 * Que la comprobación esté en el servidor y no solo en el botón importa. Lo que
 * queda escrito en el JSON es el nombre de una persona con cédula al lado de
 * una imagen de piel enferma; un desactivado en el navegador no es suficiente
 * para eso.
 *
 * La huella es de los bytes ya procesados, que son los que se van a publicar.
 * Firmar el original y guardar otra cosa no serviría de nada.
 */

const ANCHO_MAX = 1600;

export async function POST(req: Request, ctx: ConProyecto) {
  if (soloLectura) return avisoDeSoloLectura();
  const proyecto = await proyectoDe(ctx);
  if (!proyecto) return proyectoInexistente();

  try {
    const { slug, candidato, aprobadaPor, nota } = await req.json();

    if (typeof slug !== 'string' || !/^[a-z0-9-]+$/.test(slug)) {
      return Response.json({ error: 'Slug inválido.' }, { status: 400 });
    }
    if (!candidato?.descarga || !candidato?.credito) {
      return Response.json(
        { error: 'Ese candidato no trae de dónde bajarse o bajo qué licencia.' },
        { status: 400 },
      );
    }

    const marca = await leerProyecto(proyecto);
    if (typeof aprobadaPor !== 'string' || aprobadaPor.trim() !== marca.nombre) {
      return Response.json(
        { error: `Una imagen clínica solo la puede aprobar ${marca.nombre}.` },
        { status: 403 },
      );
    }

    const credito = validar(Credito, candidato.credito, 'el crédito del archivo clínico');

    const banco = archivoDe(slug);
    const original = await banco.bajar(candidato);

    const entrada = sharp(original);
    const meta = await entrada.metadata();
    const bytes = await ((meta.width ?? 0) > ANCHO_MAX
      ? entrada.resize({ width: ANCHO_MAX })
      : entrada
    )
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer();

    const nombre = `clinica-${aTrozo(String(candidato.id))}.jpg`;
    const rutas = rutasDe(proyecto);
    const carpeta = rutas.media(slug);
    await mkdir(carpeta, { recursive: true });
    await writeFile(join(carpeta, nombre), bytes);

    const aprobacion = validar(
      Aprobacion,
      {
        aprobadaPor: aprobadaPor.trim(),
        fecha: new Date().toISOString().slice(0, 10),
        huella: createHash('sha256').update(bytes).digest('hex').slice(0, 32),
        ...(typeof nota === 'string' && nota.trim() ? { nota: nota.trim() } : {}),
      },
      'la aprobación',
    );

    return Response.json({ ruta: rutas.urlMedia(slug, nombre), credito, aprobacion });
  } catch (e) {
    const error = e instanceof Error ? e.message : 'No se pudo traer la imagen.';
    return Response.json({ error }, { status: 502 });
  }
}

function aTrozo(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'imagen';
}
