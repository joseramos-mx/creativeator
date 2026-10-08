import { archivoLaboratorio, laboratorio } from './laboratorio';
import { commons } from './commons';
import { pexels } from './pexels';
import type { Banco } from './tipos';

export type { Banco, Candidato } from './tipos';
export { cribar, type Apartado, type Cribado } from './descartar';
export {
  CAJA_CONTENIDO,
  CAJA_PORTADA,
  porEncuadre,
  visibleTrasRecorte,
  type Caja,
} from './encuadre';

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

/**
 * El banco de imágenes clínicas: fotos de lesión, no de ambiente.
 *
 * Va aparte de `bancoDe` y no como una opción suya porque se busca distinto:
 * por el nombre de la condición, no por la escena, y sin criterios del modelo.
 */
export function archivoDe(slug: string): Banco {
  return slug.startsWith('laboratorio-') ? archivoLaboratorio : commons;
}
