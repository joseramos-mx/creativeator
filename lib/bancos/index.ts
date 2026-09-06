import { laboratorio } from './laboratorio';
import { pexels } from './pexels';
import type { Banco } from './tipos';

export type { Banco, Candidato } from './tipos';
export { cribar, type Apartado, type Cribado } from './descartar';

/**
 * Qué banco atiende a este carrusel.
 *
 * Los de laboratorio van siempre al banco de laboratorio, y no por
 * configuración: por el slug, igual que `soloLaboratorio()` en las pruebas. Una
 * prueba no puede gastar la cuota de Pexels ni depender de qué fotos haya hoy,
 * y un interruptor que hay que acordarse de poner se olvida.
 */
export function bancoDe(slug: string): Banco {
  return slug.startsWith('laboratorio-') ? laboratorio : pexels;
}
