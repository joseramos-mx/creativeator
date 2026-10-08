import { bloque } from '../tokens';

/**
 * La palomita verde de las listas.
 *
 * Va dibujada y no como emoji ✅ porque el emoji cambia según el sistema y en
 * la captura sale distinto en cada máquina. Y va en línea y no como archivo
 * porque su color es de la paleta: sobre la paleta verde, el verde de siempre
 * tendría ΔE 21 contra el fondo, o sea que desaparecería.
 */
export function Palomita() {
  const s = bloque.palomita;
  return (
    <svg viewBox={`0 0 ${s} ${s}`} aria-hidden>
      <rect width={s} height={s} rx={s * 0.18} fill="var(--check)" />
      <path
        d={`M ${s * 0.24} ${s * 0.53} L ${s * 0.43} ${s * 0.71} L ${s * 0.77} ${s * 0.3}`}
        fill="none"
        stroke="var(--papel)"
        strokeWidth={s * 0.13}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
