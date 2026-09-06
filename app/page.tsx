import Link from 'next/link';
import { Miniatura } from '@/app/_componentes/Miniatura';
import { Redactar } from '@/app/_componentes/Redactar';
import { leerMarca, listarPosts } from '@/lib/posts';

/**
 * La lista de carruseles. Un post es un JSON en content/posts/: para agregar
 * uno a mano basta con copiar otro y cambiarle el slug y los textos.
 *
 * Redactar uno con la IA también empieza aquí, y termina en el editor: lo que
 * escribe el modelo entra como borrador y no hay camino de ahí a un PNG que no
 * pase por una persona.
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

        {posts.length === 0 ? (
          <p>
            Todavía no hay carruseles. Un post es un archivo JSON en{' '}
            <code>content/posts/</code>.
          </p>
        ) : (
          <ul className="lista-posts">
            {posts.map((post) => (
              <li key={post.slug} data-laboratorio={post.slug.startsWith('laboratorio-') ? '' : undefined}>
                <Link href={`/post/${post.slug}`}>
                  <Miniatura post={post} marca={marca} />
                  <div>
                    <strong>
                      {post.tema}
                      {post.slug.startsWith('laboratorio-') ? (
                        <em className="chip-lab">laboratorio</em>
                      ) : null}
                    </strong>
                    <span>
                      <em data-estado={post.estado}>{post.estado}</em> · {post.slides.length} slides ·{' '}
                      {post.creado}
                    </span>
                    <span>{post.copy ? 'con copy' : 'sin copy'}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
