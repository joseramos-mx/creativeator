'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Slide } from '@/template/Slide';
import { lienzo, type NombrePaleta } from '@/template/tokens';
import type { Marca, Post } from '@/template/tipos';

export type MazoVisible = {
  /** Identificador estable para los scripts de comparación. */
  id?: string;
  titulo: string;
  nota?: ReactNode;
  post: Post;
  marca: Marca;
  /** Pisa la paleta del post. Es lo que permite ver el mismo carrusel en todas. */
  paleta?: NombrePaleta;
  /** Capturas publicadas, una por slide, para el overlay de la tecla R. */
  capturas?: string[];
};

/**
 * El visor de carruseles: la barra de controles y uno o más mazos de slides.
 *
 * Lo usan el banco de pruebas y la página de un post, para que las dos vean
 * exactamente el mismo render. Si la vista previa de un post no se pareciera a
 * la del banco, el banco no serviría de nada.
 */
export function Visor({
  mazos,
  titulo,
  subtitulo,
  acciones,
}: {
  mazos: MazoVisible[];
  titulo: string;
  subtitulo?: string;
  acciones?: ReactNode;
}) {
  const [rejilla, setRejilla] = useState(false);
  const [overlay, setOverlay] = useState(false);
  const [opacidad, setOpacidad] = useState(1);
  const [zoom, setZoom] = useState(0.34);
  const hayCapturas = mazos.some((m) => m.capturas?.length);

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const objetivo = e.target as HTMLElement | null;
      if (objetivo && /^(INPUT|TEXTAREA)$/.test(objetivo.tagName)) return;
      const k = e.key.toLowerCase();
      if (k === 'g') setRejilla((v) => !v);
      if (k === 'r' && hayCapturas) setOverlay((v) => !v);
      if (k === '[') setOpacidad((v) => Math.max(0.1, +(v - 0.1).toFixed(2)));
      if (k === ']') setOpacidad((v) => Math.min(1, +(v + 0.1).toFixed(2)));
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [hayCapturas]);

  return (
    <>
      <header className="cromo">
        <h1>{titulo}</h1>
        {subtitulo ? <p>{subtitulo}</p> : null}
        <span className="sep" />
        {acciones}

        <button className="boton" aria-pressed={rejilla} onClick={() => setRejilla((v) => !v)}>
          <kbd className="tecla">G</kbd> rejilla
        </button>
        {hayCapturas ? (
          <button className="boton" aria-pressed={overlay} onClick={() => setOverlay((v) => !v)}>
            <kbd className="tecla">R</kbd> referencia
          </button>
        ) : null}
        {overlay ? (
          <p>
            <kbd className="tecla">[</kbd>
            <kbd className="tecla">]</kbd> opacidad {Math.round(opacidad * 100)}%
          </p>
        ) : null}

        {[0.34, 0.5, 1].map((z) => (
          <button key={z} className="boton" aria-pressed={zoom === z} onClick={() => setZoom(z)}>
            {Math.round(z * 100)}%
          </button>
        ))}
      </header>

      <main className="banco">
        {mazos.map((mazo) => (
          <section key={mazo.titulo}>
            <h2>{mazo.titulo}</h2>
            {mazo.nota ? <p>{mazo.nota}</p> : null}
            <Mazo
              id={mazo.id ?? mazo.titulo}
              post={mazo.post}
              marca={mazo.marca}
              paleta={mazo.paleta ?? mazo.post.paleta}
              zoom={zoom}
              rejilla={rejilla}
              capturas={overlay ? mazo.capturas : undefined}
              opacidad={opacidad}
            />
          </section>
        ))}
      </main>
    </>
  );
}

function Mazo({
  id,
  post,
  marca,
  paleta,
  zoom,
  rejilla,
  capturas,
  opacidad,
}: {
  id: string;
  post: Post;
  marca: Marca;
  paleta: NombrePaleta;
  zoom: number;
  rejilla: boolean;
  capturas?: string[];
  opacidad?: number;
}) {
  return (
    <div className="mazo" data-mazo={id}>
      {post.slides.map((slide, i) => (
        <div
          className="marco"
          key={i}
          style={{ width: lienzo.ancho * zoom, height: lienzo.alto * zoom }}
        >
          <span className="etiqueta">
            {slide.tipo === 'portada' || slide.tipo === 'cierre'
              ? slide.tipo
              : String(i).padStart(2, '0')}{' '}
            · {slide.tipo}
          </span>
          {/* A 100 % no se aplica transform: una capa de composición puede cambiar
              el antialias del texto, y la exportación se verifica píxel a píxel
              contra esta misma vista. */}
          <div style={zoom === 1 ? undefined : { transform: `scale(${zoom})`, width: lienzo.ancho }}>
            <Slide
              slides={post.slides}
              indice={i}
              marca={marca}
              paleta={paleta}
              ayudas={{ rejilla, overlay: capturas?.[i], overlayOpacidad: opacidad }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
