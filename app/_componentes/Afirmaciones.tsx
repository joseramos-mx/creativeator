'use client';

import { useMemo, useState } from 'react';
import { afirmacionesDe, type Afirmacion } from '@/lib/afirmaciones';
import type { Post } from '@/template/tipos';

/**
 * La cola de revisión: las afirmaciones del carrusel, una por una.
 *
 * **No hay botón de aprobar todo, y no lo va a haber.** Revisar de una en una
 * es el mecanismo entero: lo que se quiere evitar es exactamente leer de
 * corrido una cifra que llega con una institución al lado.
 *
 * Y lo que se guarda no dice "verificada". Dice quién la miró y cuándo. El
 * sistema no comprueba nada: no abre StatPearls ni valida el enlace. Lo único
 * que garantiza es que nadie pueda declarar aprobado un carrusel sin haber
 * pasado por aquí, y que cambiar el texto devuelva la afirmación a la cola.
 */
export function Afirmaciones({
  post,
  revisor,
  setPost,
}: {
  post: Post;
  /** Quién firma la revisión: el nombre de content/marca.json. */
  revisor: string;
  setPost: (f: (p: Post) => Post) => void;
}) {
  const afirmaciones = useMemo(() => afirmacionesDe(post), [post]);
  const revisiones = post.revisiones ?? {};

  const pendientes = afirmaciones.filter((a) => {
    const r = revisiones[a.huella];
    return !r || (a.exigeEnlace && !r.enlace);
  });

  if (afirmaciones.length === 0) return null;

  return (
    <details className="tarjeta" data-cola open={pendientes.length > 0}>
      <summary>
        <span className="chip">revisar</span>
        <span className="tarjeta__titulo">
          {pendientes.length === 0
            ? `${afirmaciones.length} afirmaciones, todas revisadas`
            : `${pendientes.length} de ${afirmaciones.length} sin revisar`}
        </span>
        {pendientes.length > 0 ? <span className="punto" /> : null}
      </summary>

      <div className="tarjeta__cuerpo">
        <p className="pista">
          El sistema no comprueba nada: no abre la fuente ni valida el enlace. Solo impide que el
          carrusel se marque como aprobado sin que las hayas mirado, y las devuelve a la cola si
          cambias el texto.
        </p>

        {afirmaciones.map((a) => (
          <Ficha
            key={a.huella}
            afirmacion={a}
            revision={revisiones[a.huella]}
            revisor={revisor}
            setPost={setPost}
          />
        ))}
      </div>
    </details>
  );
}

function Ficha({
  afirmacion: a,
  revision,
  revisor,
  setPost,
}: {
  afirmacion: Afirmacion;
  revision?: NonNullable<Post['revisiones']>[string];
  revisor: string;
  setPost: (f: (p: Post) => Post) => void;
}) {
  const [enlace, setEnlace] = useState(revision?.enlace ?? '');
  const [nota, setNota] = useState(revision?.nota ?? '');

  const faltaEnlace = a.exigeEnlace && !enlace.trim();
  const revisada = Boolean(revision) && !(a.exigeEnlace && !revision?.enlace);

  const guardar = () =>
    setPost((p) => ({
      ...p,
      revisiones: {
        ...(p.revisiones ?? {}),
        [a.huella]: {
          revisadaPor: revisor,
          fecha: new Date().toISOString().slice(0, 10),
          texto: a.texto,
          ...(enlace.trim() ? { enlace: enlace.trim() } : {}),
          ...(nota.trim() ? { nota: nota.trim() } : {}),
        },
      },
    }));

  const deshacer = () =>
    setPost((p) => {
      const resto = { ...(p.revisiones ?? {}) };
      delete resto[a.huella];
      return { ...p, revisiones: Object.keys(resto).length ? resto : undefined };
    });

  return (
    <div className="afirmacion" data-revisada={revisada ? '' : undefined}>
      <div className="afirmacion__cabecera">
        <span className="chip">{a.donde}</span>
        {a.disparadores.map((d) => (
          <span key={d} className="chip" data-disparador={d}>
            {d}
          </span>
        ))}
      </div>

      <p className="afirmacion__texto">{resaltar(a.texto, a.marcas)}</p>

      {revisada ? (
        <>
          <p className="pista">
            La revisó {revision?.revisadaPor} el {revision?.fecha}
            {revision?.enlace ? (
              <>
                {' · '}
                <a href={revision.enlace} target="_blank" rel="noreferrer">
                  la fuente
                </a>
              </>
            ) : null}
          </p>
          <button className="boton sm" onClick={deshacer}>
            deshacer la revisión
          </button>
        </>
      ) : (
        <>
          <label>
            Enlace a la fuente {a.exigeEnlace ? '— obligatorio: lleva cifra' : '(opcional)'}
          </label>
          <input
            value={enlace}
            placeholder="https://…"
            onChange={(e) => setEnlace(e.target.value)}
          />
          <label>Nota (opcional)</label>
          <input value={nota} onChange={(e) => setNota(e.target.value)} />
          <button className="boton" onClick={guardar} disabled={faltaEnlace}>
            {faltaEnlace ? 'pega el enlace para poder marcarla' : 'la revisé'}
          </button>
        </>
      )}
    </div>
  );
}

/** Marca en el texto lo que hizo saltar cada disparador. */
function resaltar(texto: string, marcas: string[]) {
  const utiles = marcas.filter((m) => m && !m.includes('…') && texto.includes(m));
  if (utiles.length === 0) return texto;

  const patron = new RegExp(`(${utiles.map(escapar).join('|')})`, 'g');
  return texto.split(patron).map((trozo, i) =>
    utiles.includes(trozo) ? <mark key={i}>{trozo}</mark> : <span key={i}>{trozo}</span>,
  );
}

function escapar(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
