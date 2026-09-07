import { guardarIcono } from '@/lib/iconos/guardar';

/**
 * POST /api/icono/guardar — la variante elegida entra en la librería.
 *
 * `{ png, nombre, concepto, modelo }` → el PNG a 1024, su miniatura y la
 * entrada del manifiesto. Todo el trabajo está en lib/iconos/guardar.ts,
 * porque el relleno automático al redactar guarda exactamente igual.
 */
export async function POST(req: Request) {
  try {
    const { png, nombre, concepto, modelo } = await req.json();
    if (typeof png !== 'string' || !png) {
      return Response.json({ error: 'Falta la imagen.' }, { status: 400 });
    }

    const guardado = await guardarIcono(
      Buffer.from(png, 'base64'),
      String(nombre ?? ''),
      String(concepto ?? ''),
      String(modelo ?? ''),
    );
    return Response.json(guardado);
  } catch (e) {
    const error = e instanceof Error ? e.message : 'No se pudo guardar el ícono.';
    return Response.json({ error }, { status: 400 });
  }
}
