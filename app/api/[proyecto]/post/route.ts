import { mkdir, writeFile } from 'node:fs/promises';
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

    const rutas = rutasDe(proyecto);
    // Un proyecto recién creado todavía no tiene carpeta de posts.
    await mkdir(rutas.posts, { recursive: true });
    const ruta = rutas.post(limpio.slug);
    await writeFile(ruta, `${JSON.stringify(limpio, null, 2)}\n`, 'utf8');
    return Response.json({ ok: true, guardado: new Date().toISOString() });
  } catch (e) {
    const error = e instanceof Error ? e.message : 'No se pudo guardar.';
    return Response.json({ error }, { status: 400 });
  }
}
