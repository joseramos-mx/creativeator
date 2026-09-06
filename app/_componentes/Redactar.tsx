'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { afirmacionesDe } from '@/lib/afirmaciones';
import type { Post } from '@/template/tipos';

/**
 * Escribe un tema y sale un borrador.
 *
 * Dos cosas que este panel hace a propósito y conviene no "arreglar":
 *
 * · **No exporta.** Guarda como borrador y abre el editor. Entre lo que escribe
 *   el modelo y un PNG hay una persona, siempre.
 * · **Enseña antes de escribir a disco.** Una llamada cuesta y tarda; ver qué
 *   salió —con qué paleta, con cuántas afirmaciones por revisar— antes de
 *   crear el archivo es lo que evita acumular borradores que nadie quiso.
 *
 * Y si el tema se deja vacío, el modelo propone tres antes de escribir nada.
 * Proponer son segundos y redactar son dos minutos, así que elegir primero sale
 * mucho más barato que descubrir a los dos minutos que no era el tema.
 */

type Propuesta = {
  tema: string;
  /** Qué hace que este tema toque este mes y no en marzo. */
  porQueAhora: string;
  paleta: string;
  porQuePaleta: string;
};

export function Redactar() {
  const router = useRouter();
  const [tema, setTema] = useState('');
  const [propuestas, setPropuestas] = useState<Propuesta[] | null>(null);
  const [contexto, setContexto] = useState<{ mes: string } | null>(null);
  const [salida, setSalida] = useState<{
    post: Post;
    porQuePaleta: string;
    avisos: string[];
  } | null>(null);
  const [slug, setSlug] = useState('');
  const [error, setError] = useState<string>();
  const [trabajando, setTrabajando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  /** Sin tema escrito: el modelo propone tres y se elige. */
  async function proponerTemas() {
    setTrabajando(true);
    setError(undefined);
    setSalida(null);
    try {
      const r = await fetch('/api/proponer', { method: 'POST' });
      const cuerpo = await r.json();
      if (!r.ok) throw new Error(cuerpo.error);
      setPropuestas(cuerpo.propuestas);
      setContexto(cuerpo.contexto);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron proponer temas.');
    } finally {
      setTrabajando(false);
    }
  }

  async function redactar(elegido?: string) {
    const cual = (elegido ?? tema).trim();
    setTrabajando(true);
    setError(undefined);
    setSalida(null);
    try {
      const r = await fetch('/api/redactar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tema: cual }),
      });
      const cuerpo = await r.json();
      if (!r.ok) throw new Error(cuerpo.error);
      setSalida(cuerpo);
      setSlug(cuerpo.post.slug);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo redactar.');
    } finally {
      setTrabajando(false);
    }
  }

  async function guardar() {
    if (!salida) return;
    setGuardando(true);
    setError(undefined);
    try {
      const post = { ...salida.post, slug };
      const r = await fetch('/api/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post }),
      });
      const cuerpo = await r.json();
      if (!r.ok) throw new Error(cuerpo.error);
      router.push(`/post/${slug}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
      setGuardando(false);
    }
  }

  // Se cuentan aquí con el mismo extractor del editor: lo que se enseña es lo
  // que va a pedir la cola, no una estimación aparte que pueda desviarse.
  const porRevisar = salida ? afirmacionesDe(salida.post).length : 0;

  return (
    <details className="tarjeta" data-redactar>
      <summary>
        <span className="chip">redactar</span>
        <span className="tarjeta__titulo">Redactar un carrusel con la IA</span>
      </summary>

      <div className="tarjeta__cuerpo">
        <label>El tema, como se lo dirías a alguien — o déjalo vacío</label>
        <input
          value={tema}
          placeholder="dermatitis atópica en invierno"
          onChange={(e) => setTema(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || trabajando) return;
            if (tema.trim().length >= 4) redactar();
            else if (!tema.trim()) void proponerTemas();
          }}
        />

        {/* Sin tema, el botón cambia de trabajo. Proponer son segundos y
            redactar son dos minutos, así que elegir primero sale mucho más
            barato que descubrir a los dos minutos que no era el tema. */}
        <button
          className="boton"
          onClick={() => (tema.trim() ? redactar() : proponerTemas())}
          disabled={trabajando || (tema.trim().length > 0 && tema.trim().length < 4)}
        >
          {trabajando
            ? tema.trim()
              ? 'redactando… tarda un par de minutos'
              : 'pensando temas…'
            : tema.trim()
              ? 'Redactar'
              : 'Proponer tres temas'}
        </button>

        {error ? <p className="aviso">{error}</p> : null}

        {propuestas ? (
          <>
            <p className="pista">
              Tres para {contexto?.mes}, sin repetir lo que ya está publicado. Elige uno y se
              redacta; o escribe el tuyo arriba.
            </p>
            <ol className="propuestas">
              {propuestas.map((p) => (
                <li key={p.tema}>
                  <button
                    className="propuesta"
                    onClick={() => {
                      setTema(p.tema);
                      setPropuestas(null);
                      void redactar(p.tema);
                    }}
                  >
                    <strong>{p.tema}</strong>
                    <span>{p.porQueAhora}</span>
                    <em data-paleta={p.paleta}>
                      paleta {p.paleta} · {p.porQuePaleta}
                    </em>
                  </button>
                </li>
              ))}
            </ol>
          </>
        ) : null}

        {salida ? (
          <>
            <p className="pista">
              <strong>{salida.post.slides.length} slides</strong> · paleta{' '}
              <strong>{salida.post.paleta}</strong> — {salida.porQuePaleta}
            </p>

            <ol className="redaccion">
              {salida.post.slides.map((s, i) => (
                <li key={i}>
                  <span className="chip">{s.tipo}</span>
                  <span>{titulo(s)}</span>
                </li>
              ))}
            </ol>

            <p className="pista">
              {porRevisar === 0
                ? 'Ninguna afirmación entra en la cola: nada con cifra, fuente ni indicación de seguridad.'
                : `${porRevisar} ${porRevisar === 1 ? 'afirmación' : 'afirmaciones'} para revisar antes de poder aprobarlo.`}
            </p>

            {salida.avisos.length ? (
              <ul className="avisos">
                {salida.avisos.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            ) : null}

            <label>El nombre del archivo</label>
            <input value={slug} onChange={(e) => setSlug(e.target.value.trim())} />

            <button className="boton" onClick={guardar} disabled={guardando || !slug}>
              {guardando ? 'guardando…' : 'Guardar como borrador y abrirlo'}
            </button>
            <p className="pista">
              Se guarda como borrador y se abre en el editor. No se exporta nada: lo que escribió el
              modelo todavía no lo ha leído nadie.
            </p>
          </>
        ) : null}
      </div>
    </details>
  );
}

function titulo(s: Post['slides'][number]) {
  if (s.tipo === 'cierre') return s.frase ?? 'cierre de la cuenta';
  return s.titulo.replace(/[*\n]/g, ' ').replace(/\s+/g, ' ').trim();
}
