'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Post } from '@/template/tipos';

/**
 * Los dos botones de cada tarjeta de la lista: avanzar el estado y exportar.
 *
 * ── Por qué no llevan texto ─────────────────────────────────────────────────
 * Porque la lista es una rejilla de cinco columnas y una etiqueta partiría la
 * tarjeta. Lo que sí llevan es `title`: el ratón lo dice, el lector de pantalla
 * lo lee y no ocupa un píxel.
 *
 * ── El estado avanza, no da la vuelta ───────────────────────────────────────
 * `borrador → aprobado → publicado`, y en publicado se apaga. Un botón que
 * ciclara volvería a borrador de un clic distraído sobre algo ya publicado, y
 * el camino de todos los días es hacia adelante. Para retroceder está el
 * editor, que es donde se mira lo que se está cambiando.
 *
 * ── La barrera sigue donde estaba ───────────────────────────────────────────
 * Esto no aprueba nada: manda el post a `/api/post` con el estado nuevo y **el
 * servidor decide**. Si quedan afirmaciones sin revisar, fotos clínicas sin
 * firmar o imágenes sin licencia, la respuesta es un error y el estado no se
 * mueve. El botón enseña ese error en la tarjeta en vez de tragárselo: enterarse
 * aquí de que faltan once afirmaciones es información útil, y es lo mismo que
 * habría dicho el editor.
 */

/**
 * La línea del error que de verdad dice algo.
 *
 * La barrera contesta con un envoltorio de validación y debajo el motivo con la
 * lista entera de lo que falta:
 *
 *     No se pudo leer el carrusel que mandó el editor:
 *       · estado: no se puede guardar como "aprobado" con 8 afirmaciones sin revisar:
 *           · slide 01 · texto (fuente, sin revisar)
 *
 * En una columna de rejilla solo cabe una línea, y la primera —el envoltorio—
 * no dice nada. Se busca la que sí, y se le quitan los adornos. La lista entera
 * sigue en el `title`.
 */
function resumir(mensaje: string): string {
  const lineas = mensaje
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const util = lineas.find((l) => !/^No se pudo (leer|guardar)\b/i.test(l)) ?? lineas[0] ?? mensaje;
  return util
    .replace(/^·\s*/, '')
    .replace(/^estado:\s*/, '')
    .replace(/:$/, '');
}

const SIGUIENTE: Record<string, 'aprobado' | 'publicado' | null> = {
  borrador: 'aprobado',
  aprobado: 'publicado',
  publicado: null,
};

/** Palomita: de borrador a aprobado. */
const Palomita = () => (
  <svg viewBox="0 0 16 16" aria-hidden focusable="false">
    <path d="M3 8.5l3.2 3.2L13 4.8" />
  </svg>
);

/** Flecha que sale: de aprobado a publicado. */
const Sale = () => (
  <svg viewBox="0 0 16 16" aria-hidden focusable="false">
    <path d="M8 11.5V2.5M8 2.5L4.8 5.7M8 2.5l3.2 3.2M2.5 10v3.5h11V10" />
  </svg>
);

/** Palomita en círculo: ya publicado, no hay siguiente. */
const Publicado = () => (
  <svg viewBox="0 0 16 16" aria-hidden focusable="false">
    <circle cx="8" cy="8" r="5.6" />
    <path d="M5.6 8.2l1.7 1.7 3.1-3.6" />
  </svg>
);

/** Flecha a una bandeja: exportar. */
const Bajar = () => (
  <svg viewBox="0 0 16 16" aria-hidden focusable="false">
    <path d="M8 2.5V10m0 0l3.2-3.2M8 10L4.8 6.8M2.5 12.2v1.3h11v-1.3" />
  </svg>
);

/** Reloj de arena mientras trabaja. */
const Esperando = () => (
  <svg viewBox="0 0 16 16" aria-hidden focusable="false" className="gira">
    <path d="M8 2.2a5.8 5.8 0 1 1-5.8 5.8" />
  </svg>
);

export function AccionesPost({ post }: { post: Post }) {
  const router = useRouter();
  // El estado local hace que la tarjeta responda al instante. `router.refresh()`
  // trae la verdad del disco un momento después y los dos coinciden.
  const [estado, setEstado] = useState(post.estado);
  const [trabajando, setTrabajando] = useState<'estado' | 'exportar' | null>(null);
  const [error, setError] = useState<string>();

  const siguiente = SIGUIENTE[estado];

  async function avanzar() {
    if (!siguiente) return;
    setTrabajando('estado');
    setError(undefined);
    try {
      const r = await fetch('/api/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post: { ...post, estado: siguiente } }),
      });
      const c = await r.json();
      if (!r.ok) throw new Error(c.error);
      setEstado(siguiente);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cambiar el estado.');
    } finally {
      setTrabajando(null);
    }
  }

  async function exportar() {
    setTrabajando('exportar');
    setError(undefined);
    try {
      const r = await fetch('/api/exportar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: post.slug }),
      });
      if (!r.ok) {
        const { error: e } = await r.json().catch(() => ({ error: 'No se pudo exportar.' }));
        throw new Error(e);
      }
      const blob = await r.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `carrusel-${post.slug}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo exportar.');
    } finally {
      setTrabajando(null);
    }
  }

  return (
    <>
      <div className="acciones">
        <button
          type="button"
          className="cuadrado"
          data-estado={estado}
          disabled={!siguiente || trabajando !== null}
          onClick={avanzar}
          title={
            siguiente
              ? `Pasar a ${siguiente}${siguiente === 'aprobado' ? ' — el servidor revisa la cola de afirmaciones antes' : ''}`
              : 'Ya está publicado. Para volver atrás, en el editor.'
          }
        >
          {trabajando === 'estado' ? <Esperando /> : siguiente === 'aprobado' ? <Palomita /> : siguiente === 'publicado' ? <Sale /> : <Publicado />}
        </button>

        <button
          type="button"
          className="cuadrado"
          disabled={trabajando !== null}
          onClick={exportar}
          title={`Exportar los ${post.slides.length} slides en un ZIP — tarda unos segundos por slide`}
        >
          {trabajando === 'exportar' ? <Esperando /> : <Bajar />}
        </button>
      </div>

      {/*
        El error va entero en el `title` y recortado en la tarjeta: la barrera de
        afirmaciones contesta con la lista de las que faltan, y eso no cabe en
        una columna de rejilla. La primera línea ya dice cuántas son.
      */}
      {error ? (
        <p className="acciones__error" title={error}>
          {resumir(error)}
        </p>
      ) : null}
    </>
  );
}
