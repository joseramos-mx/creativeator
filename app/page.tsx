import Link from 'next/link';
import { Miniatura } from '@/app/_componentes/Miniatura';
import { leerMarca, listarPosts, marcaDePost } from '@/lib/posts';

/**
 * La lista de carruseles. Un post es un JSON en content/posts/: para agregar
 * uno a mano basta con copiar otro y cambiarle el slug y los textos.
 *
 * En la fase 6 aquí van también los botones de redactar uno y de generar el mes.
 */
export const dynamic = 'force-dynamic';

export default async function Inicio() {
  const marca = await leerMarca();
  const posts = await listarPosts();
  const marcas = await Promise.all(posts.map((p) => marcaDePost(p.slug)));

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
        {posts.length === 0 ? (
          <p>
            Todavía no hay carruseles. Un post es un archivo JSON en{' '}
            <code>content/posts/</code>.
          </p>
        ) : (
          <ul className="lista-posts">
            {posts.map((post, i) => (
              <li key={post.slug}>
                <Link href={`/post/${post.slug}`}>
                  <Miniatura post={post} marca={marcas[i]} />
                  <div>
                    <strong>{post.tema}</strong>
                    <span>
                      <em data-estado={post.estado}>{post.estado}</em> · {post.slides.length} slides ·{' '}
                      {post.creado}
                    </span>
                    <span>{post.pieDeFoto ? 'con pie de foto' : 'sin pie de foto'}</span>
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
