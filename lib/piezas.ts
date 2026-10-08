import 'server-only';

import { readFile } from 'node:fs/promises';
import { relative } from 'node:path';
import { rutasDe } from './proyecto';

/**
 * lib/piezas.ts — los textos de una cuenta que entran en los prompts.
 *
 * Cada uno es un Markdown en proyectos/<id>/ que se edita a mano, como
 * `voz.md`. Lo que dicen y dónde entran está en el README («Lo que es de cada
 * cuenta»). Aquí solo se leen, y si falta uno se dice cuál: un prompt con un
 * hueco en medio sigue contestando, y lo que contesta no es de la cuenta.
 */

export type NombrePieza = 'alcance' | 'estructura' | 'iconos' | 'fotos' | 'fotos-banco';

/**
 * La marca que deja `npm run proyecto:nuevo` en lo que hay que escribir.
 *
 * El proyecto nuevo nace con los textos del Dr. Edwin como ejemplo, porque
 * escribir un prompt desde cero es más difícil que adaptar uno. El riesgo es
 * obvio: una pediatra redactando con el alcance de un dermatólogo, sin que
 * nada falle. Así que mientras la marca siga ahí, no se redacta.
 */
export const POR_ESCRIBIR = 'POR ESCRIBIR';

/**
 * `recortar` quita el salto de línea final, que en medio de un prompt deja un
 * renglón en blanco de más. La voz va entera: es el system prompt y siempre se
 * mandó tal cual estaba en el archivo.
 */
async function leer(ruta: string, recortar = true): Promise<string> {
  let texto: string;
  try {
    texto = await readFile(ruta, 'utf8');
    if (recortar) texto = texto.trimEnd();
  } catch {
    throw new Error(
      `Falta ${relative(process.cwd(), ruta)}. Cada proyecto lleva su copia; ` +
        'la del Dr. Edwin sirve de modelo.',
    );
  }
  if (texto.includes(POR_ESCRIBIR)) {
    throw new Error(
      `${relative(process.cwd(), ruta)} todavía es el ejemplo de otra cuenta. ` +
        `Escríbelo para esta y quita la línea «${POR_ESCRIBIR}».`,
    );
  }
  return texto;
}

/**
 * Lo mismo para proyecto.json: un nombre o una ciudad que siguen diciendo
 * «POR ESCRIBIR» acabarían dentro del prompt y del cierre.
 */
export function asegurarEscrito(proyecto: string, config: Record<string, unknown>): void {
  const pendientes = Object.entries(config)
    .filter(([, v]) => JSON.stringify(v ?? '').includes(POR_ESCRIBIR))
    .map(([k]) => k);
  if (pendientes.length > 0) {
    throw new Error(
      `En proyectos/${proyecto}/proyecto.json faltan por escribir: ${pendientes.join(', ')}.`,
    );
  }
}

/** El system prompt de la redacción. */
export function leerVoz(proyecto: string): Promise<string> {
  return leer(rutasDe(proyecto).voz, false);
}

export function leerPieza(proyecto: string, nombre: NombrePieza): Promise<string> {
  return leer(rutasDe(proyecto).prompt(nombre));
}
