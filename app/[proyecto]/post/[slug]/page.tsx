import { notFound } from 'next/navigation';
import { Editor } from '@/app/_componentes/Editor';
import { capturas, REFERENCIA } from '@/app/plantilla/datos';
import { remoto } from '@/lib/almacen';
import { hayProyecto, leerPost, leerProyecto, listarSlugs } from '@/lib/posts';

/**
 * /<proyecto>/post/[slug] — el editor.
 *
 * El servidor lee el post una vez y de ahí en adelante manda el editor, que
 * guarda solo contra /api/<proyecto>/post. Sin botón de guardar y sin recargar.
 */
export const dynamic = 'force-dynamic';

export default async function Carrusel({
  params,
}: {
  params: Promise<{ proyecto: string; slug: string }>;
}) {
  const { proyecto, slug } = await params;
  if (!(await hayProyecto(proyecto))) notFound();
  const slugs = await listarSlugs(proyecto);
  if (!slugs.includes(slug)) notFound();

  const [post, marca] = await Promise.all([leerPost(proyecto, slug), leerProyecto(proyecto)]);

  // El overlay de referencia solo tiene sentido donde hay capturas publicadas.
  const referencia =
    proyecto === REFERENCIA.proyecto && slug === REFERENCIA.slug ? capturas : undefined;

  return <Editor inicial={post} marca={marca} capturas={referencia} remoto={remoto} />;
}
