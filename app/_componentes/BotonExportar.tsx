'use client';

import { useState } from 'react';
import { useApi } from './proyecto';

/**
 * Pide el carrusel a /api/exportar y lo baja.
 *
 * La exportación tarda unos segundos por slide porque abre un navegador de
 * verdad, así que el botón dice en qué va en vez de quedarse mudo.
 */
export function BotonExportar({ slug, slides }: { slug: string; slides: number }) {
  const api = useApi();
  const [estado, setEstado] = useState<'listo' | 'trabajando' | 'error'>('listo');
  const [aviso, setAviso] = useState<string>();

  async function exportar() {
    setEstado('trabajando');
    setAviso(undefined);
    try {
      const r = await fetch(api('/exportar'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      if (!r.ok) {
        const { error } = await r.json().catch(() => ({ error: 'No se pudo exportar.' }));
        throw new Error(error);
      }

      const carpeta = r.headers.get('X-Salida');
      const blob = await r.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `carrusel-${slug}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);

      setEstado('listo');
      setAviso(carpeta ? `También quedó en ${carpeta}` : undefined);
    } catch (e) {
      setEstado('error');
      setAviso(e instanceof Error ? e.message : 'No se pudo exportar.');
    }
  }

  return (
    <>
      <button className="boton" onClick={exportar} disabled={estado === 'trabajando'}>
        {estado === 'trabajando' ? `Exportando ${slides} slides…` : 'Exportar carrusel (ZIP)'}
      </button>
      {aviso ? <p data-error={estado === 'error' ? '' : undefined}>{aviso}</p> : null}
    </>
  );
}
