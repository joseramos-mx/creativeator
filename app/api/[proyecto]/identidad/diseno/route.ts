import { guardarDiseno, proponerDiseno } from '@/lib/identidad';
import { proyectoDe, proyectoInexistente, type ConProyecto } from '@/lib/peticion';
import { avisoDeSoloLectura, soloLectura } from '@/lib/soloLectura';

/**
 * /api/<proyecto>/identidad/diseno — el diseño de los slides, aparte de los
 * textos, para iterarlo sin volver a escribir la identidad.
 *
 *  · `POST { diseno, pedido, conReferencias }` → `{ diseno, porque, tokens }`.
 *    Claude lo ajusta; no escribe nada.
 *  · `PUT { diseno }` → guarda solo `plantilla` y `diseno` en proyecto.json.
 */
export const maxDuration = 120;

export async function POST(req: Request, ctx: ConProyecto) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'Falta ANTHROPIC_API_KEY en .env.local.' }, { status: 500 });
  }
  const proyecto = await proyectoDe(ctx);
  if (!proyecto) return proyectoInexistente();
  try {
    const { diseno, pedido, conReferencias } = await req.json();
    const propuesta = await proponerDiseno(proyecto, {
      actual: diseno,
      pedido: typeof pedido === 'string' ? pedido : '',
      conReferencias: Boolean(conReferencias),
    });
    return Response.json(propuesta);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'No se pudo proponer.' }, { status: 502 });
  }
}

export async function PUT(req: Request, ctx: ConProyecto) {
  if (soloLectura) return avisoDeSoloLectura();
  const proyecto = await proyectoDe(ctx);
  if (!proyecto) return proyectoInexistente();
  try {
    const { diseno } = await req.json();
    await guardarDiseno(proyecto, diseno);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'No se pudo guardar.' }, { status: 400 });
  }
}
