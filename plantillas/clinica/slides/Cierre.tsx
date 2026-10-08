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
 * Este slide no guarda datos propios. Todo sale de proyecto.json, así que el
 * día que cambie la ciudad o la plataforma de citas se corrige en un solo lugar
 * y se arregla el archivo histórico completo. Las dos líneas de la llamada a la
 * acción también: «Consulta en Durango / Agenda tu cita desde» es de una
 * consulta, y otra cuenta dirá otra cosa.
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
        <div className="cta__l1">{marcado(conMarca(marca.cierre.lugar, marca))}</div>
        <div className="cta__l2">{marcado(conMarca(marca.cierre.invitacion, marca))}</div>
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

/** `{ciudad}` y `{plataforma}` en el texto del cierre, con los de la marca. */
function conMarca(texto: string, marca: Marca) {
  return texto.replaceAll('{ciudad}', marca.ciudad).replaceAll('{plataforma}', marca.plataforma);
}
