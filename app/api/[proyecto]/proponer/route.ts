import { proyectoDe, proyectoInexistente, type ConProyecto } from '@/lib/peticion';
import { asegurarEscrito, leerPieza } from '@/lib/piezas';
import { leerProyecto, listarPosts } from '@/lib/posts';
import { mesDe, proponer } from '@/lib/proponer';
import { paletas } from '@/plantillas/clinica/tokens';

/**
 * POST /api/<proyecto>/proponer — `{ cuantos? }` → temas para elegir. Tres por defecto.
 *
 * El contexto sale de aquí y no del navegador: el mes lo pone el servidor y los
 * temas ya publicados se leen de proyectos/<id>/posts/. Si el editor los mandara,
 * bastaría con abrir la página en una pestaña vieja para proponer un tema
 * repetido, y nadie sabría por qué.
 *
 * Los carruseles de laboratorio no cuentan: son andamio de las pruebas, no
 * contenido de la cuenta, y meterlos en la lista de "no repitas" sería pedirle
 * al modelo que esquive temas que no existen.
 */

export const maxDuration = 120;

export async function POST(req: Request, ctx: ConProyecto) {
  const proyecto = await proyectoDe(ctx);
  if (!proyecto) return proyectoInexistente();
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'Falta ANTHROPIC_API_KEY en .env.local.' }, { status: 500 });
  }

  // El panel no manda cuerpo; la tanda del mes manda cuántos quiere.
  const cuerpo = await req.json().catch(() => ({}));
  const cuantos = typeof cuerpo?.cuantos === 'number' ? cuerpo.cuantos : 3;

  try {
    const [marca, posts, alcance] = await Promise.all([
      leerProyecto(proyecto),
      listarPosts(proyecto),
      leerPieza(proyecto, 'alcance'),
    ]);
    asegurarEscrito(proyecto, marca);
    const contexto = {
      mes: mesDe(new Date()),
      publicados: posts
        .filter((p) => !p.slug.startsWith('laboratorio-'))
        .map((p) => p.tema),
      especialidad: marca.especialidad,
      ciudad: marca.ciudad,
      alcance,
      // Las mismas que ve el redactor: solo las que tienen regla.
      paletas: Object.entries(paletas)
        .filter(([, p]) => p.automatica)
        .map(([nombre, p]) => ({ nombre, cuando: p.cuando })),
    };

    return Response.json({ contexto, propuestas: await proponer(contexto, cuantos) });
  } catch (e) {
    const error = e instanceof Error ? e.message : 'No se pudieron proponer temas.';
    return Response.json({ error }, { status: 502 });
  }
}
