import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PostGuardable, validar } from '@/lib/schema';

/**
 * POST /api/post — guarda el JSON del carrusel.
 *
 * Valida con el mismo esquema con el que se lee. Si el editor mandara algo que
 * la app no podría volver a leer, mejor enterarse aquí que al recargar.
 */
export async function POST(req: Request) {
  try {
    const { post } = await req.json();
    const limpio = validar(PostGuardable, post, 'el carrusel que mandó el editor');
    const ruta = join(process.cwd(), 'content', 'posts', `${limpio.slug}.json`);
    await writeFile(ruta, `${JSON.stringify(limpio, null, 2)}\n`, 'utf8');
    return Response.json({ ok: true, guardado: new Date().toISOString() });
  } catch (e) {
    const error = e instanceof Error ? e.message : 'No se pudo guardar.';
    return Response.json({ error }, { status: 400 });
  }
}
