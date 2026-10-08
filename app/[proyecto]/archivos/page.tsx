import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EditorDeTexto } from '@/app/_componentes/EditorDeTexto';
import { almacen, remoto, urlServida } from '@/lib/almacen';
import { absoluta, claseDe, editable, raicesDe, rutaDeCuenta } from '@/lib/archivos';
import { hayProyecto, leerProyecto } from '@/lib/posts';
import { soloLectura } from '@/lib/soloLectura';

/**
 * /<proyecto>/archivos — las carpetas de una cuenta, para navegarlas.
 *
 * Lo que hay en el repositorio, tal cual: la configuración, la identidad, los
 * prompts, los posts, los materiales, las fotos y las descargas. Se ven las
 * imágenes, se leen los textos y los JSON, y los textos (.md, .tsv) se pueden
 * corregir aquí mismo, que desde el teléfono es la única forma de tocar un
 * prompt sin abrir la computadora.
 */
export const dynamic = 'force-dynamic';

const peso = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export default async function Archivos({
  params,
  searchParams,
}: {
  params: Promise<{ proyecto: string }>;
  searchParams: Promise<{ en?: string }>;
}) {
  const { proyecto } = await params;
  if (!(await hayProyecto(proyecto))) notFound();
  const { en } = await searchParams;
  const marca = await leerProyecto(proyecto);

  const ruta = en ? rutaDeCuenta(proyecto, en) : null;
  if (en && !ruta) notFound();

  const enlace = (r: string) => `/${proyecto}/archivos?en=${encodeURIComponent(r)}`;
  const migas = ruta
    ? ruta.split('/').map((parte, i, todas) => ({ parte, ruta: todas.slice(0, i + 1).join('/') }))
    : [];

  let cuerpo: React.ReactNode;

  if (!ruta) {
    const [privada, publica] = raicesDe(proyecto);
    cuerpo = (
      <ul className="archivos">
        <li>
          <Link href={enlace(privada)}>
            <strong>{privada}/</strong>
            <span className="pista">Lo que se edita: configuración, identidad, voz, prompts, calendario, posts, materiales.</span>
          </Link>
        </li>
        <li>
          <Link href={enlace(publica)}>
            <strong>{publica}/</strong>
            <span className="pista">Lo que se sirve: logos, fotos de cada carrusel y los PNG para el teléfono.</span>
          </Link>
        </li>
      </ul>
    );
  } else {
    const entradas = await almacen.listar(absoluta(ruta));
    if (entradas.length) {
      const orden = [...entradas].sort((a, b) =>
        a.tipo === b.tipo ? a.nombre.localeCompare(b.nombre) : a.tipo === 'carpeta' ? -1 : 1,
      );
      cuerpo = (
        <ul className="archivos">
          {orden
            .filter((e) => e.nombre !== '.gitkeep')
            .map((e) => (
              <li key={e.nombre}>
                <Link href={enlace(`${ruta}/${e.nombre}`)}>
                  <strong>
                    {e.nombre}
                    {e.tipo === 'carpeta' ? '/' : ''}
                  </strong>
                  {e.tipo === 'archivo' ? <span className="pista">{peso(e.bytes)}</span> : null}
                </Link>
              </li>
            ))}
        </ul>
      );
    } else {
      const datos = await almacen.leer(absoluta(ruta));
      if (!datos) notFound();
      const nombre = ruta.split('/').pop() ?? ruta;
      const clase = claseDe(nombre);
      const publica = ruta.startsWith('public/') ? `/${ruta.slice('public/'.length)}` : null;
      const cruda = `/api/${proyecto}/archivos?ruta=${encodeURIComponent(ruta)}`;
      const post = ruta.match(new RegExp(`^proyectos/${proyecto}/posts/([a-z0-9-]+)\\.json$`));

      cuerpo = (
        <div className="archivo">
          <p className="pista">
            {peso(datos.length)} ·{' '}
            <a href={cruda} target="_blank" rel="noreferrer">
              abrir o bajar
            </a>
            {post ? (
              <>
                {' · '}
                <Link href={`/${proyecto}/post/${post[1]}`}>abrir en el editor</Link>
              </>
            ) : null}
          </p>
          {clase === 'imagen' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="archivo__imagen" src={publica ? urlServida(publica) : cruda} alt={nombre} />
          ) : clase === 'pdf' ? (
            <p>
              <a className="boton" href={cruda} target="_blank" rel="noreferrer">
                Abrir el PDF
              </a>
            </p>
          ) : clase === 'texto' && editable(nombre) && !soloLectura ? (
            <EditorDeTexto ruta={ruta} inicial={datos.toString('utf8')} />
          ) : clase === 'texto' || clase === 'json' ? (
            <pre className="archivo__texto">
              {clase === 'json' ? JSON.stringify(JSON.parse(datos.toString('utf8')), null, 2) : datos.toString('utf8')}
            </pre>
          ) : (
            <p className="pista">Este tipo de archivo no se puede ver aquí.</p>
          )}
        </div>
      );
    }
  }

  return (
    <>
      <header className="cromo">
        <h1>Archivos · {marca.usuario}</h1>
        <p>{remoto ? 'desde el repositorio' : 'desde la carpeta del proyecto'}</p>
        <span className="sep" />
        <Link className="boton" href={`/${proyecto}`}>
          Carruseles →
        </Link>
      </header>
      <main className="banco">
        <nav className="migas">
          <Link href={`/${proyecto}/archivos`}>{proyecto}</Link>
          {migas.map((m) => (
            <span key={m.ruta}>
              {' / '}
              {rutaDeCuenta(proyecto, m.ruta) ? <Link href={enlace(m.ruta)}>{m.parte}</Link> : m.parte}
            </span>
          ))}
        </nav>
        {cuerpo}
      </main>
    </>
  );
}
