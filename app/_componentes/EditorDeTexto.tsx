'use client';

import { useState } from 'react';
import { useApi } from './proyecto';

/** Un texto de la cuenta (.md, .tsv), editado a mano desde el explorador. */
export function EditorDeTexto({ ruta, inicial }: { ruta: string; inicial: string }) {
  const api = useApi();
  const [texto, setTexto] = useState(inicial);
  const [guardado, setGuardado] = useState(inicial);
  const [estado, setEstado] = useState<{ error?: string; ok?: boolean }>({});
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setGuardando(true);
    setEstado({});
    try {
      const r = await fetch(api('/archivos'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruta, texto }),
      });
      const cuerpo = await r.json();
      if (!r.ok) throw new Error(cuerpo.error);
      setGuardado(texto);
      setEstado({ ok: true });
    } catch (e) {
      setEstado({ error: e instanceof Error ? e.message : 'No se pudo guardar.' });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="archivo__editor" data-editor-texto>
      <textarea className="identidad__md" rows={24} value={texto} onChange={(e) => setTexto(e.target.value)} />
      <div className="identidad__acciones">
        <button className="boton" onClick={() => void guardar()} disabled={guardando || texto === guardado}>
          {guardando ? 'Guardando…' : texto === guardado ? 'Sin cambios' : 'Guardar'}
        </button>
        {estado.ok ? <span className="pista pista--ok">Guardado.</span> : null}
      </div>
      {estado.error ? <p className="aviso">{estado.error}</p> : null}
    </div>
  );
}
