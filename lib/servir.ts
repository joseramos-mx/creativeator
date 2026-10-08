import 'server-only';

import { extname, join } from 'node:path';
import { almacen } from './almacen';

/**
 * lib/servir.ts — los archivos de `public/` que se escribieron después del build.
 *
 * En la computadora Next sirve `public/` directo del disco y esto no se usa. En
 * Vercel, lo que está en `public/` es lo del último build: una foto subida
 * desde el teléfono o un ícono recién generado viven en el repositorio y no en
 * el despliegue. Next busca primero en `public/` y, si no está, cae en estas
 * rutas, que lo piden al almacén.
 */

const TIPOS: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.tsv': 'text/tab-separated-values; charset=utf-8',
};

/** Lo único que se sirve: lo de las cuentas y la librería de íconos. */
const PERMITIDO = /^(proyectos|iconos)\//;

export async function servir(segmentos: string[], req: Request): Promise<Response> {
  const ruta = segmentos.map((s) => decodeURIComponent(s)).join('/');
  if (!PERMITIDO.test(ruta) || ruta.split('/').some((s) => s === '..' || s === '')) {
    return new Response('No encontrado', { status: 404 });
  }
  const datos = await almacen.leer(join(process.cwd(), 'public', ruta)).catch(() => null);
  if (!datos) return new Response('No encontrado', { status: 404 });

  // Con versión en la URL el archivo no cambia nunca; sin ella puede cambiar
  // (un PNG reexportado), así que no se guarda. Privado: el despliegue va con
  // protección de Vercel y nada de esto debe quedar en una caché compartida.
  const versionado = new URL(req.url).searchParams.has('v');
  return new Response(new Uint8Array(datos), {
    headers: {
      'Content-Type': TIPOS[extname(ruta).toLowerCase()] ?? 'application/octet-stream',
      'Cache-Control': versionado ? 'private, max-age=31536000, immutable' : 'private, no-cache',
    },
  });
}
