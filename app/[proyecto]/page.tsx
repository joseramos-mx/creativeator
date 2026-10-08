import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Calendario } from '@/app/_componentes/Calendario';
import { ListaPosts } from '@/app/_componentes/ListaPosts';
import { Redactar } from '@/app/_componentes/Redactar';
import { existeProyecto, leerProyecto, listarPosts } from '@/lib/posts';
import { listarProyectos } from '@/lib/proyecto';

/**
 * /<proyecto> — la lista de carruseles de una cuenta. Un post es un JSON en
 * proyectos/<id>/posts/: para agregar uno a mano basta con copiar otro y
 * cambiarle el slug y los textos.
 *
 * Redactar uno con la IA también empieza aquí, y termina en el editor: lo que
 * escribe el modelo entra como borrador y no hay camino de ahí a un PNG que no
 * pase por una persona. Lo mismo vale para los doce de un calendario: la tanda
 * es más rápida de escribir, no de revisar.
 */
export const dynamic = 'force-dynamic';

export default async function Inicio({ params }: { params: Promise<{ proyecto: string }> }) {
  const { proyecto } = await params;
  if (!existeProyecto(proyecto)) notFound();

  const marca = await leerProyecto(proyecto);
  const posts = await listarPosts(proyecto);
  const hayOtros = listarProyectos().length > 1;

  return (
    <>
      <header className="cromo">
        <h1>Carruseles · {marca.usuario}</h1>
        <p>
          {posts.length === 1 ? '1 carrusel' : `${posts.length} carruseles`} en proyectos/{proyecto}/posts/
        </p>
        <span className="sep" />
        {hayOtros ? (
          <Link className="boton" href="/">
            Cambiar de proyecto
          </Link>
        ) : null}
        <Link className="boton" href={`/${proyecto}/descargas`}>
          Descargas →
        </Link>
        <Link className="boton" href="/plantilla">
          Banco de pruebas →
        </Link>
      </header>

      <main className="banco">
        <Redactar />
        <Calendario />

        <ListaPosts posts={posts} marca={marca} />

      </main>
    </>
  );
}
