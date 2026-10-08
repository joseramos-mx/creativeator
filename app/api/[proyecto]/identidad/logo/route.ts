import { guardarLogo } from '@/lib/identidad';
import { proyectoDe, proyectoInexistente, type ConProyecto } from '@/lib/peticion';
import { avisoDeSoloLectura, soloLectura } from '@/lib/soloLectura';

/**
 * POST /api/<proyecto>/identidad/logo (multipart, campo `logo`) — sube el logo
 * de la cuenta y lo apunta en proyecto.json. Devuelve `{ logo }`, su URL.
 */
export async function POST(req: Request, ctx: ConProyecto) {
  if (soloLectura) return avisoDeSoloLectura();
  const proyecto = await proyectoDe(ctx);
  if (!proyecto) return proyectoInexistente();
  try {
    const archivo = (await req.formData()).get('logo');
    if (!(archivo instanceof File)) return Response.json({ error: 'No llegó el logo.' }, { status: 400 });
    const logo = await guardarLogo(proyecto, archivo.name, Buffer.from(await archivo.arrayBuffer()));
    return Response.json({ logo });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'No se pudo subir el logo.' }, { status: 400 });
  }
}
