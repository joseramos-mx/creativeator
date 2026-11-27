import { archivoLaboratorio, laboratorio } from './laboratorio';
import { commons } from './commons';
import { pexels } from './pexels';
import { bancoPropio, combinado, leerCatalogo } from './propio';
import type { Banco } from './tipos';

export type { Banco, Candidato } from './tipos';
export { cribar, type Apartado, type Cribado } from './descartar';
export {
  CAJA_CONTENIDO,
  CAJA_PORTADA,
  cajaDe,
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
 * Lo mismo, contando con las fotos propias de la cuenta: si tiene catálogo,
 * salen primero y Pexels detrás. Ver lib/bancos/propio.ts.
 */
export async function bancoDelProyecto(proyecto: string, slug: string): Promise<Banco> {
  const banco = bancoDe(slug);
  if (banco !== pexels) return banco;
  const catalogo = await leerCatalogo(proyecto);
  return catalogo.length ? combinado(bancoPropio(proyecto, catalogo), pexels) : pexels;
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
