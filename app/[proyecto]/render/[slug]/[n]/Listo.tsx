'use client';

import { useEffect } from 'react';

/**
 * La bandera que espera Playwright antes de disparar la captura.
 *
 * Hacen falta las tres cosas y en este orden:
 *
 *  · `document.fonts.ready`, porque con font-display: block el texto se maqueta
 *    con las métricas del sustituto hasta que llega la fuente real;
 *  · dos cuadros de animación, para que el ajuste automático ya haya corrido su
 *    segunda pasada (la que dispara fonts.ready) y el navegador haya pintado;
 *  · recién entonces `data-listo`.
 *
 * Capturar antes es exactamente cómo salen los PNG con la letra equivocada, y
 * es un error que nadie nota hasta que el post está publicado.
 */
export function Listo() {
  useEffect(() => {
    let cancelado = false;
    document.fonts.ready.then(() => {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (!cancelado) document.body.setAttribute('data-listo', '1');
        }),
      );
    });
    return () => {
      cancelado = true;
    };
  }, []);

  return null;
}
