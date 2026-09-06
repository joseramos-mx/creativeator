'use client';

import { useId } from 'react';
import { bloque } from '../tokens';

/**
 * El papel rasgado con la pregunta gancho encima.
 *
 * El dibujo se calcula aquí, con el SVG en línea, y no se genera a un archivo:
 * así el color sale de la paleta del post (`--papel`) en vez de quedar quemado
 * en el momento de generarlo. Doce archivos por cada paleta no escala; una
 * función que lee dos variables CSS, sí.
 *
 * La forma es determinista a partir de una semilla, de modo que un carrusel
 * siempre lleva el mismo rasgado —el render y la exportación tienen que
 * coincidir píxel a píxel— pero dos carruseles seguidos casi nunca comparten
 * el suyo y el feed no se ve repetido.
 */
export function PapelRasgado({ pregunta, semilla }: { pregunta: string; semilla: number }) {
  const recorte = useId();
  const { papelAncho: w, papelAlto: h } = bloque;
  const rnd = azar(semilla);

  const arriba = borde(w, 9, -1, rnd);
  const abajo = borde(w, h - 9, 1, rnd).reverse();
  const contorno = [
    `M ${arriba[0][0]} ${arriba[0][1]}`,
    ...arriba.slice(1).map(([x, y]) => `L ${x} ${y}`),
    ...abajo.map(([x, y]) => `L ${x} ${y}`),
    'Z',
  ].join(' ');

  // Textura de fibra: trazos de 1 px, mitad blancos y mitad negros, al 6 %.
  const fibra = Array.from({ length: 260 }, () => ({
    x: +(rnd() * w).toFixed(1),
    y: +(rnd() * h).toFixed(1),
    w: +(rnd() * 22).toFixed(1),
  }));

  return (
    <div className="papel">
      <svg viewBox={`0 0 ${w} ${h}`} aria-hidden>
        <defs>
          <clipPath id={recorte}>
            <path d={contorno} />
          </clipPath>
        </defs>
        <path d={contorno} fill="var(--papel)" />
        <g clipPath={`url(#${recorte})`} opacity="0.06">
          {fibra.map((f, i) => (
            <rect key={i} x={f.x} y={f.y} width={f.w} height="1" fill={i % 2 ? '#000' : '#fff'} />
          ))}
        </g>
      </svg>
      <span>{pregunta}</span>
    </div>
  );
}

/** Aleatorio con semilla: la misma semilla da siempre el mismo rasgado. */
function azar(semilla: number) {
  let r = semilla;
  return () => ((r = (r * 9301 + 49297) % 233280) / 233280);
}

/**
 * Un borde rasgado: un punto cada 14 px con desviación de 1 a 10 px, alternando
 * la amplitud. Si todos los dientes miden lo mismo, el papel se ve troquelado
 * en vez de roto.
 */
function borde(ancho: number, y: number, direccion: number, rnd: () => number) {
  const puntos: [number, number][] = [];
  for (let x = 0; x <= ancho; x += 14) {
    const amplitud = (x % 28 < 14 ? 1 : 4) + rnd() * 9;
    puntos.push([x, +(y + direccion * amplitud).toFixed(2)]);
  }
  puntos.push([ancho, +(y + direccion * (1 + rnd() * 9)).toFixed(2)]);
  return puntos;
}

/** La semilla sale del texto del slide: sin propagar el slug hasta aquí. */
export function semillaDeTexto(texto: string) {
  let h = 7;
  for (let i = 0; i < texto.length; i++) h = (h * 31 + texto.charCodeAt(i)) % 100003;
  return h + 7;
}
