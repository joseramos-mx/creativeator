import { proponerTextos } from '@/lib/identidad';
import { proyectoDe, proyectoInexistente, type ConProyecto } from '@/lib/peticion';

/**
 * POST /api/<proyecto>/identidad/proponer — Claude lee el cuestionario y los
 * materiales y propone la identidad, la voz, las piezas de los prompts y la
 * marca, con las preguntas que le faltan.
 *
 * **No escribe nada.** La propuesta vuelve a la página, se lee, se corrige y se
 * guarda con /identidad/textos. Darle a este botón en una cuenta con la voz ya
 * afinada no la pisa.
 */
export const maxDuration = 300;

export async function POST(_req: Request, ctx: ConProyecto) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'Falta ANTHROPIC_API_KEY en .env.local.' }, { status: 500 });
  }
  const proyecto = await proyectoDe(ctx);
  if (!proyecto) return proyectoInexistente();
  try {
    return Response.json({ propuesta: await proponerTextos(proyecto) });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'No se pudo proponer.' }, { status: 502 });
  }
}
