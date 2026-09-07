import Link from 'next/link';
import { Calendario } from '@/app/_componentes/Calendario';
import { ListaPosts } from '@/app/_componentes/ListaPosts';
import { Redactar } from '@/app/_componentes/Redactar';
import { leerMarca, listarPosts } from '@/lib/posts';

/**
 * La lista de carruseles. Un post es un JSON en content/posts/: para agregar
 * uno a mano basta con copiar otro y cambiarle el slug y los textos.
 *
 * Redactar uno con la IA también empieza aquí, y termina en el editor: lo que
 * escribe el modelo entra como borrador y no hay camino de ahí a un PNG que no
 * pase por una persona. Lo mismo vale para los doce de un calendario: la tanda
 * es más rápida de escribir, no de revisar.
 */
export const dynamic = 'force-dynamic';

export default async function Inicio() {
  const marca = await leerMarca();
  const posts = await listarPosts();

  return (
    <>
      <header className="cromo">
        <h1>Carruseles · {marca.usuario}</h1>
        <p>{posts.length === 1 ? '1 carrusel' : `${posts.length} carruseles`} en content/posts/</p>
        <span className="sep" />
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
