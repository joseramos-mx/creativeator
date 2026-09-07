import 'server-only';

import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { MODELO_CRITERIOS } from './modelo';

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

export type SlideParaBuscar = {
  tema: string;
  titulo: string;
  bajada?: string;
  cuerpo: string;
  ideaImagen?: string;
};

export async function criteriosDe(slide: SlideParaBuscar): Promise<TCriterios> {
  const cliente = new Anthropic();

  const respuesta = await cliente.messages
    .stream({
      model: MODELO_CRITERIOS,
      max_tokens: 2000,
      thinking: { type: 'adaptive' },
      messages: [{ role: 'user', content: instrucciones(slide) }],
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

function instrucciones(slide: SlideParaBuscar) {
  return `Este es un slide de un carrusel de Instagram de un dermatólogo, sobre
"${slide.tema}". Hay que buscarle una foto de banco.

## El slide

Título: ${sinMarcado(slide.titulo)}
${slide.bajada ? `Bajada: ${slide.bajada}\n` : ''}Cuerpo: ${slide.cuerpo}
${slide.ideaImagen ? `Idea de imagen ya escrita: ${slide.ideaImagen}` : ''}

## Lo que se busca es contexto, nunca clínica

Fotos de ambiente: un aula, mochilas en un perchero, niños en el recreo, una
toalla colgada, una rutina de casa. **Nunca una lesión, una erupción, una piel
enferma ni nada que parezca material clínico.** Las fotos clínicas de este
proyecto salen de otro sitio y las aprueba el médico una por una; si el slide
pide una lesión, di en "criterios" que este slide no lleva foto de banco y
propón el ambiente más cercano.

Tampoco fotos donde se pueda reconocer a un menor identificable como enfermo.

## Los tres campos

  · query — en inglés, de tres a seis palabras, del vocabulario con el que
    indexan los bancos de fotos. "children classroom backpacks school", no
    "impetigo contagion at school".

  · criterios — en español, en una frase: qué tiene que enseñar la foto para
    que sirva a ESTE slide. Lo lee una persona mientras elige.

  · descartar — de dos a seis términos, **en inglés**, que aparecerían en la
    descripción de una foto que encaja con la consulta y aun así está mal para
    este slide.

    **Una sola palabra siempre que sirva.** El descarte busca la secuencia
    entera, así que "gym equipment" no aparta una foto descrita como "a gym
    full of adults", y "gym" sí. Usa dos palabras solo cuando una sola apartaría
    fotos buenas.

Este último es el campo que importa y conviene explicar por qué. Un slide sobre
cómo se contagia una infección en la escuela se publicó una vez con la foto de
un gimnasio: encajaba con "niños juntos" y no enseñaba nada de lo que decía el
texto. Piensa qué buscaría alguien con la consulta de arriba y saldría mal.
Términos concretos y buscables —"gym", "sports equipment", "adults only"—, no
categorías abstractas.`;
}

/** El título viene con el marcado de la plantilla; al modelo le sobra. */
function sinMarcado(s: string) {
  return s.replace(/\*\*?/g, '').replace(/\\n|\n/g, ' ').replace(/\s+/g, ' ').trim();
}
