'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useApi, useProyecto } from './proyecto';

/**
 * El panel de /descargas que manda un carrusel al teléfono.
 *
 * ── Por qué solo sale en tu máquina ─────────────────────────────────────────
 * Preparar exporta, y exportar abre un Chromium de verdad y escribe archivos.
 * En Vercel no hay ni lo uno ni lo otro, así que allá este panel no se pinta:
 * enseñar botones que no pueden funcionar es peor que no enseñarlos.
 *
 * ── Por qué dice lo del push ────────────────────────────────────────────────
 * Porque preparar deja el PNG en este disco, y el teléfono lo lee del
 * despliegue. Entre las dos cosas hay un `git push`, y si la pantalla no lo
 * dice, lo que pasa es que preparas, abres el teléfono y no está — sin ninguna
 * pista de por qué.
 *
 * ── Por qué no hay un «preparar todos» ──────────────────────────────────────
 * Lo había, y sale caro sin que se note: los diecisiete son 42 MB en un
 * repositorio que pesa 48. Y son archivos derivados que caducan en cuanto se
 * edita un slide, así que la mayoría sería peso muerto desde el primer día. Se
 * preparan los que vas a publicar.
 */

type Fila = {
  slug: string;
  tema: string;
  estado: string;
  preparado: boolean;
  alDia: boolean;
};

export function PrepararCelular({ filas }: { filas: Fila[] }) {
  const api = useApi();
  const proyecto = useProyecto();
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string>();

  async function preparar(slug: string, quitar = false) {
    setTrabajando(slug);
    setAviso(undefined);
    try {
      const r = await fetch(api('/celular'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, quitar }),
      });
      const c = await r.json();
      if (!r.ok) throw new Error(c.error);
      setAviso(
        quitar
          ? `Quitado. Haz commit de public/proyectos/${proyecto}/descargas y súbelo.`
          : `Listo: ${c.slides} slides, ${c.pesoMB} MB. Haz commit de public/proyectos/${proyecto}/descargas y súbelo para verlo en el teléfono.`,
      );
      router.refresh();
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'No se pudo preparar.');
    } finally {
      setTrabajando(null);
    }
  }

  const pendientes = filas.filter((f) => !f.preparado || !f.alDia).length;

  return (
    <section className="preparar">
      <button type="button" className="preparar__abrir" onClick={() => setAbierto(!abierto)}>
        {abierto ? '▾' : '▸'} Mandar un carrusel al teléfono
        {pendientes > 0 ? <em>{pendientes} sin preparar o desactualizados</em> : null}
      </button>

      {abierto ? (
        <>
          <p className="preparar__nota">
            Exporta aquí y el despliegue lo sirve. Entre las dos cosas va un <code>git push</code>: los
            PNG viven en el repositorio.
          </p>

          <ul className="preparar__lista">
            {filas.map((f) => (
              <li key={f.slug} data-listo={f.preparado && f.alDia ? '' : undefined}>
                <span className="preparar__tema">
                  {f.tema}
                  <em data-estado={f.estado}>{f.estado}</em>
                </span>

                <span className="preparar__acciones">
                  {f.preparado && !f.alDia ? <em className="preparar__viejo">cambió</em> : null}
                  {f.preparado && f.alDia ? <em className="preparar__ok">al día</em> : null}

                  <button type="button" onClick={() => preparar(f.slug)} disabled={trabajando !== null}>
                    {trabajando === f.slug ? 'exportando…' : f.preparado ? 'rehacer' : 'preparar'}
                  </button>

                  {f.preparado ? (
                    <button
                      type="button"
                      className="preparar__quitar"
                      onClick={() => preparar(f.slug, true)}
                      disabled={trabajando !== null}
                      title="Quitarlo de las descargas"
                    >
                      ×
                    </button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>

          {aviso ? <p className="preparar__aviso">{aviso}</p> : null}
        </>
      ) : null}
    </section>
  );
}
