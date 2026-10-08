'use client';

import { useState } from 'react';
import type { Credito } from '@/plantillas/clinica/tipos';
import { useApi } from './proyecto';

/**
 * Buscar la foto del slide en un banco, sin salir del editor.
 *
 * Dos etapas, y la separación importa: la primera la escribe Claude leyendo el
 * slide y cuesta una llamada; la segunda solo consulta el banco. Por eso la
 * consulta se puede corregir y volver a buscar cuantas veces haga falta sin
 * gastar modelo.
 *
 * Lo que se enseña aparte, y no se esconde, son los **apartados**: los que
 * encajaban con la consulta y aun así estaban mal. Verlos es cómo se nota que
 * el descarte está bien puesto —o que no—, y es la razón de que este panel
 * exista: el slide del contagio se publicó con la foto de un gimnasio.
 */

type Candidato = {
  id: string;
  proveedor: string;
  descripcion: string;
  ancho: number;
  alto: number;
  vista: string;
  descarga: string;
  credito: Credito | null;
};

type Apartado = Candidato & { porque: string };

type Hallazgo = {
  banco: string;
  criterios: { query: string; criterios: string; descartar: string[] };
  pasan: Candidato[];
  apartados: Apartado[];
  sinCredito: number;
};

export function BuscadorFotos({
  slug,
  indice,
  onElegir,
}: {
  slug: string;
  indice: number;
  onElegir: (ruta: string, credito: Credito) => void;
}) {
  const api = useApi();
  const [hallazgo, setHallazgo] = useState<Hallazgo | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string>();
  const [buscando, setBuscando] = useState(false);
  const [bajando, setBajando] = useState<string>();
  const [verApartados, setVerApartados] = useState(false);
  const [verOtras, setVerOtras] = useState(false);

  /**
   * Busca y pone la mejor, en un solo gesto.
   *
   * Elegir entre veinticuatro fotos de aula es preferencia, no criterio: la
   * primera del banco ya viene ordenada por relevancia y cambiarla después en
   * el editor cuesta un clic. Lo que no es preferencia —de dónde salió y bajo
   * qué licencia— se escribe igual, en la misma petición.
   */
  async function buscarYPoner() {
    const hallado = await buscar();
    const mejor = hallado?.pasan[0];
    if (mejor) await elegir(mejor);
  }

  async function buscar(propia?: string) {
    setBuscando(true);
    setError(undefined);
    try {
      const r = await fetch(api('/fotos/buscar'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          propia
            ? { slug, indice, query: propia, descartar: hallazgo?.criterios.descartar ?? [] }
            : { slug, indice },
        ),
      });
      const cuerpo = await r.json();
      if (!r.ok) throw new Error(cuerpo.error);
      setHallazgo(cuerpo);
      setQuery(cuerpo.criterios.query);
      return cuerpo as Hallazgo;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo buscar.');
      return null;
    } finally {
      setBuscando(false);
    }
  }

  async function elegir(candidato: Candidato) {
    setBajando(candidato.id);
    setError(undefined);
    try {
      const r = await fetch(api('/fotos/elegir'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, candidato }),
      });
      const cuerpo = await r.json();
      if (!r.ok) throw new Error(cuerpo.error);
      onElegir(cuerpo.ruta, cuerpo.credito);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo traer la foto.');
    } finally {
      setBajando(undefined);
    }
  }

  return (
    <div className="banco" data-banco>
      {!hallazgo ? (
        <button className="boton" onClick={buscarYPoner} disabled={buscando}>
          {buscando ? 'buscando y poniendo…' : 'Buscar foto en el banco'}
        </button>
      ) : null}

      {error ? <p className="aviso">{error}</p> : null}

      {hallazgo ? (
        <>
          {hallazgo.criterios.criterios ? (
            <p className="pista">{hallazgo.criterios.criterios}</p>
          ) : null}

          <label>Consulta — cambiarla y volver a buscar no gasta modelo</label>
          <div className="fila">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && query.trim()) buscar(query.trim());
              }}
            />
            <button
              className="boton"
              style={{ flex: '0 0 auto' }}
              onClick={() => buscar(query.trim())}
              disabled={buscando || !query.trim()}
            >
              {buscando ? '…' : 'buscar'}
            </button>
          </div>

          {hallazgo.criterios.descartar.length ? (
            <p className="pista">
              Se aparta lo que mencione:{' '}
              {hallazgo.criterios.descartar.map((d) => (
                <code key={d}>{d} </code>
              ))}
            </p>
          ) : null}

          {hallazgo.pasan.length === 0 ? (
            <p className="pista">Ninguna pasó la criba. Prueba con otra consulta.</p>
          ) : (
            <>
              <button className="boton sm" onClick={() => setVerOtras((v) => !v)}>
                {verOtras ? 'ocultar' : 'ver'} las otras {hallazgo.pasan.length - 1}
              </button>
              {verOtras ? (
                <Rejilla candidatos={hallazgo.pasan.slice(1)} bajando={bajando} onElegir={elegir} />
              ) : null}
            </>
          )}

          {hallazgo.apartados.length ? (
            <>
              <button className="boton sm" onClick={() => setVerApartados((v) => !v)}>
                {verApartados ? 'ocultar' : 'ver'} las {hallazgo.apartados.length} apartadas
              </button>
              {verApartados ? (
                <>
                  <p className="pista">
                    Encajaban con la consulta y aun así están mal para este slide. Si alguna te
                    parece bien, el descarte está de más: quita el término y vuelve a buscar.
                  </p>
                  <Rejilla candidatos={hallazgo.apartados} bajando={bajando} onElegir={elegir} />
                </>
              ) : null}
            </>
          ) : null}

          {hallazgo.sinCredito > 0 ? (
            <p className="pista pista--aviso">
              {hallazgo.sinCredito}{' '}
              {hallazgo.sinCredito === 1 ? 'foto se descartó' : 'fotos se descartaron'} porque el
              banco no devolvió autor o enlace. Sin eso no se puede acreditar, así que no se ofrece.
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function Rejilla({
  candidatos,
  bajando,
  onElegir,
  vacio,
}: {
  candidatos: (Candidato | Apartado)[];
  bajando?: string;
  onElegir: (c: Candidato) => void;
  vacio?: string;
}) {
  if (candidatos.length === 0) return vacio ? <p className="pista">{vacio}</p> : null;

  return (
    <div className="rejilla-fotos">
      {candidatos.map((c) => (
        <button
          key={c.id}
          className="foto-opcion"
          data-apartada={'porque' in c ? '' : undefined}
          title={c.descripcion}
          disabled={Boolean(bajando)}
          onClick={() => onElegir(c)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={c.vista} alt={c.descripcion} loading="lazy" />
          <span>
            {bajando === c.id ? 'bajando…' : c.credito?.autor}
            {'porque' in c ? <em> · {c.porque}</em> : null}
          </span>
        </button>
      ))}
    </div>
  );
}
