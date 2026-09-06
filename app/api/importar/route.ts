import { leerBrief } from '@/lib/brief';
import { Post, validar } from '@/lib/schema';

/**
 * POST /api/importar — `{ texto, slug? }` → el JSON del carrusel.
 *
 * No guarda nada: devuelve el post y la lista de avisos para que el editor
 * enseñe qué entendió antes de reemplazar nada. El brief se pega a mano y casi
 * siempre trae alguna sorpresa; aplicarlo a ciegas sería perder el contenido
 * anterior sin darse cuenta.
 */
export async function POST(req: Request) {
  try {
    const { texto, slug } = await req.json();
    if (typeof texto !== 'string' || texto.trim().length < 20) {
      return Response.json({ error: 'Pega el brief completo.' }, { status: 400 });
    }

    const { post, avisos } = leerBrief(texto, typeof slug === 'string' ? slug : undefined);
    // Se valida aquí para que el editor nunca reciba un post que no podría guardar.
    const limpio = validar(Post, post, 'el brief');
    return Response.json({ post: limpio, avisos });
  } catch (e) {
    const error = e instanceof Error ? e.message : 'No se pudo leer el brief.';
    return Response.json({ error }, { status: 400 });
  }
}
