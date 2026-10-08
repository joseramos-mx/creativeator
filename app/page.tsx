import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Miniatura } from '@/app/_componentes/Miniatura';
import { listarPosts, listarProyectosConMarca } from '@/lib/posts';

/**
 * / — elegir proyecto.
 *
 * Un proyecto es una cuenta: el Dr. Edwin, la Dra. Mildreth, Adimex. Cada uno
 * vive en su carpeta de proyectos/ y su URL empieza por su id, así que todo lo
 * que se abre desde aquí —la lista, el editor, las descargas— sabe de qué
 * cuenta es sin tener que recordarlo.
 *
 * Con uno solo esta pantalla no aporta nada y se salta.
 */
export const dynamic = 'force-dynamic';

export default async function Proyectos() {
  const proyectos = await listarProyectosConMarca();
  if (proyectos.length === 1) redirect(`/${proyectos[0].id}`);

  const conPortada = await Promise.all(
    proyectos.map(async (p) => {
      const posts = (await listarPosts(p.id)).filter((x) => !x.slug.startsWith('laboratorio-'));
      return { ...p, cuantos: posts.length, portada: posts[0] };
    }),
  );

  return (
    <>
      <header className="cromo">
        <h1>Carruseles</h1>
        <p>{proyectos.length} proyectos en proyectos/</p>
      </header>

      <main className="banco">
        {proyectos.length === 0 ? (
          <p className="proyectos__vacio">
            Todavía no hay ningún proyecto. Un proyecto es una carpeta en <code>proyectos/</code> con su{' '}
            <code>proyecto.json</code>; el README dice cómo dar de alta uno.
          </p>
        ) : (
          <ul className="proyectos">
            {conPortada.map(({ id, proyecto, cuantos, portada }) => (
              <li key={id}>
                <Link href={`/${id}`}>
                  {portada ? <Miniatura post={portada} marca={proyecto} ancho={120} /> : <span className="proyectos__hueco" />}
                  <span className="proyectos__texto">
                    <strong>{proyecto.nombre}</strong>
                    <span>{proyecto.usuario}</span>
                    <span>
                      {proyecto.especialidad} · {proyecto.ciudad}
                    </span>
                    <em>{cuantos === 1 ? '1 carrusel' : `${cuantos} carruseles`}</em>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
