'use client';

import { useCallback, useEffect, useState } from 'react';
import marcaJson from '@/content/marca.json';
import { Slide } from '@/template/Slide';
import { papelDePost } from '@/template/papel';
import { lienzo } from '@/template/tokens';
import type { Marca, Post } from '@/template/tipos';
import { capturas, limites, publicado } from './datos';

/**
 * /plantilla — el banco de pruebas.
 *
 * Aquí se prueba un cambio de plantilla sin tocar contenido real: los dos mazos
 * son datos quemados. El de arriba reproduce un carrusel ya publicado, así que
 * con la tecla R se le encima la captura y las diferencias saltan solas; el de
 * abajo son los casos que rompen cosas.
 */
export default function Plantilla() {
  const [rejilla, setRejilla] = useState(false);
  const [overlay, setOverlay] = useState(false);
  const [opacidad, setOpacidad] = useState(1);
  const [zoom, setZoom] = useState(0.34);

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'g') setRejilla((v) => !v);
      if (k === 'r') setOverlay((v) => !v);
      if (k === '[') setOpacidad((v) => Math.max(0.1, +(v - 0.1).toFixed(2)));
      if (k === ']') setOpacidad((v) => Math.min(1, +(v + 0.1).toFixed(2)));
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, []);

  const marcaDe = useCallback(
    (post: Post): Marca => ({ ...(marcaJson as Marca), papel: papelDePost(post.slug) }),
    [],
  );

  return (
    <>
      <header className="cromo">
        <h1>Plantilla · {marcaJson.usuario}</h1>
        <p>Banco de pruebas. Ningún dato de aquí es contenido real.</p>
        <span className="sep" />

        <button className="boton" aria-pressed={rejilla} onClick={() => setRejilla((v) => !v)}>
          <kbd className="tecla">G</kbd> rejilla
        </button>
        <button className="boton" aria-pressed={overlay} onClick={() => setOverlay((v) => !v)}>
          <kbd className="tecla">R</kbd> referencia
        </button>
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
        <h2>Carrusel publicado</h2>
        <p>
          Los mismos textos y el mismo orden que las capturas de{' '}
          <code>public/referencia/</code>. Con la referencia encendida, lo que coincide se apaga y
          lo que baila queda brillante: es la forma más rápida de cazar una diferencia de tracking
          o de interlineado.
        </p>
        <Mazo
          post={publicado}
          marca={marcaDe(publicado)}
          zoom={zoom}
          rejilla={rejilla}
          capturas={overlay ? capturas : undefined}
          opacidad={opacidad}
        />

        <h2>Casos límite</h2>
        <p>
          Título de tres renglones, cuerpo que no cabe, lista de cinco puntos y slide sin elemento
          visual. Aquí se ve trabajar al ajuste automático.
        </p>
        <Mazo post={limites} marca={marcaDe(limites)} zoom={zoom} rejilla={rejilla} />
      </main>
    </>
  );
}

function Mazo({
  post,
  marca,
  zoom,
  rejilla,
  capturas,
  opacidad,
}: {
  post: Post;
  marca: Marca;
  zoom: number;
  rejilla: boolean;
  capturas?: string[];
  opacidad?: number;
}) {
  return (
    <div className="mazo">
      {post.slides.map((slide, i) => (
        <div
          className="marco"
          key={i}
          style={{ width: lienzo.ancho * zoom, height: lienzo.alto * zoom }}
        >
          <span className="etiqueta">
            {i === 0 ? 'portada' : i === post.slides.length - 1 ? 'cierre' : String(i).padStart(2, '0')} ·{' '}
            {slide.tipo}
          </span>
          <div style={{ transform: `scale(${zoom})`, width: lienzo.ancho }}>
            <Slide
              slides={post.slides}
              indice={i}
              marca={marca}
              ayudas={{
                rejilla,
                overlay: capturas?.[i],
                overlayOpacidad: opacidad,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
