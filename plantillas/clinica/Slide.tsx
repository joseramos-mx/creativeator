'use client';

import type { Ayudas } from './partes/Ayudas';
import { Cierre } from './slides/Cierre';
import { Contenido } from './slides/Contenido';
import { Lista } from './slides/Lista';
import { Portada } from './slides/Portada';
import type { NombrePaleta } from './tokens';
import { numeroDeSlide, type Marca, type Slide as TSlide } from './tipos';

export type PropsSlide = {
  slides: TSlide[];
  indice: number;
  marca: Marca;
  ayudas?: Ayudas;
  /** La ruta /render se lo pone al slide para que Playwright lo capture. */
  id?: string;
  /** La paleta del post. Sin ella, la del token por defecto. */
  paleta?: NombrePaleta;
  /** Los colores propios del post. Solo los usa la plantilla plana. */
  colores?: { fondo: string; degradado?: string; tinta?: string };
};

/**
 * Despachador por tipo de slide.
 *
 * Cada tipo tiene sus propios campos y ninguno acepta los del otro, así que
 * aquí solo se elige el componente y se calcula lo que depende de la posición
 * en el carrusel: el número y si lleva flecha de "desliza".
 */
export function Slide({ slides, indice, marca, ayudas, id, paleta }: PropsSlide) {
  const slide = slides[indice];
  const numero = numeroDeSlide(slides, indice);
  const ultimo = indice === slides.length - 1;

  switch (slide.tipo) {
    case 'portada':
      return (
        <Portada slide={slide} marca={marca} ayudas={ayudas} id={id} indice={indice} paleta={paleta} />
      );
    case 'contenido':
      return (
        <Contenido
          slide={slide}
          marca={marca}
          numero={numero}
          ultimo={ultimo}
          ayudas={ayudas}
          id={id}
          indice={indice}
          paleta={paleta}
        />
      );
    case 'lista':
      return (
        <Lista
          slide={slide}
          marca={marca}
          numero={numero}
          ultimo={ultimo}
          ayudas={ayudas}
          id={id}
          indice={indice}
          paleta={paleta}
        />
      );
    case 'cierre':
      return <Cierre slide={slide} marca={marca} numero={numero} ayudas={ayudas} id={id} paleta={paleta} />;
  }
}
