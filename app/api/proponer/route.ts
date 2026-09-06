import { leerMarca, listarPosts } from '@/lib/posts';
import { mesDe, proponer } from '@/lib/proponer';
import { paletas } from '@/template/tokens';

/**
 * POST /api/proponer — sin cuerpo → tres temas para elegir.
 *
 * El contexto sale de aquí y no del navegador: el mes lo pone el servidor y los
 * temas ya publicados se leen de content/posts/. Si el editor los mandara,
 * bastaría con abrir la página en una pestaña vieja para proponer un tema
 * repetido, y nadie sabría por qué.
 *
 * Los carruseles de laboratorio no cuentan: son andamio de las pruebas, no
 * contenido de la cuenta, y meterlos en la lista de "no repitas" sería pedirle
 * al modelo que esquive temas que no existen.
 */

export const maxDuration = 120;

export async function POST() {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'Falta ANTHROPIC_API_KEY en .env.local.' }, { status: 500 });
  }

  try {
    const [marca, posts] = await Promise.all([leerMarca(), listarPosts()]);
    const contexto = {
      mes: mesDe(new Date()),
      publicados: posts
        .filter((p) => !p.slug.startsWith('laboratorio-'))
        .map((p) => p.tema),
      especialidad: marca.especialidad,
      ciudad: marca.ciudad,
      paletas: Object.entries(paletas).map(([nombre, p]) => ({ nombre, cuando: p.cuando })),
    };

    return Response.json({ contexto, propuestas: await proponer(contexto) });
  } catch (e) {
    const error = e instanceof Error ? e.message : 'No se pudieron proponer temas.';
    return Response.json({ error }, { status: 502 });
  }
}
