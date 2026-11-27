import { encuadreAutomatico } from '@/lib/foco';
import { proyectoDe, proyectoInexistente, type ConProyecto } from '@/lib/peticion';
import { leerProyecto } from '@/lib/posts';

/**
 * POST /api/<proyecto>/fotos/encuadre — `{ src }` → `{ fotoX, fotoY }`.
 *
 * El encuadre automático de la foto de portada, según la plantilla de la
 * cuenta. No toca el post: el editor pone el resultado en los overrides del
 * slide y se guarda con lo demás. Ver lib/foco.ts.
 */
export async function POST(req: Request, ctx: ConProyecto) {
  const proyecto = await proyectoDe(ctx);
  if (!proyecto) return proyectoInexistente();
  try {
    const { src } = await req.json();
    if (typeof src !== 'string' || !src) return Response.json({ error: 'Falta la foto.' }, { status: 400 });
    const { plantilla } = await leerProyecto(proyecto);
    return Response.json(await encuadreAutomatico(src, plantilla));
  } catch (e) {
    const error = e instanceof Error ? e.message : 'No se pudo encuadrar.';
    return Response.json({ error }, { status: 400 });
  }
}
