'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AccionesPost } from '@/app/_componentes/AccionesPost';
import { Miniatura } from '@/app/_componentes/Miniatura';
import type { Post, Proyecto } from '@/plantillas/clinica/tipos';
import { useProyecto } from './proyecto';

/**
 * La lista de carruseles, con qué enseñar y en qué orden.
 *
 * Con seis posts la lista se leía entera de un vistazo y no hacía falta nada.
 * Con un calendario de doce al mes deja de leerse: lo que se busca casi siempre
 * es "qué me falta por revisar", y eso estaba mezclado con lo ya publicado y
 * con los carruseles de laboratorio.
 *
 * Tres decisiones que valen la pena:
 *
 * · **El estado va primero**, antes que el orden. Es el filtro que contesta la
 *   pregunta de todos los días —qué queda en borrador— y las cuentas están a la
 *   vista para no tener que filtrar solo para contar.
 * · **El laboratorio se esconde por defecto.** Son andamio de las pruebas, no
 *   contenido de la cuenta, y ocupaban dos de los ocho sitios de la lista.
 * · **La elección se recuerda.** Es una preferencia de trabajo, no una
 *   pregunta: quien filtra por borrador está revisando, y va a seguir estándolo
 *   después de recargar.
 */

type Orden = 'recientes' | 'antiguos' | 'tema';
type Estado = 'todos' | 'borrador' | 'aprobado' | 'publicado';

const ORDENES: { valor: Orden; texto: string }[] = [
  { valor: 'recientes', texto: 'más recientes' },
  { valor: 'antiguos', texto: 'más antiguos' },
  { valor: 'tema', texto: 'por tema' },
];

const LLAVE = 'lista-posts';

export function ListaPosts({ posts, marca }: { posts: Post[]; marca: Proyecto }) {
  const proyecto = useProyecto();
  const [orden, setOrden] = useState<Orden>('recientes');
  const [estado, setEstado] = useState<Estado>('todos');
  const [busca, setBusca] = useState('');
  const [laboratorio, setLaboratorio] = useState(false);
  const [cargado, setCargado] = useState(false);

  /*
   * Se lee en un efecto y no en el `useState` inicial: el servidor pinta esto
   * primero y no tiene localStorage, así que leerlo al construir daría una
   * marca distinta en el servidor y en el navegador. El `cargado` evita el
   * parpadeo de un filtro que cambia solo al hidratar.
   */
  useEffect(() => {
    try {
      const guardado = JSON.parse(localStorage.getItem(LLAVE) ?? '{}');
      if (guardado.orden) setOrden(guardado.orden);
      if (guardado.estado) setEstado(guardado.estado);
      if (typeof guardado.laboratorio === 'boolean') setLaboratorio(guardado.laboratorio);
    } catch {
      // Ventana privada o almacenamiento bloqueado: se queda con los valores
      // de arriba, que son los que tenía la lista antes de todo esto.
    }
    setCargado(true);
  }, []);

  useEffect(() => {
    if (!cargado) return;
    try {
      localStorage.setItem(LLAVE, JSON.stringify({ orden, estado, laboratorio }));
    } catch {
      // Que no se pueda recordar la preferencia no es motivo para romper la lista.
    }
  }, [orden, estado, laboratorio, cargado]);

  const esLab = (p: Post) => p.slug.startsWith('laboratorio-');

  // Las cuentas se hacen sobre los de la cuenta, no sobre los de laboratorio:
  // "7 borradores" tiene que querer decir siete carruseles que revisar.
  const cuentas = useMemo(() => {
    const c: Record<Estado, number> = { todos: 0, borrador: 0, aprobado: 0, publicado: 0 };
    for (const p of posts) {
      if (esLab(p)) continue;
      c.todos++;
      c[p.estado as Exclude<Estado, 'todos'>]++;
    }
    return c;
  }, [posts]);

  const visibles = useMemo(() => {
    const termino = busca
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    const sinAcentos = (s: string) =>
      s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    return posts
      .filter((p) => (laboratorio ? true : !esLab(p)))
      .filter((p) => estado === 'todos' || p.estado === estado)
      .filter((p) => !termino || sinAcentos(p.tema).includes(termino))
      .sort((a, b) => {
        if (orden === 'tema') return a.tema.localeCompare(b.tema, 'es');
        // `creado` es ISO, así que comparar el texto ordena por fecha.
        return orden === 'recientes'
          ? b.creado.localeCompare(a.creado)
          : a.creado.localeCompare(b.creado);
      });
  }, [posts, orden, estado, busca, laboratorio]);

  if (posts.length === 0) {
    return (
      <p>
        Todavía no hay carruseles. Un post es un archivo JSON en <code>proyectos/{proyecto}/posts/</code>.
      </p>
    );
  }

  return (
    <>
      <div className="filtros">
        <div className="filtros__estados" role="group" aria-label="Filtrar por estado">
          {(['todos', 'borrador', 'aprobado', 'publicado'] as Estado[]).map((e) => (
            <button
              key={e}
              type="button"
              className="boton sm"
              aria-pressed={estado === e}
              onClick={() => setEstado(e)}
            >
              {e} <b>{cuentas[e]}</b>
            </button>
          ))}
        </div>

        <span className="sep" />

        <input
          className="filtros__busca"
          type="search"
          value={busca}
          placeholder="buscar por tema…"
          onChange={(e) => setBusca(e.target.value)}
        />

        <select
          className="filtros__orden"
          value={orden}
          onChange={(e) => setOrden(e.target.value as Orden)}
          aria-label="Orden"
        >
          {ORDENES.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.texto}
            </option>
          ))}
        </select>

        <label className="filtros__lab">
          <input
            type="checkbox"
            checked={laboratorio}
            onChange={(e) => setLaboratorio(e.target.checked)}
          />
          laboratorio
        </label>
      </div>

      {visibles.length === 0 ? (
        <p className="pista">
          Nada con ese filtro.{' '}
          {busca ? (
            <>
              Ningún tema dice «{busca}»
              {estado !== 'todos' ? ` entre los ${estado}` : ''}.
            </>
          ) : (
            `No hay carruseles en ${estado}.`
          )}
        </p>
      ) : (
        <ul className="lista-posts">
          {visibles.map((post) => (
            <li key={post.slug} data-laboratorio={esLab(post) ? '' : undefined}>
              {/* El `title` porque el tema se recorta a tres líneas: en una
                  rejilla de cinco columnas no cabe entero y perderlo del todo
                  sería peor que tener que pasar el ratón por encima. */}
              <Link href={`/${proyecto}/post/${post.slug}`} title={post.tema}>
                <Miniatura post={post} marca={marca} ancho={84} />
                <div className="lista-posts__texto">
                  <strong>
                    {post.tema}
                    {esLab(post) ? <em className="chip-lab">laboratorio</em> : null}
                  </strong>
                  <span>
                    <em data-estado={post.estado}>{post.estado}</em> · {post.creado}
                  </span>
                  <span>
                    {post.slides.length} slides · {post.copy ? 'con copy' : 'sin copy'}
                  </span>
                </div>
              </Link>

              {/* Fuera del <Link>: un <button> dentro de un <a> es HTML inválido
                  y el clic navegaría en vez de actuar. Van encima, en la esquina. */}
              <AccionesPost post={post} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
