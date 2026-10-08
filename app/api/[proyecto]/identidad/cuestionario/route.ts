import { guardarCuestionario } from '@/lib/identidad';
import { proyectoDe, proyectoInexistente, type ConProyecto } from '@/lib/peticion';
import { avisoDeSoloLectura, soloLectura } from '@/lib/soloLectura';

/** POST /api/<proyecto>/identidad/cuestionario — `{ respuestas }` las guarda. */
export async function POST(req: Request, ctx: ConProyecto) {
  if (soloLectura) return avisoDeSoloLectura();
  const proyecto = await proyectoDe(ctx);
  if (!proyecto) return proyectoInexistente();
  try {
    const { respuestas } = await req.json();
    if (!respuestas || typeof respuestas !== 'object') {
      return Response.json({ error: 'Faltan las respuestas.' }, { status: 400 });
    }
    await guardarCuestionario(proyecto, respuestas);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'No se pudo guardar.' }, { status: 400 });
  }
}
