import type { CSSProperties } from 'react';
import { bloque, color, fuente, lienzo, tipo, track } from './tokens';

/**
 * Puente entre tokens.ts y plantilla.css.
 *
 * plantilla.css no lleva ni un número suelto: todo lo lee de estas variables,
 * que se inyectan en el elemento .slide. Así `tokens.ts` sigue siendo la única
 * fuente de verdad y aun así el CSS se puede leer y tocar como CSS normal.
 */
export function variablesDePlantilla(): CSSProperties {
  const v: Record<string, string> = {
    '--ancho': `${lienzo.ancho}px`,
    '--alto': `${lienzo.alto}px`,
    '--margen-borde': `${lienzo.margenBorde}px`,
    '--margen-lateral': `${lienzo.margenLateral}px`,
    '--area-top': `${lienzo.areaTop}px`,
    '--area-bottom': `${lienzo.areaBottom}px`,

    '--azul': color.azul,
    '--c-titulo': color.titulo,
    '--crema': color.crema,
    '--c-bajada': color.bajada,
    '--c-cuerpo': color.cuerpo,
    '--c-chrome': color.chrome,
    '--papel': color.papel,
    '--tinta-papel': color.tintaPapel,
    '--tinta-foto': color.tintaSobreFoto,
    '--verde': color.verde,
    '--teal': color.tealCta,

    '--sans': fuente.sans,
    '--serif': fuente.serif,
    '--serif-ls': track.serif,
  };

  // Cada rol tipográfico se expande a --<rol>-px, -lh, -ls, -peso, -fuerte, -ancho.
  for (const [rol, t] of Object.entries(tipo)) {
    const d = t as Record<string, unknown>;
    const n = aGuiones(rol);
    v[`--${n}-px`] = `${d.px}px`;
    v[`--${n}-ls`] = String(d.ls);
    v[`--${n}-peso`] = String(d.peso);
    if (d.lh !== undefined) v[`--${n}-lh`] = String(d.lh);
    if (d.pesoFuerte !== undefined) v[`--${n}-fuerte`] = String(d.pesoFuerte);
    if (d.anchoMax !== undefined) v[`--${n}-ancho`] = `${d.anchoMax}px`;
  }

  for (const [nombre, valor] of Object.entries(bloque)) {
    v[`--b-${aGuiones(nombre)}`] = `${valor}px`;
  }

  return v as CSSProperties;
}

function aGuiones(s: string) {
  return s.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
}
