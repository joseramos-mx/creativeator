'use client';

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { AyudasDeAjuste } from '../clinica/partes/Ayudas';
import type { PropsSlide } from '../clinica/Slide';
import { numeroDeSlide, type Marca, type Overrides, type Slide as TSlide } from '../clinica/tipos';
import { disenoDe, paletaDelPost } from '../paletas';

/**
 * plantillas/plana — el diseño de fondo plano, configurable por cuenta.
 *
 * Salió de las referencias de la Dra. Mildreth: fondo de un solo color, el logo
 * arriba a la izquierda, el número redondeado arriba a la derecha, el título
 * grande y grueso, el texto centrado con flechas, un ícono 3D debajo y el
 * usuario abajo a la izquierda. Lo que cambia de una cuenta a otra —colores,
 * tipografías, títulos en mayúsculas— viene de `diseno` en su proyecto.json,
 * que propone Claude al leer las referencias de la cuenta.
 *
 * El marcado de los títulos es el de siempre, con otro sentido:
 *   **así**  → la tipografía de título, que es la de la marca;
 *   *así*    → la del texto en negrita, para títulos más tranquilos;
 *   sin nada → la tipografía de título.
 * En el cuerpo y en los puntos, **así** es negrita.
 */

/** Las tipografías salen de Google Fonts; React 19 sube el <link> al <head>. */
function Fuentes({ familias }: { familias: string[] }) {
  const unicas = [...new Set(familias.filter(Boolean))];
  const url =
    'https://fonts.googleapis.com/css2?' +
    unicas.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@400;500;600;700;800;900`).join('&') +
    '&display=block';
  return <link rel="stylesheet" href={url} precedence="fuentes" />;
}

/** **negrita** en cuerpo y puntos. */
function conNegritas(texto: string): ReactNode {
  return texto.split(/(\*\*[\s\S]+?\*\*)/g).map((parte, i) =>
    parte.startsWith('**') && parte.endsWith('**') && parte.length > 4 ? (
      <b key={i}>{parte.slice(2, -2)}</b>
    ) : (
      parte.replace(/\*/g, '')
    ),
  );
}

/** El título: *suave* en la tipografía del texto, lo demás en la de título. */
function titulo(texto: string): ReactNode {
  return texto.split(/(\*\*[\s\S]+?\*\*|\*[\s\S]+?\*)/g).map((parte, i) => {
    if (parte.startsWith('**') && parte.endsWith('**') && parte.length > 4) return <span key={i}>{parte.slice(2, -2)}</span>;
    if (parte.startsWith('*') && parte.endsWith('*') && parte.length > 2) {
      return (
        <span key={i} className="plana__suave">
          {parte.slice(1, -1)}
        </span>
      );
    }
    return <span key={i}>{parte}</span>;
  });
}

/**
 * Que el contenido quepa: si el bloque se sale de su área, se encoge todo de a
 * poco. Es más simple que el ajuste de la plantilla clínica, porque aquí no hay
 * medidas de un diseño publicado que respetar al píxel.
 */
function useCabe(deps: unknown[]) {
  const area = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(1);
  useLayoutEffect(() => {
    setEscala(1);
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    if (el.scrollHeight > el.clientHeight + 2 && escala > 0.62) setEscala((e) => Math.round((e - 0.04) * 100) / 100);
  });
  return { area, escala };
}

/**
 * El texto sobre un fondo que no viene de la cuenta: blanco o casi negro, el
 * que más contraste dé. Sobre un amarillo 300 el blanco no se lee.
 */
function tintaPara(fondo: string): string {
  const canal = (i: number) => {
    const c = parseInt(fondo.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const l = 0.2126 * canal(1) + 0.7152 * canal(3) + 0.0722 * canal(5);
  const contraBlanco = 1.05 / (l + 0.05);
  const contraOscuro = (l + 0.05) / (0.0302 + 0.05); // #1F2937
  return contraBlanco >= contraOscuro ? '#FFFFFF' : '#1F2937';
}

function variables(marca: Marca, paleta?: string, colores?: PropsSlide['colores'], portada = false): CSSProperties {
  const d = disenoDe(marca);
  const p = paletaDelPost(marca, paleta);
  const fondo = colores?.fondo ?? p.color;
  const degradado = colores?.degradado ?? fondo;
  return {
    '--plana-fondo': fondo,
    '--plana-degradado': degradado,
    // En la portada el título va encima del degradado, no del fondo: el texto
    // se elige contra ese color.
    '--plana-tinta': colores?.tinta ?? (colores ? tintaPara(portada ? degradado : fondo) : p.tinta),
    '--plana-titulo': `'${d.tituloFuente}', system-ui, sans-serif`,
    '--plana-texto': `'${d.textoFuente}', system-ui, sans-serif`,
    '--plana-numero': `'${d.numeroFuente}', system-ui, sans-serif`,
    '--plana-mayusculas': d.tituloMayusculas ? 'uppercase' : 'none',
  } as CSSProperties;
}

function Marco({
  marca,
  paleta,
  colores,
  id,
  numero,
  clase,
  ayudas,
  children,
}: {
  marca: Marca;
  paleta?: string;
  colores?: PropsSlide['colores'];
  id?: string;
  numero: string | null;
  clase: string;
  ayudas?: PropsSlide['ayudas'];
  children: ReactNode;
}) {
  const d = disenoDe(marca);
  // Un logo que no carga —la ruta de proyecto.json sin archivo todavía— se
  // vería como un ícono roto en el PNG: mejor el nombre.
  const [sinLogo, setSinLogo] = useState<string | null>(null);
  const logo = marca.logo && sinLogo !== marca.logo ? marca.logo : '';
  const img = useRef<HTMLImageElement>(null);
  // Si falló antes de hidratar, onError ya no llega: se mira al montar.
  useLayoutEffect(() => {
    const el = img.current;
    if (el && el.complete && el.naturalWidth === 0) setSinLogo(logo);
  }, [logo]);
  return (
    <div id={id} className={`plana plana--${clase}`} style={variables(marca, paleta, colores, clase === 'portada')}>
      <Fuentes familias={[d.tituloFuente, d.textoFuente, d.numeroFuente]} />
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img ref={img} className="plana__logo" src={logo} alt={marca.nombre} onError={() => setSinLogo(logo)} />
      ) : (
        <span className="plana__logo plana__logo--texto">{marca.nombre}</span>
      )}
      {numero ? <span className="plana__numero">{numero}</span> : null}
      {children}
      <span className="plana__usuario">{marca.usuario}</span>
      <AyudasDeAjuste {...ayudas} />
    </div>
  );
}

const desplazado = (ov: Overrides | undefined): CSSProperties | undefined =>
  ov?.offsetY ? { transform: `translateY(${ov.offsetY}px)` } : undefined;

export function Slide({ slides, indice, marca, ayudas, id, paleta, colores }: PropsSlide) {
  const slide: TSlide = slides[indice];
  const numero = numeroDeSlide(slides, indice);
  const ov = 'overrides' in slide ? slide.overrides : undefined;
  const { area, escala } = useCabe([slide]);
  const comun = { marca, paleta, colores, id, ayudas };

  if (slide.tipo === 'portada') {
    return (
      <Marco {...comun} numero={null} clase="portada">
        {slide.foto ? <div className="plana__foto" style={{ backgroundImage: `url(${slide.foto})` }} /> : null}
        <div className="plana__area plana__area--portada" ref={area} style={{ ...desplazado(ov), '--escala': escala } as CSSProperties}>
          <h1 className="plana__titulo" style={ov?.tituloPx ? { fontSize: ov.tituloPx } : undefined}>
            {titulo(slide.titulo)}
          </h1>
          {slide.pregunta ? <p className="plana__pregunta">{slide.pregunta}</p> : null}
        </div>
      </Marco>
    );
  }

  if (slide.tipo === 'cierre') {
    const conMarca = (t: string) => t.replaceAll('{ciudad}', marca.ciudad).replaceAll('{plataforma}', marca.plataforma);
    return (
      <Marco {...comun} numero={numero} clase="cierre">
        <div className="plana__area plana__area--cierre" ref={area}>
          {slide.frase ? <h2 className="plana__titulo">{titulo(slide.frase)}</h2> : null}
          <p className="plana__lugar">{conNegritas(conMarca(marca.cierre.lugar))}</p>
          <p className="plana__invitacion">{conNegritas(conMarca(marca.cierre.invitacion))}</p>
          {marca.plataformaLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="plana__plataforma" src={marca.plataformaLogo} alt={marca.plataforma} />
          ) : (
            <p className="plana__plataforma plana__plataforma--texto">{marca.plataforma}</p>
          )}
        </div>
      </Marco>
    );
  }

  const visual = slide.tipo === 'contenido' ? slide.visual : undefined;
  return (
    <Marco {...comun} numero={numero} clase={slide.tipo}>
      <div className="plana__area" ref={area} style={{ ...desplazado(ov), '--escala': escala } as CSSProperties}>
        <h2 className="plana__titulo" style={ov?.tituloPx ? { fontSize: ov.tituloPx } : undefined}>
          {titulo(slide.titulo)}
        </h2>

        {slide.tipo === 'contenido' && slide.bajada ? <p className="plana__bajada">{conNegritas(slide.bajada)}</p> : null}

        {slide.tipo === 'contenido' && slide.cuerpo ? (
          <p className="plana__cuerpo" style={ov?.cuerpoPx ? { fontSize: ov.cuerpoPx } : undefined}>
            {conNegritas(slide.cuerpo)}
          </p>
        ) : null}

        {slide.tipo === 'lista' ? (
          <ul className="plana__puntos" style={ov?.cuerpoPx ? { fontSize: ov.cuerpoPx } : undefined}>
            {slide.puntos.map((p, i) => (
              <li key={i}>→ {conNegritas(p)}</li>
            ))}
          </ul>
        ) : null}

        {visual?.clase === 'icono' && visual.slug ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="plana__icono"
            src={`/iconos/${visual.slug}.png`}
            alt=""
            style={{ width: visual.tam ?? ov?.mediaAncho ?? undefined }}
          />
        ) : null}

        {visual?.clase === 'foto' ? (
          <div
            className="plana__media"
            style={{
              backgroundImage: `url(${visual.src})`,
              width: ov?.mediaAncho ?? undefined,
              height: visual.alto ?? ov?.mediaAlto ?? undefined,
            }}
          />
        ) : null}
      </div>
      {'fuente' in slide && slide.fuente ? <span className="plana__fuente">{slide.fuente}</span> : null}
    </Marco>
  );
}
