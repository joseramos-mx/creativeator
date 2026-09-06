import 'server-only';

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * lib/huella-imagen.ts — la huella de los bytes de una imagen.
 *
 * Es lo que hace que la aprobación del médico se caiga si la imagen cambia. La
 * cola de afirmaciones hace lo mismo con el texto: cambiar una coma cambia la
 * huella y la afirmación vuelve a la cola. Aquí el equivalente de la coma es
 * sustituir el archivo.
 *
 * Sobre la ruta no valdría. Los nombres de este proyecto son únicos por
 * construcción —llevan proveedor e id, o una marca de tiempo—, así que casi
 * siempre bastaría; pero "casi siempre" no es lo que se le pide a la firma de
 * un médico sobre una imagen clínica. Sobrescribir un archivo con el mismo
 * nombre es exactamente el caso que hay que cazar.
 */

/** SHA-256 de la imagen que hay en `public/<ruta>`, o null si no está. */
export async function huellaDeImagen(ruta: string): Promise<string | null> {
  if (!ruta.startsWith('/')) return null;
  try {
    // La ruta viene del JSON del post y siempre empieza por "/media/…". Se
    // normaliza igual, para que un "../" en un archivo editado a mano no
    // saque la lectura de public/.
    const dentro = join('public', ruta).replace(/\\/g, '/');
    if (!dentro.startsWith('public/')) return null;
    const bytes = await readFile(join(process.cwd(), dentro));
    return createHash('sha256').update(bytes).digest('hex').slice(0, 32);
  } catch {
    return null;
  }
}
