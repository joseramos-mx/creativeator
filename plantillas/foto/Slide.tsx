'use client';

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { AyudasDeAjuste } from '../clinica/partes/Ayudas';
import type { PropsSlide } from '../clinica/Slide';
import type { Marca, Overrides, Slide as TSlide } from '../clinica/tipos';
import { disenoDe, paletaDelPost } from '../paletas';
import { estiloEncuadre } from '../encuadre';
import { conNegritas, Fuentes } from '../plana/Slide';

/**
 * plantillas/foto — la foto a sangre con una frase encima.
 *
 * Salió de los posts de Ahimsa Travel: cada slide es una foto real del viaje
 * —la maleta abierta, la pantalla del avión—, el logo chico abajo al centro y
 * una frase de dos renglones en serif blanca a media altura ("WTF" / "Zona de
 * confort"). No lleva número, ni usuario, ni ícono: lo único que compite con
 * la foto es la frase, y por eso es corta.
 *
 * Lo que cambia de una cuenta a otra —las tipografías, los colores— viene de
 * `diseno` en su proyecto.json, igual que en `plana`.
 *
 * Cada slide elige su estilo (`estilo` en el JSON): `frase`, el de siempre;
 * `texto`, con título y párrafo en la mitad de abajo; e `imagen`, casi solo la
 * foto. La foto va entera, sin velos ni degradados: lo que hace legible el
 * texto es su sombra.
 *
 * Los slides que no traen foto propia —la lista, el cierre, uno al que todavía
 * no se le eligió— van sobre la foto de la portada, oscurecida. Así el cierre
 * sigue pareciendo del mismo carrusel y el logo, que es blanco, se lee.
 *
 * El título se escribe en dos renglones con un salto de línea; el primero es
 * la línea corta. `**así**` y `*así*` no cambian de tipografía: aquí todo va
 * en la de título y los asteriscos solo se quitan.
 */

const sinMarcado = (t: string) => t.replace(/\*/g, '');

/**
 * Cada renglón en su bloque, para que el equilibrado de líneas trabaje por
 * renglón: con un solo bloque y `pre-line`, "Dejar Europa para algún día"
 * dejaba "día" solo abajo.
 */
const renglones = (t: string) =>
  sinMarcado(t)
    .split('\n')
    .map((r, i) => (
      <span key={i} className="foto__renglon">
        {r}
      </span>
    ));

/** Que la frase quepa: si se sale de su área, se encoge de a poco. */
function useCabe(deps: unknown[]) {
  const area = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(1);
  useLayoutEffect(() => {
    setEscala(1);
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    if (el.scrollHeight > el.clientHeight + 2 && escala > 0.6) setEscala((e) => Math.round((e - 0.04) * 100) / 100);
  });
  return { area, escala };
}

/** La foto del slide, si la tiene y ya está elegida. */
function fotoDe(slide: TSlide): string | undefined {
  if (slide.tipo === 'portada') return slide.foto;
  if (slide.tipo === 'contenido' && slide.visual.clase === 'foto') return slide.visual.src;
  return undefined;
}

function variables(marca: Marca, paleta?: string, colores?: PropsSlide['colores']): CSSProperties {
  const d = disenoDe(marca);
  const p = paletaDelPost(marca, paleta);
  return {
    '--foto-fondo': colores?.fondo ?? p.color,
    '--foto-tinta': colores?.tinta ?? p.tinta,
    '--foto-titulo': `'${d.tituloFuente}', Georgia, serif`,
    '--foto-texto': `'${d.textoFuente}', system-ui, sans-serif`,
    '--foto-mayusculas': d.tituloMayusculas ? 'uppercase' : 'none',
  } as CSSProperties;
}

const desplazado = (ov: Overrides | undefined): CSSProperties | undefined =>
  ov?.offsetY ? { transform: `translateY(${ov.offsetY}px)` } : undefined;

export function Slide({ slides, indice, marca, ayudas, id, paleta, colores }: PropsSlide) {
  const slide: TSlide = slides[indice];
  const ov = 'overrides' in slide ? slide.overrides : undefined;
  const { area, escala } = useCabe([slide]);
  const d = disenoDe(marca);

  // Sin foto propia, la de la portada detrás de un velo más oscuro.
  const propia = fotoDe(slide);
  const portada = slides.find((s) => s.tipo === 'portada');
  const foto = propia ?? (portada ? fotoDe(portada) : undefined);
  const prestada = !propia && Boolean(foto);
  const estilo = (slide.tipo === 'portada' || slide.tipo === 'contenido' ? slide.estilo : undefined) ?? 'frase';

  // Un logo que no carga se vería como un ícono roto en el PNG: mejor el nombre.
  const [sinLogo, setSinLogo] = useState<string | null>(null);
  const logo = marca.logo && sinLogo !== marca.logo ? marca.logo : '';
  const img = useRef<HTMLImageElement>(null);
  useLayoutEffect(() => {
    const el = img.current;
    if (el && el.complete && el.naturalWidth === 0) setSinLogo(logo);
  }, [logo]);

  let contenido: ReactNode;
  if (slide.tipo === 'cierre') {
    const conMarca = (t: string) => t.replaceAll('{ciudad}', marca.ciudad).replaceAll('{plataforma}', marca.plataforma);
    contenido = (
      <>
        {slide.frase ? <h2 className="foto__frase">{renglones(slide.frase)}</h2> : null}
        <p className="foto__lugar">{conNegritas(conMarca(marca.cierre.lugar))}</p>
        <p className="foto__invitacion">{conNegritas(conMarca(marca.cierre.invitacion))}</p>
        {marca.plataformaLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="foto__plataforma" src={marca.plataformaLogo} alt={marca.plataforma} />
        ) : (
          <p className="foto__plataforma foto__plataforma--texto">{marca.plataforma}</p>
        )}
      </>
    );
  } else if (estilo === 'imagen') {
    // Casi solo la foto: el título, si lo hay, como pie de una línea.
    contenido = slide.titulo.trim() ? (
      <p className="foto__pie">{sinMarcado(slide.titulo).replace(/\s*\n\s*/g, ' ')}</p>
    ) : null;
  } else {
    const largo = estilo === 'frase' && sinMarcado(slide.titulo).length > 48;
    contenido = (
      <>
        <h2
          className={`foto__frase${largo ? ' foto__frase--larga' : ''}`}
          style={ov?.tituloPx ? { fontSize: ov.tituloPx } : undefined}
        >
          {renglones(slide.titulo)}
        </h2>
        {slide.tipo === 'contenido' && slide.cuerpo ? (
          <p className="foto__cuerpo" style={ov?.cuerpoPx ? { fontSize: ov.cuerpoPx } : undefined}>
            {conNegritas(slide.cuerpo)}
          </p>
        ) : null}
        {slide.tipo === 'lista' ? (
          <ul className="foto__puntos" style={ov?.cuerpoPx ? { fontSize: ov.cuerpoPx } : undefined}>
            {slide.puntos.map((p, i) => (
              <li key={i}>{conNegritas(p)}</li>
            ))}
          </ul>
        ) : null}
      </>
    );
  }

  return (
    <div
      id={id}
      className={`foto foto--${slide.tipo} foto--${estilo}${foto ? '' : ' foto--sin-foto'}${prestada ? ' foto--prestada' : ''}`}
      style={variables(marca, paleta, colores)}
    >
      <Fuentes familias={[d.tituloFuente, d.textoFuente]} />
      {foto ? (
        <div
          className="foto__imagen"
          style={{ backgroundImage: `url(${foto})`, ...(slide.tipo === 'portada' ? estiloEncuadre(ov) : null) }}
        />
      ) : null}
      <div className="foto__velo" />
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img ref={img} className="foto__logo" src={logo} alt={marca.nombre} onError={() => setSinLogo(logo)} />
      ) : (
        <span className="foto__logo foto__logo--texto">{marca.nombre}</span>
      )}
      <div className="foto__area" ref={area} style={{ ...desplazado(ov), '--escala': escala } as CSSProperties}>
        {contenido}
      </div>
      {'fuente' in slide && slide.fuente ? <span className="foto__fuente">{slide.fuente}</span> : null}
      <AyudasDeAjuste {...ayudas} />
    </div>
  );
}
