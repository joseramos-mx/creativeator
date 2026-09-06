'use client';

import { useRef } from 'react';
import { Cabecera } from '../partes/Cabecera';
import { Desliza } from '../partes/Desliza';
import { FuenteCitada } from '../partes/FuenteCitada';
import { Numero } from '../partes/Numero';
import { Palomita } from '../partes/Palomita';
import { Pie } from '../partes/Pie';
import { AyudasDeAjuste, type Ayudas } from '../partes/Ayudas';
import { marcado, renglones } from '../texto';
import type { Marca, SlideLista } from '../tipos';
import { usarAjuste } from '../usarAjuste';
import { variablesDePlantilla } from '../variables';
import { areaDesplazada } from './Contenido';

/**
 * Cuatro puntos accionables con palomita verde, sin cuerpo corrido.
 *
 * Sí: la palomita queda a la izquierda de un texto centrado. Así es la
 * referencia, y es lo que hace que la lista se lea como lista y no como párrafo.
 * Cuatro puntos es el máximo cómodo; con cinco, el ajuste automático baja el
 * cuerpo solo.
 */
export function Lista({
  slide,
  marca,
  numero,
  ultimo,
  ayudas,
  id,
}: {
  slide: SlideLista;
  marca: Marca;
  numero: string | null;
  ultimo: boolean;
  ayudas?: Ayudas;
  id?: string;
}) {
  const area = useRef<HTMLDivElement>(null);
  usarAjuste(area, [slide.titulo, slide.puntos]);
  const ov = slide.overrides ?? {};

  return (
    <div id={id} className="slide" style={variablesDePlantilla()}>
      <Cabecera marca={marca} />
      <Numero numero={numero} />

      <div className="area" ref={area} style={areaDesplazada(ov)}>
        <h2
          className="titulo"
          data-renglones={renglones(slide.titulo)}
          data-base-px={ov.tituloPx}
          style={ov.tituloPx ? { fontSize: ov.tituloPx } : undefined}
        >
          {marcado(slide.titulo)}
        </h2>

        <ul className="lista">
          {slide.puntos.map((punto, i) => (
            <li className="lista__item" key={i}>
              <Palomita src={marca.palomita} />
              <p data-base-px={ov.cuerpoPx} style={ov.cuerpoPx ? { fontSize: ov.cuerpoPx } : undefined}>
                {marcado(punto)}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <FuenteCitada fuente={slide.fuente} />
      <Pie usuario={marca.usuario} />
      <Desliza flecha={marca.flecha} visible={!ultimo} />
      <AyudasDeAjuste {...ayudas} />
    </div>
  );
}
