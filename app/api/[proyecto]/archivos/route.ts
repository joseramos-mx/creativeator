import { extname } from 'node:path';
import { almacen, guardar } from '@/lib/almacen';
import { absoluta, editable, rutaDeCuenta } from '@/lib/archivos';
import { proyectoDe, proyectoInexistente, type ConProyecto } from '@/lib/peticion';
import { avisoDeSoloLectura, soloLectura } from '@/lib/soloLectura';

/**
 * /api/<proyecto>/archivos — el explorador.
 *
 *  · `GET ?ruta=…` → el archivo tal cual, para verlo o bajarlo.
 *  · `POST { ruta, texto }` → guarda un texto (.md, .tsv, .csv, .txt).
 */
const TIPOS: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.json': 'application/json; charset=utf-8',
};

export async function GET(req: Request, ctx: ConProyecto) {
  const proyecto = await proyectoDe(ctx);
  if (!proyecto) return proyectoInexistente();
  const ruta = rutaDeCuenta(proyecto, new URL(req.url).searchParams.get('ruta') ?? '');
  if (!ruta) return Response.json({ error: 'Esa ruta no es de esta cuenta.' }, { status: 400 });
  const datos = await almacen.leer(absoluta(ruta));
  if (!datos) return Response.json({ error: 'No existe.' }, { status: 404 });
  return new Response(new Uint8Array(datos), {
    headers: {
      'Content-Type': TIPOS[extname(ruta).toLowerCase()] ?? 'text/plain; charset=utf-8',
      'Cache-Control': 'private, no-cache',
    },
  });
}

export async function POST(req: Request, ctx: ConProyecto) {
  if (soloLectura) return avisoDeSoloLectura();
  const proyecto = await proyectoDe(ctx);
  if (!proyecto) return proyectoInexistente();
  try {
    const { ruta: pedida, texto } = await req.json();
    if (typeof pedida !== 'string' || typeof texto !== 'string') {
      return Response.json({ error: 'Falta la ruta o el texto.' }, { status: 400 });
    }
    const ruta = rutaDeCuenta(proyecto, pedida);
    if (!ruta) return Response.json({ error: 'Esa ruta no es de esta cuenta.' }, { status: 400 });
    if (!editable(ruta)) {
      return Response.json({ error: 'Desde aquí solo se editan textos: .md, .tsv, .csv y .txt.' }, { status: 400 });
    }
    await guardar(absoluta(ruta), texto, `${proyecto}: editar ${ruta.split('/').pop()}`);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'No se pudo guardar.' }, { status: 400 });
  }
}
