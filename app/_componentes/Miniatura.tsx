'use client';

import { plantillaDe } from '@/plantillas';
import { lienzo } from '@/plantillas/clinica/tokens';
import type { Post, Proyecto } from '@/plantillas/clinica/tipos';

/** La portada del carrusel, chiquita, para la lista. Es el slide de verdad. */
export function Miniatura({ post, marca, ancho = 132 }: { post: Post; marca: Proyecto; ancho?: number }) {
  const zoom = ancho / lienzo.ancho;
  const { Slide } = plantillaDe(marca.plantilla);
  return (
    <div
      className="miniatura"
      style={{ width: ancho, height: Math.round(lienzo.alto * zoom) }}
      aria-hidden
    >
      <div style={{ transform: `scale(${zoom})`, width: lienzo.ancho }}>
        <Slide slides={post.slides} indice={0} marca={marca} paleta={post.paleta} colores={post.colores} />
      </div>
    </div>
  );
}
