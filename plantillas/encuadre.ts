import type { CSSProperties } from 'react';
import type { Overrides } from './clinica/tipos';

/**
 * plantillas/encuadre.ts — el encuadre de la foto de fondo de la portada.
 *
 * Las tres plantillas pintan la foto como fondo a sangre con `cover`, y cada
 * una decide en su CSS por dónde se recorta. Eso acierta con un paisaje y falla
 * con una persona: la mamá del crup quedaba con la cabeza tapada por el
 * degradado. `fotoX`/`fotoY` mueven el recorte y `fotoZoom` acerca.
 *
 * El zoom va con `transform` y no con `background-size` porque `cover` no se
 * puede multiplicar sin saber el tamaño de la foto. Por eso lo que vaya encima
 * de la foto —degradado, velo— tiene que ser un hermano y no un `::after`: si
 * no, se acercaría con ella.
 */
export function estiloEncuadre(ov: Overrides | undefined): CSSProperties {
  const x = ov?.fotoX;
  const y = ov?.fotoY;
  const zoom = ov?.fotoZoom;
  const estilo: CSSProperties = {};
  if (x !== undefined || y !== undefined) {
    estilo.backgroundPosition = `${x ?? 50}% ${y ?? 50}%`;
  }
  if (zoom && zoom !== 1) {
    estilo.transform = `scale(${zoom})`;
    estilo.transformOrigin = `${x ?? 50}% ${y ?? 50}%`;
  }
  return estilo;
}
