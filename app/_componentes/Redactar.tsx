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
 */
export function Redactar() {
  const router = useRouter();
  const [tema, setTema] = useState('');
  const [salida, setSalida] = useState<{
    post: Post;
    porQuePaleta: string;
    avisos: string[];
  } | null>(null);
  const [slug, setSlug] = useState('');
  const [error, setError] = useState<string>();
  const [trabajando, setTrabajando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  async function redactar() {
    setTrabajando(true);
    setError(undefined);
    setSalida(null);
    try {
      const r = await fetch('/api/redactar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tema }),
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
        <label>El tema, como se lo dirías a alguien</label>
        <input
          value={tema}
          placeholder="dermatitis atópica en invierno"
          onChange={(e) => setTema(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && tema.trim().length >= 4 && !trabajando) redactar();
          }}
        />

        <button className="boton" onClick={redactar} disabled={trabajando || tema.trim().length < 4}>
          {trabajando ? 'redactando… tarda un par de minutos' : 'Redactar'}
        </button>

        {error ? <p className="aviso">{error}</p> : null}

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
