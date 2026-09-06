/**
 * template/tipos.ts
 *
 * Los tipos que consume la plantilla. No se escriben a mano: salen del esquema
 * de Zod de lib/schema.ts, para que la validación y los tipos no puedan
 * separarse. Son re-exportaciones de tipo, así que Zod no entra al navegador.
 */
export type {
  TEmblema as Emblema,
  TMarca as Marca,
  TOverrides as Overrides,
  TPost as Post,
  TSlide as Slide,
  TSlideCierre as SlideCierre,
  TSlideContenido as SlideContenido,
  TSlideLista as SlideLista,
  TSlidePortada as SlidePortada,
  TVisual as Visual,
} from '@/lib/schema';

import type { TSlide } from '@/lib/schema';

/**
 * Numeración: la portada no lleva número; el primer slide de contenido es 01 y
 * el cierre lleva el último. Con portada + 5 contenidos + cierre, el cierre
 * es 06. Devuelve null cuando no debe pintarse número.
 */
export function numeroDeSlide(slides: TSlide[], i: number): string | null {
  if (slides[i]?.tipo === 'portada') return null;
  return String(i).padStart(2, '0');
}
