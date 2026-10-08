import { mkdir, writeFile } from 'node:fs/promises';
import { clinicasDe, faltaClinico } from '@/lib/clinicas';
import { huellaDeImagen } from '@/lib/huella-imagen';
import { proyectoDe, proyectoInexistente, type ConProyecto } from '@/lib/peticion';
import { rutasDe } from '@/lib/proyecto';
import { PostGuardable, validar } from '@/lib/schema';
import { avisoDeSoloLectura, soloLectura } from '@/lib/soloLectura';

/**
 * POST /api/<proyecto>/post — guarda el JSON del carrusel.
 *
 * Valida con el mismo esquema con el que se lee. Si el editor mandara algo que
 * la app no podría volver a leer, mejor enterarse aquí que al recargar.
 *
 * Y aquí, además, se comprueba lo que el esquema no puede: que los bytes de
 * cada foto clínica sigan siendo los que el médico aprobó. Eso hay que leerlo
 * del disco, y una validación de Zod no lee archivos.
 */
export async function POST(req: Request, ctx: ConProyecto) {
  if (soloLectura) return avisoDeSoloLectura();
  const proyecto = await proyectoDe(ctx);
  if (!proyecto) return proyectoInexistente();

  try {
    const { post } = await req.json();

    // Las huellas primero: si la imagen cambió después de aprobarse, el error
    // tiene que salir junto a los demás y no en una segunda vuelta.
    const huellas: Record<string, string | null> = {};
    if (post?.slides) {
      for (const foto of clinicasDe(post)) {
        huellas[foto.src] = await huellaDeImagen(foto.src);
      }
    }

    const limpio = validar(PostGuardable, post, 'el carrusel que mandó el editor');

    if (limpio.estado !== 'borrador') {
      const caidas = faltaClinico(limpio, huellas);
      if (caidas.length > 0) {
        throw new Error(
          `No se pudo guardar el carrusel:\n` +
            caidas.map((f) => `  · estado: ${f.donde} — ${f.que}`).join('\n'),
        );
      }
    }

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
