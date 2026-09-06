'use client';

import { useRef } from 'react';
import { PapelRasgado } from '../partes/PapelRasgado';
import { Pie } from '../partes/Pie';
import { AyudasDeAjuste, type Ayudas } from '../partes/Ayudas';
import { marcado, renglones } from '../texto';
import { velo } from '../tokens';
import type { Marca, SlidePortada } from '../tipos';
import { usarAjuste } from '../usarAjuste';
import { useReportarAjuste } from '../avisos';
import { variablesDePlantilla } from '../variables';

/**
 * Portada: foto a sangre, velo que termina fundido en el azul plano (para que
 * empalme con el slide 01), título anclado abajo, papel rasgado con la pregunta
 * gancho, logotipo y usuario. Sin número, sin desliza y sin fuente citada.
 */
export function Portada({
  slide,
  marca,
  ayudas,
  id,
  indice,
}: {
  slide: SlidePortada;
  marca: Marca;
  ayudas?: Ayudas;
  id?: string;
  /** Posición en el carrusel, para que el aviso de ajuste sepa de quién es. */
  indice?: number;
}) {
  const area = useRef<HTMLDivElement>(null);
  const ajuste = usarAjuste(area, [slide.titulo, slide.pregunta]);
  useReportarAjuste(indice, ajuste);
  const ov = slide.overrides ?? {};

  return (
    <div id={id} className="slide slide--portada" style={variablesDePlantilla()}>
      {slide.foto ? (
        <div className="slide__foto" style={{ backgroundImage: `url(${slide.foto})` }} />
      ) : null}
      <div className="slide__velo" style={{ background: velo.portada }} />

      <div className="area" ref={area} style={desplaza(ov.offsetY)}>
        <h1
          className="titulo"
          data-renglones={renglones(slide.titulo)}
          data-base-px={ov.tituloPx}
          style={ov.tituloPx ? { fontSize: ov.tituloPx } : undefined}
        >
          {marcado(slide.titulo)}
        </h1>
        <PapelRasgado src={marca.papel} pregunta={slide.pregunta} />
      </div>

      <div className="logo">
        <img src={marca.logo} alt={marca.nombre} />
      </div>
      <Pie usuario={marca.usuario} />
      <AyudasDeAjuste {...ayudas} />
    </div>
  );
}

function desplaza(offsetY?: number) {
  if (!offsetY) return undefined;
  return { transform: `translateY(${offsetY}px)` };
}
