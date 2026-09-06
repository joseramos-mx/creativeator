import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Visor } from '@/app/_componentes/Visor';
import { BotonExportar } from '@/app/_componentes/BotonExportar';
import { listarSlugs, leerPost, marcaDePost } from '@/lib/posts';

/**
 * /post/[slug] — el carrusel completo.
 *
 * En la fase 4 esta página se convierte en el editor de dos columnas. Por ahora
 * pinta el carrusel y deja exportarlo, que es lo que la fase 3 vino a resolver.
 */
export const dynamic = 'force-dynamic';

export default async function Carrusel({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const slugs = await listarSlugs();
  if (!slugs.includes(slug)) notFound();

  const post = await leerPost(slug);
  const marca = await marcaDePost(slug);

  return (
    <Visor
      titulo={post.tema}
      subtitulo={`${post.slides.length} slides · ${post.estado} · ${post.creado}`}
      acciones={
        <>
          <Link className="boton" href="/">
            ← carruseles
          </Link>
          <BotonExportar slug={slug} slides={post.slides.length} />
        </>
      }
      mazos={[{ titulo: 'Slides', post, marca }]}
    />
  );
}
