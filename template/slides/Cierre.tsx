'use client';

import { Cabecera } from '../partes/Cabecera';
import { Numero } from '../partes/Numero';
import { Pie } from '../partes/Pie';
import { AyudasDeAjuste, type Ayudas } from '../partes/Ayudas';
import { marcado } from '../texto';
import { color, velo } from '../tokens';
import type { NombrePaleta } from '../tokens';
import type { Marca, SlideCierre } from '../tipos';
import { variablesDePlantilla } from '../variables';

/**
 * Cierre: retrato del médico, velo oscuro y llamada a la acción.
 *
 * Este slide no guarda datos propios. Todo sale de content/marca.json, así que
 * el día que cambie la ciudad o la plataforma de citas se corrige en un solo
 * lugar y se arregla el archivo histórico completo.
 *
 * La cabecera y el número van en tinta oscura porque la parte de arriba del
 * retrato es clara.
 */
export function Cierre({
  slide,
  marca,
  numero,
  ayudas,
  id,
  paleta,
}: {
  slide: SlideCierre;
  marca: Marca;
  numero: string | null;
  ayudas?: Ayudas;
  id?: string;
  paleta?: NombrePaleta;
}) {
  return (
    <div
      id={id}
      className="slide slide--cierre slide--tintaOscura"
      style={{ ...variablesDePlantilla(paleta), background: color.fondoCierre }}
    >
      {marca.retrato ? (
        <div className="slide__foto" style={{ backgroundImage: `url(${marca.retrato})` }} />
      ) : null}
      <div className="slide__velo" style={{ background: velo.cierre }} />

      <Cabecera marca={marca} />
      <Numero numero={numero} />

      <div className="cta">
        {slide.frase ? <div className="cta__frase">{marcado(slide.frase)}</div> : null}
        <div className="cta__l1">{marcado(`*Consulta en* **${marca.ciudad}**`)}</div>
        <div className="cta__l2">Agenda tu cita desde</div>
        <div className="cta__l3">
          {marca.plataformaLogo ? (
            <img src={marca.plataformaLogo} alt={marca.plataforma} />
          ) : (
            marca.plataforma
          )}
        </div>
      </div>

      <Pie usuario={marca.usuario} />
      <AyudasDeAjuste {...ayudas} />
    </div>
  );
}
