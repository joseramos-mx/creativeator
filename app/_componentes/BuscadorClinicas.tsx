'use client';

import { useState } from 'react';
import type { Credito } from '@/plantillas/clinica/tipos';
import { useApi } from './proyecto';

/**
 * El archivo clínico: fotos de lesión, no de ambiente.
 *
 * Va en un panel aparte porque busca en otro sitio —Wikimedia Commons— y con
 * otra consulta: el nombre de la condición, no la escena. Lo demás es igual que
 * el banco de ambiente: se elige, se baja y queda con su licencia escrita. La
 * validación con la cuenta pasa por fuera, cuando se le mandan las imágenes.
 */

type Candidato = {
  id: string;
  proveedor: string;
  descripcion: string;
  ancho: number;
  alto: number;
  vista: string;
  descarga: string;
  avisos?: string[];
  credito: Credito | null;
};

export function BuscadorClinicas({
  slug,
  onElegir,
}: {
  slug: string;
  onElegir: (ruta: string, credito: Credito) => void;
}) {
  const api = useApi();
  const [abierto, setAbierto] = useState(false);
  const [query, setQuery] = useState('');
  const [candidatos, setCandidatos] = useState<Candidato[] | null>(null);
  const [sinLicencia, setSinLicencia] = useState(0);
  const [elegido, setElegido] = useState<Candidato | null>(null);
  const [error, setError] = useState<string>();
  const [trabajando, setTrabajando] = useState(false);

  async function buscar(propia?: string) {
    setTrabajando(true);
    setError(undefined);
    try {
      const r = await fetch(api('/fotos/clinicas'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, ...(propia ? { query: propia } : {}) }),
      });
      const cuerpo = await r.json();
      if (!r.ok) throw new Error(cuerpo.error);
      setCandidatos(cuerpo.candidatos);
      setSinLicencia(cuerpo.sinLicencia);
      setQuery(cuerpo.query);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo buscar.');
    } finally {
      setTrabajando(false);
    }
  }

  async function usar() {
    if (!elegido) return;
    setTrabajando(true);
    setError(undefined);
    try {
      const r = await fetch(api('/fotos/elegir'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, candidato: elegido, archivo: true }),
      });
      const cuerpo = await r.json();
      if (!r.ok) throw new Error(cuerpo.error);
      onElegir(cuerpo.ruta, cuerpo.credito);
      setElegido(null);
      setCandidatos(null);
      setAbierto(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo traer la imagen.');
    } finally {
      setTrabajando(false);
    }
  }

  if (!abierto) {
    return (
      <div className="clinico">
        <button
          className="boton sm"
          onClick={() => {
            setAbierto(true);
            void buscar();
          }}
        >
          Archivo clínico — imágenes de lesión
        </button>
      </div>
    );
  }

  return (
    <div className="clinico" data-clinico>
      <p className="clinico__cabecera">
        <span className="chip chip--clinico">clínico</span>
        Fotos de lesión de Wikimedia Commons, solo con licencias que permiten uso comercial.
      </p>

      <label>Qué buscar en el archivo</label>
      <div className="fila">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && query.trim()) void buscar(query.trim());
          }}
        />
        <button
          className="boton"
          style={{ flex: '0 0 auto' }}
          onClick={() => void buscar(query.trim())}
          disabled={trabajando || !query.trim()}
        >
          {trabajando ? '…' : 'buscar'}
        </button>
      </div>

      {error ? <p className="aviso">{error}</p> : null}

      {candidatos ? (
        <>
          <div className="rejilla-fotos">
            {candidatos.map((c) => (
              <button
                key={c.id}
                className="foto-opcion"
                data-elegida={elegido?.id === c.id ? '' : undefined}
                title={c.descripcion}
                onClick={() => setElegido(elegido?.id === c.id ? null : c)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.vista} alt={c.descripcion} loading="lazy" />
                <span>{c.credito?.licencia}</span>
              </button>
            ))}
          </div>

          {candidatos.length === 0 ? (
            <p className="pista">Nada usable con esa búsqueda.</p>
          ) : null}

          {sinLicencia > 0 ? (
            <p className="pista pista--aviso">
              {sinLicencia} {sinLicencia === 1 ? 'imagen quedó' : 'imágenes quedaron'} fuera por su
              licencia: no comercial, sin derivadas, o una que el adaptador no reconoce.
            </p>
          ) : null}
        </>
      ) : null}

      {elegido ? (
        <div className="clinico__elegida">
          <p className="clinico__texto">{elegido.descripcion}</p>
          <p className="pista">
            {elegido.credito?.licencia}
            {elegido.credito?.autor ? ` · ${elegido.credito.autor}` : ''}
            {elegido.credito?.url ? (
              <>
                {' · '}
                <a href={elegido.credito.url} target="_blank" rel="noreferrer">
                  la ficha en el archivo
                </a>
              </>
            ) : null}
          </p>

          {elegido.avisos?.length ? (
            <ul className="avisos">
              {elegido.avisos.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          ) : null}

          <button className="boton" onClick={usar} disabled={trabajando}>
            {trabajando ? 'bajando…' : 'Poner en el slide'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
