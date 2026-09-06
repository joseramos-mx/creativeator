'use client';

import type { Ayudas } from './partes/Ayudas';
import { Cierre } from './slides/Cierre';
import { Contenido } from './slides/Contenido';
import { Lista } from './slides/Lista';
import { Portada } from './slides/Portada';
import { numeroDeSlide, type Marca, type Slide as TSlide } from './tipos';

export type PropsSlide = {
  slides: TSlide[];
  indice: number;
  marca: Marca;
  ayudas?: Ayudas;
  /** La ruta /render se lo pone al slide para que Playwright lo capture. */
  id?: string;
};

/**
 * Despachador por tipo de slide.
 *
 * Cada tipo tiene sus propios campos y ninguno acepta los del otro, así que
 * aquí solo se elige el componente y se calcula lo que depende de la posición
 * en el carrusel: el número y si lleva flecha de "desliza".
 */
export function Slide({ slides, indice, marca, ayudas, id }: PropsSlide) {
  const slide = slides[indice];
  const numero = numeroDeSlide(slides, indice);
  const ultimo = indice === slides.length - 1;

  switch (slide.tipo) {
    case 'portada':
      return <Portada slide={slide} marca={marca} ayudas={ayudas} id={id} />;
    case 'contenido':
      return (
        <Contenido
          slide={slide}
          marca={marca}
          numero={numero}
          ultimo={ultimo}
          ayudas={ayudas}
          id={id}
        />
      );
    case 'lista':
      return (
        <Lista slide={slide} marca={marca} numero={numero} ultimo={ultimo} ayudas={ayudas} id={id} />
      );
    case 'cierre':
      return <Cierre marca={marca} numero={numero} ayudas={ayudas} id={id} />;
  }
}
