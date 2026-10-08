import { bloque } from '../tokens';

/**
 * La palabra sobre la flecha curva. Se omite en el último slide.
 *
 * La flecha va en línea y hereda el color del texto, así que sigue a la paleta
 * sin que haya que regenerar nada.
 */
export function Desliza({ visible }: { visible: boolean }) {
  if (!visible) return null;

  const { flechaAncho: w, flechaAlto: h } = bloque;
  return (
    <div className="desliza">
      <span>DESLIZA</span>
      <svg viewBox={`0 0 ${w} ${h}`} aria-hidden>
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth={3.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d={`M 4 11 Q ${(w * 0.45).toFixed(1)} ${(h - 4).toFixed(1)} ${(w - 10).toFixed(1)} 14`} />
          <path d={`M ${(w - 23).toFixed(1)} 9 L ${(w - 6).toFixed(1)} 14 L ${(w - 20).toFixed(1)} 24`} />
        </g>
      </svg>
    </div>
  );
}
