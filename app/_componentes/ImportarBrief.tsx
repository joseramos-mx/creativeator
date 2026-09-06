'use client';

import { useState } from 'react';
import type { Post } from '@/template/tipos';

/**
 * Pega el brief y sale el carrusel.
 *
 * No reemplaza nada hasta que ves qué entendió. El brief se escribe a mano y
 * casi siempre trae alguna sorpresa; aplicarlo a ciegas sería perder el
 * contenido anterior sin enterarse.
 */
export function ImportarBrief({ slug, onImportar }: { slug: string; onImportar: (p: Post) => void }) {
  const [texto, setTexto] = useState('');
  const [leido, setLeido] = useState<{ post: Post; avisos: string[] } | null>(null);
  const [error, setError] = useState<string>();
  const [trabajando, setTrabajando] = useState(false);

  async function leer() {
    setTrabajando(true);
    setError(undefined);
    try {
      const r = await fetch('/api/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto, slug }),
      });
      const cuerpo = await r.json();
      if (!r.ok) throw new Error(cuerpo.error);
      setLeido(cuerpo);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el brief.');
      setLeido(null);
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <details className="tarjeta">
      <summary>
        <span className="chip">brief</span>
        <span className="tarjeta__titulo">Importar desde el brief</span>
      </summary>

      <div className="tarjeta__cuerpo">
        <label>Pega el brief completo</label>
        <textarea
          rows={8}
          value={texto}
          placeholder={'Pilar: …\nObjetivo: …\nTema: …\n\nPortada\nTítulo: …\nPregunta: …\n\nSlide 1\n…'}
          onChange={(e) => setTexto(e.target.value)}
        />

        <button className="boton" onClick={leer} disabled={trabajando || texto.trim().length < 20}>
          {trabajando ? 'leyendo…' : 'Leer el brief'}
        </button>

        {error ? <p className="aviso">{error}</p> : null}

        {leido ? (
          <>
            <p className="pista">
              Entendí <strong>{leido.post.slides.length} slides</strong>
              {leido.post.pilar ? ` · pilar ${leido.post.pilar}` : ''}
              {leido.post.hashtags ? ` · ${leido.post.hashtags.length} hashtags` : ''}
              {leido.post.copy ? ' · con copy' : ' · sin copy'}.
            </p>

            {leido.avisos.length ? (
              <ul className="avisos">
                {leido.avisos.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            ) : null}

            <button
              className="boton"
              onClick={() => {
                // Se conserva el slug del post abierto: reemplazar el contenido
                // es una cosa, y cambiar de archivo es otra muy distinta.
                onImportar({ ...leido.post, slug });
                setLeido(null);
                setTexto('');
              }}
            >
              Reemplazar el contenido de este carrusel
            </button>
          </>
        ) : null}
      </div>
    </details>
  );
}
