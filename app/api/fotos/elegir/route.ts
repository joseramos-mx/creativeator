import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { bancoDe } from '@/lib/bancos';
import { Credito, validar } from '@/lib/schema';

/**
 * POST /api/fotos/elegir — `{ slug, candidato }` → la foto en disco y su crédito.
 *
 * **La descarga y el crédito son un solo movimiento.** Es lo que hace que esta
 * fase valga la pena: hoy el crédito se llena a mano y por eso está vacío en
 * todo el proyecto. Aquí no hay forma de acabar con el archivo puesto y la
 * procedencia sin escribir, porque si el candidato no trae crédito la petición
 * se rechaza antes de bajar un solo byte.
 *
 * Se guarda el archivo, no el enlace: los enlaces caducan y el PNG sale con un
 * hueco meses después de publicado.
 */

const ANCHO_MAX = 1600;

export async function POST(req: Request) {
  try {
    const { slug, candidato } = await req.json();

    if (typeof slug !== 'string' || !/^[a-z0-9-]+$/.test(slug)) {
      return Response.json({ error: 'Slug inválido.' }, { status: 400 });
    }
    if (!candidato?.descarga || typeof candidato.descarga !== 'string') {
      return Response.json({ error: 'Ese candidato no dice de dónde bajarse.' }, { status: 400 });
    }

    // Antes de bajar nada. Una foto que no se puede acreditar no se usa, y
    // rechazarla aquí es más honesto que bajarla y dejar el campo vacío.
    if (!candidato.credito) {
      return Response.json(
        { error: 'Ese candidato no trae fuente ni licencia, así que no se puede usar.' },
        { status: 400 },
      );
    }
    const credito = validar(Credito, candidato.credito, 'el crédito del banco');

    const banco = bancoDe(slug);
    const original = await banco.bajar(candidato);

    const entrada = sharp(original);
    const meta = await entrada.metadata();
    const salida =
      (meta.width ?? 0) > ANCHO_MAX
        ? entrada.resize({ width: ANCHO_MAX }).jpeg({ quality: 88, mozjpeg: true })
        : entrada.jpeg({ quality: 88, mozjpeg: true });

    // El nombre lleva el proveedor y el id: con el JSON delante o sin él, se
    // puede volver a la foto original desde el nombre del archivo.
    const nombre = `${aTrozo(candidato.proveedor)}-${aTrozo(String(candidato.id))}.jpg`;
    const carpeta = join(process.cwd(), 'public', 'media', slug);
    await mkdir(carpeta, { recursive: true });
    await writeFile(join(carpeta, nombre), await salida.toBuffer());

    return Response.json({ ruta: `/media/${slug}/${nombre}`, credito });
  } catch (e) {
    const error = e instanceof Error ? e.message : 'No se pudo traer la foto.';
    return Response.json({ error }, { status: 502 });
  }
}

function aTrozo(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'foto';
}
