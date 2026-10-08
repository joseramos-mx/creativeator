import 'server-only';

import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { MODELO_PROPUESTA } from './modelo';
import { NOMBRES_PALETA } from '@/plantillas/clinica/tokens';
import { instrucciones, type ContextoDeTemas } from './temas';

/**
 * lib/proponer.ts — qué escribir, cuando no se sabe qué escribir.
 *
 * Va antes de `lib/redactar.ts` y es mucho más barata: un carrusel entero son
 * dos minutos, tres títulos son segundos. Por eso propone **tres y se elige**,
 * en vez de escribir uno y descubrir a los dos minutos que no era el tema.
 *
 * Todo lo interesante de este archivo es el contexto. Sin él, un modelo al que
 * se le pide "propón temas de dermatología" contesta lo mismo que le
 * contestaría a cualquiera: acné, protector solar, rutina de cuidado. Lo que lo
 * saca de ahí son tres cosas concretas:
 *
 *  · **el mes**, porque la mitad del valor de un carrusel es llegar cuando el
 *    problema está pasando;
 *  · **la especialidad de verdad**, alergología *y* dermatología, que no es lo
 *    mismo que dermatología general: hay temas de piel que no son suyos;
 *  · **lo ya publicado**, para no repetir lo que la cuenta ya dijo.
 *
 * El armado del prompt es una función pura y exportada, así que el banco
 * comprueba sin gastar llamadas que los temas existentes y el mes correcto
 * llegan de verdad al prompt. Es la parte que se rompe en silencio: si la lista
 * llegara vacía, el modelo propondría un tema repetido y nadie sabría por qué.
 */


const Propuesta = z.object({
  tema: z.string(),
  /** Por qué este mes y no otro. Una línea, y es la que decide. */
  porQueAhora: z.string(),
  paleta: z.enum(NOMBRES_PALETA),
  porQuePaleta: z.string(),
});

export type TPropuesta = z.infer<typeof Propuesta>;
export { mesDe, type ContextoDeTemas } from './temas';

/**
 * Más de esto no se propone de una.
 *
 * No es un límite del modelo, es del mes: veinte carruseles no caben en cuatro
 * semanas de una cuenta que publica dos por semana, y cada uno que se escribe
 * de más cuesta una llamada larga y una revisión entera. Un número de más
 * tecleado por error se para aquí y no cuarenta minutos después.
 */
export const MAXIMO = 20;

export async function proponer(
  contexto: ContextoDeTemas,
  cuantos = 3,
): Promise<TPropuesta[]> {
  if (!Number.isInteger(cuantos) || cuantos < 1 || cuantos > MAXIMO) {
    throw new Error(`Se proponen entre 1 y ${MAXIMO} temas de una vez, no ${cuantos}.`);
  }

  // El esquema se arma con la cantidad pedida: pedir ocho y aceptar tres es
  // aceptar una tanda a medias sin que nadie se entere.
  const Propuestas = z.object({
    propuestas: z.array(Propuesta).min(cuantos).max(cuantos),
  });

  const cliente = new Anthropic();

  const respuesta = await cliente.messages
    .stream({
      model: MODELO_PROPUESTA,
      // Escala con lo que se pide. Con el techo fijo en 4000, una tanda de doce
      // se cortaba a la mitad y el error salía como "no devolvió la estructura".
      max_tokens: Math.max(4000, cuantos * 1200),
      thinking: { type: 'adaptive' },
      messages: [{ role: 'user', content: instrucciones(contexto, cuantos) }],
      output_config: { format: zodOutputFormat(Propuestas) },
    })
    .finalMessage();

  if (respuesta.stop_reason === 'refusal') {
    throw new Error('El modelo declinó proponer temas.');
  }
  if (respuesta.stop_reason === 'max_tokens') {
    throw new Error(`La lista se cortó a la mitad. Pide menos de ${cuantos} temas.`);
  }
  const salida = respuesta.parsed_output;
  if (!salida) throw new Error('El modelo no devolvió la estructura esperada.');
  return salida.propuestas;
}

