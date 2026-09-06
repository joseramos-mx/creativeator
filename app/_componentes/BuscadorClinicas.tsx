'use client';

import { useEffect, useState } from 'react';
import type { Aprobacion, Credito } from '@/template/tipos';

/**
 * El archivo clínico: fotos de lesión, no de ambiente.
 *
 * Va en un panel aparte y se ve distinto a propósito. Son dos gestos con el
 * mismo aspecto y consecuencias distintas: elegir una foto de aula es una
 * decisión de diseño, y elegir una foto de piel enferma es una afirmación
 * clínica —"esto es lo que dice el texto que es"— que lleva el nombre de un
 * médico detrás. Si los dos paneles se parecieran, tarde o temprano se usarían
 * igual.
 *
 * **El sistema propone; el médico inserta.** El botón no se activa hasta que se
 * escribe su nombre, y el servidor lo vuelve a comprobar: lo que queda escrito
 * en el JSON es una firma, y un botón desactivado en el navegador no basta.
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
  indice,
  medico,
  onAprobar,
}: {
  slug: string;
  indice: number;
  /** El nombre de content/marca.json. Es el único que puede firmar. */
  medico: string;
  onAprobar: (ruta: string, credito: Credito, aprobacion: Aprobacion) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [query, setQuery] = useState('');
  const [candidatos, setCandidatos] = useState<Candidato[] | null>(null);
  const [sinLicencia, setSinLicencia] = useState(0);
  const [elegido, setElegido] = useState<Candidato | null>(null);
  const [firma, setFirma] = useState('');
  const [nota, setNota] = useState('');
  const [error, setError] = useState<string>();
  const [trabajando, setTrabajando] = useState(false);

  // El nombre no se hereda de la marca: se escribe. Es la misma regla que en la
  // cola de afirmaciones, y por el mismo motivo — una firma que se rellena sola
  // no es una firma.
  useEffect(() => setFirma(localStorage.getItem('revisor') ?? ''), []);

  const puedeFirmar = firma.trim() === medico;

  async function buscar(propia?: string) {
    setTrabajando(true);
    setError(undefined);
    try {
      const r = await fetch('/api/fotos/clinicas', {
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

  async function aprobar() {
    if (!elegido) return;
    setTrabajando(true);
    setError(undefined);
    try {
      const r = await fetch('/api/fotos/aprobar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, candidato: elegido, aprobadaPor: firma.trim(), nota }),
      });
      const cuerpo = await r.json();
      if (!r.ok) throw new Error(cuerpo.error);
      onAprobar(cuerpo.ruta, cuerpo.credito, cuerpo.aprobacion);
      setElegido(null);
      setCandidatos(null);
      setAbierto(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo aprobar.');
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
        Fotos de piel enferma. Las firma {medico} y no se pueden insertar sin esa firma.
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
        <div className="clinico__firma">
          <p className="afirmacion__texto">{elegido.descripcion}</p>
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

          <label>Quién aprueba — solo {medico}</label>
          <input
            value={firma}
            placeholder={medico}
            onChange={(e) => {
              setFirma(e.target.value);
              try {
                localStorage.setItem('revisor', e.target.value);
              } catch {
                // navegador sin almacenamiento: se pierde al recargar
              }
            }}
          />

          <label>Nota de la aprobación (opcional)</label>
          <input value={nota} onChange={(e) => setNota(e.target.value)} />

          <button className="boton" onClick={aprobar} disabled={trabajando || !puedeFirmar}>
            {trabajando
              ? 'bajando y firmando…'
              : puedeFirmar
                ? 'Aprobar y poner en el slide'
                : `esta la firma ${medico}`}
          </button>
          <p className="pista">
            La firma queda pegada a los bytes de esta imagen. Si el archivo cambia, se cae y hay que
            volver a mirarla.
          </p>
        </div>
      ) : null}
    </div>
  );
}
