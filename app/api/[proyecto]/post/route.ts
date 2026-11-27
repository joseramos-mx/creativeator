import { almacen, guardar } from '@/lib/almacen';
import { proyectoDe, proyectoInexistente, type ConProyecto } from '@/lib/peticion';
import { rutasDe } from '@/lib/proyecto';
import { PostGuardable, validar } from '@/lib/schema';
import { avisoDeSoloLectura, soloLectura } from '@/lib/soloLectura';

/**
 * POST /api/<proyecto>/post — guarda el JSON del carrusel.
 *
 * Valida con el mismo esquema con el que se lee. Si el editor mandara algo que
 * la app no podría volver a leer, mejor enterarse aquí que al recargar.
 */
export async function POST(req: Request, ctx: ConProyecto) {
  if (soloLectura) return avisoDeSoloLectura();
  const proyecto = await proyectoDe(ctx);
  if (!proyecto) return proyectoInexistente();

  try {
    const { post } = await req.json();

    const limpio = validar(PostGuardable, post, 'el carrusel que mandó el editor');

    await guardar(
      rutasDe(proyecto).post(limpio.slug),
      `${JSON.stringify(limpio, null, 2)}\n`,
      `${proyecto}: ${limpio.tema}`,
    );
    return Response.json({ ok: true, guardado: new Date().toISOString() });
  } catch (e) {
    const error = e instanceof Error ? e.message : 'No se pudo guardar.';
    return Response.json({ error }, { status: 400 });
  }
}

/**
 * DELETE /api/<proyecto>/post?slug=… — borra el carrusel y sus fotos.
 *
 * Las fotos de `media/<slug>/` son solo de ese carrusel y sin él no las usa
 * nadie. Las propias de la cuenta no se tocan: viven en `fotos/` y el post solo
 * apunta a ellas. Lo ya mandado a /descargas tampoco: eso ya salió de aquí.
 */
export async function DELETE(req: Request, ctx: ConProyecto) {
  if (soloLectura) return avisoDeSoloLectura();
  const proyecto = await proyectoDe(ctx);
  if (!proyecto) return proyectoInexistente();

  const slug = new URL(req.url).searchParams.get('slug') ?? '';
  if (!/^[a-z0-9-]+$/.test(slug)) return Response.json({ error: 'Slug inválido.' }, { status: 400 });

  const rutas = rutasDe(proyecto);
  if (!(await almacen.existe(rutas.post(slug)))) {
    return Response.json({ error: 'Ese carrusel ya no existe.' }, { status: 404 });
  }

  try {
    // En GitHub las carpetas no existen: se borran los archivos uno por uno y
    // la carpeta desaparece sola. En disco se va la carpeta entera.
    const fotos = almacen.remoto ? await almacen.listarTodo(rutas.media(slug)) : [rutas.media(slug)];
    await almacen.escribir(
      [rutas.post(slug), ...fotos].map((ruta) => ({ ruta, datos: null })),
      `${proyecto}: eliminar ${slug}`,
    );
    return Response.json({ ok: true });
  } catch (e) {
    const error = e instanceof Error ? e.message : 'No se pudo eliminar.';
    return Response.json({ error }, { status: 500 });
  }
}
