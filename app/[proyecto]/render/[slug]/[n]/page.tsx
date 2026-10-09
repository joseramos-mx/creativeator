import { notFound } from 'next/navigation';
import { hayProyecto, leerPost, leerProyecto, listarSlugs } from '@/lib/posts';
import { plantillaDe } from '@/plantillas';
import { Listo } from './Listo';
import './render.css';

/**
 * /<proyecto>/render/[slug]/[n] — un solo slide, desnudo.
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
  params: Promise<{ proyecto: string; slug: string; n: string }>;
}) {
  const { proyecto, slug, n } = await params;
  if (!(await hayProyecto(proyecto))) notFound();
  const slugs = await listarSlugs(proyecto);
  if (!slugs.includes(slug)) notFound();

  const post = await leerPost(proyecto, slug);
  const indice = Number(n) - 1;
  if (!Number.isInteger(indice) || indice < 0 || indice >= post.slides.length) notFound();

  const marca = await leerProyecto(proyecto);
  const { Slide } = plantillaDe(marca.plantilla);

  return (
    <>
      <Slide slides={post.slides} indice={indice} marca={marca} paleta={post.paleta} colores={post.colores} id="slide" />
      <Listo />
    </>
  );
}
