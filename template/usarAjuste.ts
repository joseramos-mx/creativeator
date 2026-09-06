'use client';

import { useLayoutEffect, useState, type RefObject } from 'react';
import { ajuste } from './tokens';

export type EstadoAjuste = {
  /** El título llegó al mínimo y aun así no cabe: hay que recortarlo. */
  tituloApretado: boolean;
  /** El cuerpo llegó al mínimo. Encogerlo más lo vuelve ilegible. */
  cuerpoApretado: boolean;
};

/**
 * Ajuste automático de texto.
 *
 * El texto pegado nunca mide lo que el diseño espera, así que antes de pintar
 * se reduce en pasos de 2 px hasta caber. Dos reglas, en este orden:
 *
 *  1. El título no puede romper más renglones de los que escribió el autor.
 *     Los saltos de línea de un título son una decisión de redacción, no un
 *     accidente del ancho de la caja.
 *  2. El bloque completo no puede desbordar el área. Primero cede el cuerpo,
 *     que tiene más margen; el título solo si con eso no alcanzó.
 *
 * Vive en template/ y no en el editor a propósito: la ruta /render tiene que
 * correr exactamente este mismo cálculo o el PNG saldrá distinto de la vista
 * previa, que es el error clásico de este tipo de proyecto.
 */
export function usarAjuste(
  ref: RefObject<HTMLElement | null>,
  deps: unknown[] = [],
): EstadoAjuste {
  const [estado, setEstado] = useState<EstadoAjuste>({
    tituloApretado: false,
    cuerpoApretado: false,
  });

  useLayoutEffect(() => {
    const area = ref.current;
    if (!area) return;

    const titulo = area.querySelector<HTMLElement>('.titulo');
    const cuerpos = Array.from(
      area.querySelectorAll<HTMLElement>('.cuerpo, .bajada, .lista__item p'),
    );

    // Se parte siempre del tamaño base, no del ajuste de la vuelta anterior.
    // Base es el override del slide si lo hay, y si no el valor del token: si
    // aquí se borrara el tamaño a secas, el ajuste se comería los overrides.
    if (titulo) reiniciar(titulo);
    for (const c of cuerpos) reiniciar(c);

    const basePx = (el: HTMLElement) => parseFloat(getComputedStyle(el).fontSize);

    // 1 — el título respeta los saltos escritos
    let tituloPx = titulo ? basePx(titulo) : 0;
    let tituloApretado = false;
    if (titulo) {
      const escritos = Number(titulo.dataset.renglones ?? 1);
      while (renglonesPintados(titulo) > escritos) {
        if (tituloPx - ajuste.paso < ajuste.tituloMin) {
          tituloApretado = true;
          break;
        }
        tituloPx -= ajuste.paso;
        titulo.style.fontSize = `${tituloPx}px`;
      }
    }

    // 2 — el bloque completo cabe en el área
    const escalas = cuerpos.map(basePx);
    let cuerpoApretado = false;

    for (let vuelta = 0; vuelta < 40 && desborda(area); vuelta++) {
      const puedeCuerpo = escalas.some((px) => px - ajuste.paso >= ajuste.cuerpoMin);
      if (puedeCuerpo) {
        cuerpos.forEach((el, i) => {
          if (escalas[i] - ajuste.paso >= ajuste.cuerpoMin) {
            escalas[i] -= ajuste.paso;
            el.style.fontSize = `${escalas[i]}px`;
          }
        });
        cuerpoApretado = escalas.some((px) => px <= ajuste.cuerpoMin);
      } else if (titulo && tituloPx - ajuste.paso >= ajuste.tituloMin) {
        tituloPx -= ajuste.paso;
        titulo.style.fontSize = `${tituloPx}px`;
        tituloApretado = tituloPx <= ajuste.tituloMin;
      } else {
        tituloApretado = tituloApretado || Boolean(titulo);
        cuerpoApretado = cuerpoApretado || cuerpos.length > 0;
        break;
      }
    }

    setEstado((prev) =>
      prev.tituloApretado === tituloApretado && prev.cuerpoApretado === cuerpoApretado
        ? prev
        : { tituloApretado, cuerpoApretado },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return estado;
}

function reiniciar(el: HTMLElement) {
  el.style.fontSize = el.dataset.basePx ? `${el.dataset.basePx}px` : '';
}

function renglonesPintados(el: HTMLElement): number {
  const lh = parseFloat(getComputedStyle(el).lineHeight);
  if (!lh) return 1;
  return Math.max(1, Math.round(el.scrollHeight / lh));
}

/**
 * El área es un flex centrado, así que su scrollHeight no delata el desborde de
 * arriba: se suman los hijos a mano.
 */
function desborda(area: HTMLElement): boolean {
  let alto = 0;
  for (const hijo of Array.from(area.children) as HTMLElement[]) {
    if (hijo.classList.contains('rejilla') || hijo.classList.contains('overlayRef')) continue;
    const cs = getComputedStyle(hijo);
    alto += hijo.offsetHeight;
    alto += (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0);
  }
  return alto > area.clientHeight + 1;
}
