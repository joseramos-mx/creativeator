import Link from 'next/link';
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
 * Siempre se enseña, aunque haya uno solo: es la entrada desde el teléfono, y
 * desde aquí se va a los carruseles, a la identidad o a los archivos de cada
 * cuenta.
 */
export const dynamic = 'force-dynamic';

export default async function Proyectos() {
  const proyectos = await listarProyectosConMarca();

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
        <p>{proyectos.length === 1 ? '1 proyecto' : `${proyectos.length} proyectos`}</p>
        <span className="sep" />
        <Link className="boton" href="/nuevo">
          Nuevo proyecto
        </Link>
      </header>

      <main className="banco">
        {proyectos.length === 0 ? (
          <p className="proyectos__vacio">
            Todavía no hay ningún proyecto. <Link href="/nuevo">Da de alta el primero</Link>.
          </p>
        ) : (
          <ul className="proyectos">
            {conPortada.map(({ id, proyecto, cuantos, portada }) => (
              <li key={id} data-proyecto={id}>
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
                <nav className="proyectos__accesos">
                  <Link href={`/${id}`}>Carruseles</Link>
                  <Link href={`/${id}/identidad`}>Identidad</Link>
                  <Link href={`/${id}/archivos`}>Archivos</Link>
                  <Link href={`/${id}/descargas`}>Descargas</Link>
                </nav>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
