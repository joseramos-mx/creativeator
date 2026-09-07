import 'server-only';

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import type { Banco, Candidato } from './tipos';

/**
 * lib/bancos/descargar.ts — de un candidato a un archivo en public/media/.
 *
 * Vive aquí y no dentro de una ruta porque lo usan dos caminos que tienen que
 * hacer exactamente lo mismo: elegir una foto a mano en el editor, y el relleno
 * automático al redactar. Si divergieran, una de las dos acabaría guardando la
 * imagen sin pasar por la recompresión, o con otro nombre, y la diferencia solo
 * se notaría al exportar.
 *
 * El nombre lleva el proveedor y el id: con el JSON delante o sin él, se puede
 * volver a la foto original desde el nombre del archivo.
 */

const ANCHO_MAX = 1600;

export async function descargarFoto(
  banco: Banco,
  candidato: Candidato,
  slug: string,
): Promise<string> {
  const original = await banco.bajar(candidato);

  const entrada = sharp(original);
  const meta = await entrada.metadata();
  const salida =
    (meta.width ?? 0) > ANCHO_MAX
      ? entrada.resize({ width: ANCHO_MAX }).jpeg({ quality: 88, mozjpeg: true })
      : entrada.jpeg({ quality: 88, mozjpeg: true });

  const nombre = `${aTrozo(candidato.proveedor)}-${aTrozo(String(candidato.id))}.jpg`;
  const carpeta = join(process.cwd(), 'public', 'media', slug);
  await mkdir(carpeta, { recursive: true });
  await writeFile(join(carpeta, nombre), await salida.toBuffer());

  return `/media/${slug}/${nombre}`;
}

function aTrozo(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'foto';
}
