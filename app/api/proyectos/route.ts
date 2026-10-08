import { darDeAlta } from '@/lib/alta';
import { almacen } from '@/lib/almacen';
import { avisoDeSoloLectura, soloLectura } from '@/lib/soloLectura';

/**
 * POST /api/proyectos — `{ id, nombre? }` da de alta una cuenta.
 *
 * Solo crea las carpetas con los textos de ejemplo marcados «POR ESCRIBIR»
 * (ver lib/alta.ts). Lo demás —quién es, cómo suena— se cuenta después en
 * /<id>/identidad, que es adonde lleva la página /nuevo.
 */
export async function POST(req: Request) {
  if (soloLectura) return avisoDeSoloLectura();
  try {
    const { id, nombre } = await req.json();
    if (typeof id !== 'string') return Response.json({ error: 'Falta el id.' }, { status: 400 });
    await darDeAlta(
      { id: id.trim(), nombre: typeof nombre === 'string' ? nombre : undefined },
      process.cwd(),
      almacen,
    );
    return Response.json({ ok: true, id: id.trim() });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'No se pudo dar de alta.' }, { status: 400 });
  }
}
