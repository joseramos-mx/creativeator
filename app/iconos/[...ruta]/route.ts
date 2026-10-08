import { servir } from '@/lib/servir';

/** /iconos/… generado después del último despliegue. Ver lib/servir.ts. */
export async function GET(req: Request, { params }: { params: Promise<{ ruta: string[] }> }) {
  return servir(['iconos', ...(await params).ruta], req);
}
