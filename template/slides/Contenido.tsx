'use client';

import { useRef } from 'react';
import { Cabecera } from '../partes/Cabecera';
import { Desliza } from '../partes/Desliza';
import { FuenteCitada } from '../partes/FuenteCitada';
import { Numero } from '../partes/Numero';
import { Pie } from '../partes/Pie';
import { AyudasDeAjuste, type Ayudas } from '../partes/Ayudas';
import { marcado, renglones } from '../texto';
import { bloque, lienzo } from '../tokens';
import type { Marca, Overrides, SlideContenido } from '../tipos';
import { usarAjuste } from '../usarAjuste';
import { useReportarAjuste } from '../avisos';
import { variablesDePlantilla } from '../variables';

/**
 * El caballo de batalla: título, bajada opcional, cuerpo y un elemento visual
 * que puede ser foto o ícono.
 *
 * La diferencia entre los dos casos la resuelve una sola regla de CSS: la foto
 * lleva margin-top:auto y se come todo el hueco libre, así que se pega al fondo
 * del área y el texto queda arriba; el ícono no, así que el bloque completo
 * queda centrado. Sin elemento visual pasa lo mismo que con ícono.
 */
export function Contenido({
  slide,
  marca,
  numero,
  ultimo,
  ayudas,
  id,
  indice,
}: {
  slide: SlideContenido;
  marca: Marca;
  numero: string | null;
  ultimo: boolean;
  ayudas?: Ayudas;
  id?: string;
  /** Posición en el carrusel, para que el aviso de ajuste sepa de quién es. */
  indice?: number;
}) {
  const area = useRef<HTMLDivElement>(null);
  const ajuste = usarAjuste(area, [slide.titulo, slide.bajada, slide.cuerpo, slide.visual]);
  useReportarAjuste(indice, ajuste);
  const ov = slide.overrides ?? {};

  return (
    <div id={id} className="slide" style={variablesDePlantilla()}>
      <Cabecera marca={marca} />
      <Numero numero={numero} />

      <div className="area" ref={area} style={areaDesplazada(ov)}>
        {slide.emblema ? (
          <img
            className="emblema"
            src={`/iconos/${slide.emblema.slug}.png`}
            alt=""
            style={slide.emblema.tam ? { width: slide.emblema.tam } : undefined}
          />
        ) : null}

        <h2
          className="titulo"
          data-renglones={renglones(slide.titulo)}
          data-base-px={ov.tituloPx}
          style={ov.tituloPx ? { fontSize: ov.tituloPx } : undefined}
        >
          {marcado(slide.titulo)}
        </h2>

        {slide.bajada ? <p className="bajada">{slide.bajada}</p> : null}

        {slide.cuerpo ? (
          <p
            className="cuerpo"
            data-base-px={ov.cuerpoPx}
            style={ov.cuerpoPx ? { fontSize: ov.cuerpoPx } : undefined}
          >
            {slide.cuerpo}
          </p>
        ) : null}

        {slide.visual.clase === 'foto' ? (
          <div
            className="media"
            style={{
              backgroundImage: `url(${slide.visual.src})`,
              width: ov.mediaAncho ?? undefined,
              height: slide.visual.alto ?? ov.mediaAlto ?? undefined,
            }}
          />
        ) : null}

        {slide.visual.clase === 'icono' && slide.visual.slug ? (
          <img
            className="icono"
            src={`/iconos/${slide.visual.slug}.png`}
            alt=""
            style={{ width: slide.visual.tam ?? ov.mediaAncho ?? bloque.iconoTam }}
          />
        ) : null}
      </div>

      <FuenteCitada fuente={slide.fuente} />
      <Pie usuario={marca.usuario} />
      <Desliza flecha={marca.flecha} visible={!ultimo} />
      <AyudasDeAjuste {...ayudas} />
    </div>
  );
}

/**
 * `offsetY` empuja el bloque sin cambiar el alto del área: se mueven los dos
 * bordes a la vez. Es la única forma de meter píxeles a mano en el contenido, y
 * vive en el JSON del post, nunca en los tokens.
 */
export function areaDesplazada(ov: Overrides) {
  if (!ov.offsetY) return undefined;
  return {
    top: lienzo.areaTop + ov.offsetY,
    bottom: lienzo.areaBottom - ov.offsetY,
  };
}
