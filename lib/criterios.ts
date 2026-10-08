import 'server-only';

import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { instruccionesDeCriterios, type SlideParaBuscar } from './instrucciones';
import { MODELO_CRITERIOS } from './modelo';
import { asegurarEscrito, leerPieza } from './piezas';
import { leerProyecto } from './posts';

/**
 * lib/criterios.ts — del slide a los criterios de búsqueda.
 *
 * La primera de las dos etapas: Claude lee el slide y su `ideaImagen` y decide
 * qué buscar y, sobre todo, **qué no debe salir**. La segunda etapa —pedirle
 * los candidatos al banco— no gasta modelo, así que afinar la consulta a mano
 * y volver a buscar es gratis.
 *
 * El campo que justifica la etapa es `descartar`. La consulta la puede escribir
 * cualquiera; lo que nadie escribe por su cuenta es la lista de lo que haría
 * que la foto fuera equivocada aunque encaje con la consulta. El slide del
 * contagio del impétigo pedía "niños juntos" y se publicó con un gimnasio,
 * porque un gimnasio tiene niños juntos.
 */


const Criterios = z.object({
  /** En inglés: los bancos indexan en inglés y la búsqueda en español no da. */
  query: z.string(),
  /** Qué tiene que enseñar, en español, para leerlo al elegir. */
  criterios: z.string(),
  /** Lo que descalifica una foto aunque encaje con la consulta. */
  descartar: z.array(z.string()).min(1).max(8),
});

export type TCriterios = z.infer<typeof Criterios>;

export type { SlideParaBuscar } from './instrucciones';

export async function criteriosDe(proyecto: string, slide: SlideParaBuscar): Promise<TCriterios> {
  const cliente = new Anthropic();
  const [marca, fotosBanco] = await Promise.all([
    leerProyecto(proyecto),
    leerPieza(proyecto, 'fotos-banco'),
  ]);
  asegurarEscrito(proyecto, marca);
  const { giro } = marca;

  const respuesta = await cliente.messages
    .stream({
      model: MODELO_CRITERIOS,
      max_tokens: 2000,
      thinking: { type: 'adaptive' },
      messages: [{ role: 'user', content: instruccionesDeCriterios(slide, { giro, fotosBanco }) }],
      output_config: { format: zodOutputFormat(Criterios) },
    })
    .finalMessage();

  if (respuesta.stop_reason === 'refusal') {
    throw new Error('El modelo declinó proponer criterios para este slide.');
  }
  const criterios = respuesta.parsed_output;
  if (!criterios) throw new Error('El modelo no devolvió la estructura esperada.');
  return criterios;
}
