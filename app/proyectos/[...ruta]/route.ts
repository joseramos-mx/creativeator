import { servir } from '@/lib/servir';

/**
 * /proyectos/… que no está en `public/` del build: una foto subida o un logo
 * puesto después del último despliegue. Lo que sí está lo sirve Next antes de
 * llegar aquí. Ver lib/servir.ts.
 */
export async function GET(req: Request, { params }: { params: Promise<{ ruta: string[] }> }) {
  return servir(['proyectos', ...(await params).ruta], req);
}
