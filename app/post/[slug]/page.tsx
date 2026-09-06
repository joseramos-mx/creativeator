import { notFound } from 'next/navigation';
import { Editor } from '@/app/_componentes/Editor';
import { capturas } from '@/app/plantilla/datos';
import { listarSlugs, leerPost, leerMarca } from '@/lib/posts';

/**
 * /post/[slug] — el editor.
 *
 * El servidor lee el post una vez y de ahí en adelante manda el editor, que
 * guarda solo contra /api/post. Sin botón de guardar y sin recargar.
 */
export const dynamic = 'force-dynamic';

export default async function Carrusel({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const slugs = await listarSlugs();
  if (!slugs.includes(slug)) notFound();

  const [post, marca] = await Promise.all([leerPost(slug), leerMarca()]);

  // El overlay de referencia solo tiene sentido donde hay capturas publicadas.
  const referencia = slug === 'impetigo-regreso-a-clases' ? capturas : undefined;

  return <Editor inicial={post} marca={marca} capturas={referencia} />;
}
