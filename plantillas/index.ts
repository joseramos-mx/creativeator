/**
 * plantillas/index.ts — de un nombre de plantilla a sus componentes.
 *
 * Cada proyecto dice en `proyecto.json` qué plantilla usa, y todo lo que pinta
 * un slide —la ruta /render que captura Playwright, el editor, la lista— lo
 * pide aquí en vez de importar una plantilla concreta. Así dos cuentas pueden
 * verse completamente distintas con la misma app.
 *
 * Hay dos: `clinica`, la medida sobre el carrusel publicado del Dr. Edwin, y
 * `plana`, de fondo de un color y configurable por cuenta con `diseno` en su
 * proyecto.json. Para dar de alta otra, ver el README («Una plantilla nueva»).
 */
import { Slide as SlideClinica, type PropsSlide } from './clinica/Slide';
import { Slide as SlidePlana } from './plana/Slide';
import type { NombrePlantilla } from './nombres';

export type { NombrePlantilla } from './nombres';
export { NOMBRES_PLANTILLA } from './nombres';

export type Plantilla = {
  /** Pinta el slide `indice` de un carrusel, al tamaño del lienzo. */
  Slide: (props: PropsSlide) => React.ReactNode;
};

const PLANTILLAS: Record<NombrePlantilla, Plantilla> = {
  clinica: { Slide: SlideClinica },
  plana: { Slide: SlidePlana },
};

export function plantillaDe(nombre: NombrePlantilla): Plantilla {
  return PLANTILLAS[nombre];
}
