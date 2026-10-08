import { CAJA_CONTENIDO, CAJA_PORTADA, bancoDe, cribar, porEncuadre } from '@/lib/bancos';
import { criteriosDe, type TCriterios } from '@/lib/criterios';
import { proyectoDe, proyectoInexistente, type ConProyecto } from '@/lib/peticion';
import { leerPost } from '@/lib/posts';

/**
 * POST /api/<proyecto>/fotos/buscar
 *
 * `{ slug, indice }` → Claude propone los criterios y el banco devuelve
 * candidatos. `{ slug, indice, query, descartar }` → se salta al modelo y solo
 * busca, que es lo que pasa al afinar la consulta a mano.
 *
 * No descarga nada y no toca el post. Elegir es otra petición.
 */

export const maxDuration = 120;

const CUANTAS = 24;

export async function POST(req: Request, ctx: ConProyecto) {
  const proyecto = await proyectoDe(ctx);
  if (!proyecto) return proyectoInexistente();
  try {
    const { slug, indice, query, descartar } = await req.json();

    if (typeof slug !== 'string' || !/^[a-z0-9-]+$/.test(slug)) {
      return Response.json({ error: 'Slug inválido.' }, { status: 400 });
    }

    const post = await leerPost(proyecto, slug);
    const slide = post.slides[indice];
    // La portada también lleva foto —a sangre, en su propio campo— y también
    // se puede buscar. Antes solo se aceptaba contenido, así que la portada era
    // el único slide donde había que arrastrar el archivo a mano.
    if (!slide || (slide.tipo !== 'contenido' && slide.tipo !== 'portada')) {
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
          : await criteriosDe(proyecto, {
              tema: post.tema,
              titulo: slide.titulo,
              // La portada no tiene cuerpo: lo que la describe es su pregunta.
              bajada: slide.tipo === 'contenido' ? slide.bajada : undefined,
              cuerpo: slide.tipo === 'contenido' ? slide.cuerpo : slide.pregunta,
              ideaImagen:
                slide.tipo === 'contenido' && slide.visual.clase === 'foto'
                  ? slide.visual.ideaImagen
                  : undefined,
            });

    // La misma caja que usaría el relleno automático, para que elegir a mano y
    // dejar que elija no den fotos con encuadres distintos.
    const caja = slide.tipo === 'portada' ? CAJA_PORTADA : CAJA_CONTENIDO;
    const orientacion = caja.ancho >= caja.alto ? 'landscape' : 'portrait';

    const candidatos = await banco.buscar(criterios.query, CUANTAS, orientacion);
    const { pasan, apartados, sinCredito } = cribar(candidatos, criterios.descartar);
    const { encajan, recortadas } = porEncuadre(pasan, caja);

    return Response.json({
      banco: banco.nombre,
      criterios,
      pasan: encajan,
      apartados,
      sinCredito,
      recortadas: recortadas.length,
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : 'No se pudo buscar.';
    return Response.json({ error }, { status: 502 });
  }
}
