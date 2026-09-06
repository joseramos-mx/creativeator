import { bancoDe, cribar } from '@/lib/bancos';
import { criteriosDe, type TCriterios } from '@/lib/criterios';
import { leerPost } from '@/lib/posts';

/**
 * POST /api/fotos/buscar
 *
 * `{ slug, indice }` → Claude propone los criterios y el banco devuelve
 * candidatos. `{ slug, indice, query, descartar }` → se salta al modelo y solo
 * busca, que es lo que pasa al afinar la consulta a mano.
 *
 * No descarga nada y no toca el post. Elegir es otra petición.
 */

export const maxDuration = 120;

const CUANTAS = 24;

export async function POST(req: Request) {
  try {
    const { slug, indice, query, descartar } = await req.json();

    if (typeof slug !== 'string' || !/^[a-z0-9-]+$/.test(slug)) {
      return Response.json({ error: 'Slug inválido.' }, { status: 400 });
    }

    const post = await leerPost(slug);
    const slide = post.slides[indice];
    if (!slide || slide.tipo !== 'contenido') {
      return Response.json({ error: 'Ese slide no lleva foto de banco.' }, { status: 400 });
    }

    const banco = bancoDe(slug);
    if (!banco.disponible()) {
      return Response.json(
        { error: `El banco "${banco.nombre}" no está configurado. Falta la llave en .env.local.` },
        { status: 503 },
      );
    }

    // Reutilizar los criterios cuesta cero; volver a pedirlos, una llamada.
    const criterios: TCriterios =
      typeof query === 'string' && query.trim()
        ? {
            query: query.trim(),
            criterios: '',
            descartar: Array.isArray(descartar) ? descartar.filter((d) => typeof d === 'string') : [],
          }
        : banco.criterios
          ? banco.criterios()
          : await criteriosDe({
              tema: post.tema,
              titulo: slide.titulo,
              bajada: slide.bajada,
              cuerpo: slide.cuerpo,
              ideaImagen: slide.visual.clase === 'foto' ? slide.visual.ideaImagen : undefined,
            });

    const candidatos = await banco.buscar(criterios.query, CUANTAS);
    const { pasan, apartados, sinCredito } = cribar(candidatos, criterios.descartar);

    return Response.json({ banco: banco.nombre, criterios, pasan, apartados, sinCredito });
  } catch (e) {
    const error = e instanceof Error ? e.message : 'No se pudo buscar.';
    return Response.json({ error }, { status: 502 });
  }
}
