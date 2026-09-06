'use client';

import { Slide } from '@/template/Slide';
import { lienzo } from '@/template/tokens';
import type { Marca, Post } from '@/template/tipos';

/** La portada del carrusel, chiquita, para la lista. Es el slide de verdad. */
export function Miniatura({ post, marca, ancho = 132 }: { post: Post; marca: Marca; ancho?: number }) {
  const zoom = ancho / lienzo.ancho;
  return (
    <div
      className="miniatura"
      style={{ width: ancho, height: Math.round(lienzo.alto * zoom) }}
      aria-hidden
    >
      <div style={{ transform: `scale(${zoom})`, width: lienzo.ancho }}>
        <Slide slides={post.slides} indice={0} marca={marca} paleta={post.paleta} />
      </div>
    </div>
  );
}
