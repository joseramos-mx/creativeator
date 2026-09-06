import { notFound } from 'next/navigation';
import { leerPost, listarSlugs, leerMarca } from '@/lib/posts';
import { Slide } from '@/template/Slide';
import { Listo } from './Listo';
import './render.css';

/**
 * /render/[slug]/[n] — un solo slide, desnudo.
 *
 * Sin cromo de aplicación, sin scroll, al tamaño exacto del lienzo. Esta ruta
 * existe para una sola cosa: que Playwright la capture. El navegador de verdad
 * pinta el mismo DOM y el mismo CSS que la vista previa, así que lo que ves es
 * lo que sale; si el PNG no se pareciera a la vista previa, es un error, no una
 * diferencia esperada.
 *
 * `n` es la posición del slide en el carrusel, empezando en 1: 1 es la portada.
 * No es el número que se pinta en la esquina, que se salta la portada.
 */
export const dynamic = 'force-dynamic';

export default async function Render({
  params,
}: {
  params: Promise<{ slug: string; n: string }>;
}) {
  const { slug, n } = await params;
  const slugs = await listarSlugs();
  if (!slugs.includes(slug)) notFound();

  const post = await leerPost(slug);
  const indice = Number(n) - 1;
  if (!Number.isInteger(indice) || indice < 0 || indice >= post.slides.length) notFound();

  const marca = await leerMarca();

  return (
    <>
      <Slide slides={post.slides} indice={indice} marca={marca} paleta={post.paleta} id="slide" />
      <Listo />
    </>
  );
}
