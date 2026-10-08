import { guardarMaterial, listarMateriales, quitarMaterial } from '@/lib/identidad';
import { proyectoDe, proyectoInexistente, type ConProyecto } from '@/lib/peticion';
import { avisoDeSoloLectura, soloLectura } from '@/lib/soloLectura';

/**
 * /api/<proyecto>/identidad/materiales — el manual, los posts pasados, los
 * documentos del negocio.
 *
 *  · `POST` (multipart, campo `archivos`) → los guarda y devuelve la lista.
 *  · `DELETE ?nombre=…` → quita uno.
 */
export async function POST(req: Request, ctx: ConProyecto) {
  if (soloLectura) return avisoDeSoloLectura();
  const proyecto = await proyectoDe(ctx);
  if (!proyecto) return proyectoInexistente();
  try {
    const form = await req.formData();
    const archivos = form.getAll('archivos').filter((a): a is File => a instanceof File);
    if (!archivos.length) return Response.json({ error: 'No llegó ningún archivo.' }, { status: 400 });
    for (const archivo of archivos) {
      await guardarMaterial(proyecto, archivo.name, Buffer.from(await archivo.arrayBuffer()));
    }
    return Response.json({ materiales: await listarMateriales(proyecto) });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'No se pudo subir.' }, { status: 400 });
  }
}

export async function DELETE(req: Request, ctx: ConProyecto) {
  if (soloLectura) return avisoDeSoloLectura();
  const proyecto = await proyectoDe(ctx);
  if (!proyecto) return proyectoInexistente();
  const nombre = new URL(req.url).searchParams.get('nombre') ?? '';
  await quitarMaterial(proyecto, nombre);
  return Response.json({ materiales: await listarMateriales(proyecto) });
}
