import { guardarTextos } from '@/lib/identidad';
import { proyectoDe, proyectoInexistente, type ConProyecto } from '@/lib/peticion';
import { avisoDeSoloLectura, soloLectura } from '@/lib/soloLectura';

/**
 * POST /api/<proyecto>/identidad/textos — `{ textos }` escribe identidad.md,
 * voz.md, las piezas de prompts/ y los campos de marca de proyecto.json.
 */
export async function POST(req: Request, ctx: ConProyecto) {
  if (soloLectura) return avisoDeSoloLectura();
  const proyecto = await proyectoDe(ctx);
  if (!proyecto) return proyectoInexistente();
  try {
    const { textos } = await req.json();
    await guardarTextos(proyecto, textos);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'No se pudo guardar.' }, { status: 400 });
  }
}
