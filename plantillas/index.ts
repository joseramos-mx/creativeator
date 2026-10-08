/**
 * plantillas/index.ts — de un nombre de plantilla a sus componentes.
 *
 * Cada proyecto dice en `proyecto.json` qué plantilla usa, y todo lo que pinta
 * un slide —la ruta /render que captura Playwright, el editor, la lista— lo
 * pide aquí en vez de importar una plantilla concreta. Así dos cuentas pueden
 * verse completamente distintas con la misma app.
 *
 * Hoy hay una, `clinica`, la del Dr. Edwin. Para dar de alta otra, ver el
 * README («Una plantilla nueva»).
 */
import { Slide as SlideClinica, type PropsSlide } from './clinica/Slide';
import type { NombrePlantilla } from './nombres';

export type { NombrePlantilla } from './nombres';
export { NOMBRES_PLANTILLA } from './nombres';

export type Plantilla = {
  /** Pinta el slide `indice` de un carrusel, al tamaño del lienzo. */
  Slide: (props: PropsSlide) => React.ReactNode;
};

const PLANTILLAS: Record<NombrePlantilla, Plantilla> = {
  clinica: { Slide: SlideClinica },
};

export function plantillaDe(nombre: NombrePlantilla): Plantilla {
  return PLANTILLAS[nombre];
}
