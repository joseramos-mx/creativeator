import { servir } from '@/lib/servir';

/**
 * /archivo/<ruta de public> — siempre desde el almacén, nunca del build. Lo
 * usan los archivos que cambian con el mismo nombre (las descargas) y el
 * manifiesto de íconos. Ver lib/servir.ts.
 */
export async function GET(req: Request, { params }: { params: Promise<{ ruta: string[] }> }) {
  return servir((await params).ruta, req);
}
