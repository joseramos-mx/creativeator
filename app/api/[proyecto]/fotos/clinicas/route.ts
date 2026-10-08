import { archivoDe } from '@/lib/bancos';
import { consultaDeArchivo } from '@/lib/clinicas';
import { proyectoDe, proyectoInexistente, type ConProyecto } from '@/lib/peticion';
import { leerPost } from '@/lib/posts';

/**
 * POST /api/<proyecto>/fotos/clinicas — `{ slug, query? }` → candidatos de archivo clínico.
 *
 * Sin etapa de modelo, y no por ahorrar: para una foto de lesión lo que se
 * busca es el diagnóstico, que ya está en el tema del carrusel. La etapa que
 * lee el slide existe en la búsqueda contextual porque ahí hay que traducir
 * "cómo se contagia en la escuela" a un ambiente, y eso sí necesita criterio.
 *
 * **Esto propone, nunca inserta.** Elegir una imagen es otra petición:
 * /api/<proyecto>/fotos/elegir con `archivo: true`.
 */
export async function POST(req: Request, ctx: ConProyecto) {
  const proyecto = await proyectoDe(ctx);
  if (!proyecto) return proyectoInexistente();
  try {
    const { slug, query } = await req.json();
    if (typeof slug !== 'string' || !/^[a-z0-9-]+$/.test(slug)) {
      return Response.json({ error: 'Slug inválido.' }, { status: 400 });
    }

    const post = await leerPost(proyecto, slug);
    const banco = archivoDe(slug);
    const busqueda =
      typeof query === 'string' && query.trim() ? query.trim() : consultaDeArchivo(post.tema);

    const candidatos = await banco.buscar(busqueda, 24);
    // Aquí no hay criba por descarte: lo que descalifica una foto clínica no es
    // una palabra en su descripción, es mirarla.
    const usables = candidatos.filter((c) => c.credito);

    return Response.json({
      banco: banco.nombre,
      query: busqueda,
      candidatos: usables,
      sinLicencia: candidatos.length - usables.length,
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : 'No se pudo buscar en el archivo.';
    return Response.json({ error }, { status: 502 });
  }
}
