'use client';

import { bloque, lienzo } from '../tokens';

export type Ayudas = {
  /** Tecla G: márgenes, área de contenido y zonas seguras de Instagram. */
  rejilla?: boolean;
  /** Tecla R: la captura publicada encima, en modo diferencia. */
  overlay?: string;
  overlayOpacidad?: number;
};

/**
 * Ayudas de ajuste sobre el canvas. Solo en desarrollo: son la forma más rápida
 * de cazar una diferencia de tracking o de interlineado contra la referencia.
 */
export function AyudasDeAjuste({ rejilla, overlay, overlayOpacidad = 1 }: Ayudas) {
  if (process.env.NODE_ENV !== 'development') return null;

  return (
    <>
      {rejilla ? (
        <div className="rejilla">
          {/* márgenes laterales del contenido */}
          <i className="v" style={{ left: lienzo.margenLateral }} />
          <i className="v" style={{ left: lienzo.ancho - lienzo.margenLateral }} />
          {/* márgenes de cabecera y pie */}
          <i className="v" style={{ left: lienzo.margenBorde }} />
          <i className="v" style={{ left: lienzo.ancho - lienzo.margenBorde }} />
          {/* eje central */}
          <i className="v" style={{ left: lienzo.ancho / 2, opacity: 0.5 }} />
          {/* área de contenido */}
          <i className="h" style={{ top: lienzo.areaTop }} />
          <i className="h" style={{ top: lienzo.alto - lienzo.areaBottom }} />
          {/* zonas donde Instagram encima su interfaz */}
          <i className="zona" style={{ top: 0, height: 90 }} />
          <i className="zona" style={{ bottom: 0, height: 120 }} />
          {/* base del bloque de la portada */}
          <i className="h" style={{ top: lienzo.alto - bloque.areaPortadaBottom, opacity: 0.5 }} />
        </div>
      ) : null}

      {overlay ? (
        <div
          className="overlayRef"
          style={{ backgroundImage: `url(${overlay})`, opacity: overlayOpacidad }}
        />
      ) : null}
    </>
  );
}
