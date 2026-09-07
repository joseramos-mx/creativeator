'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { afirmacionesDe } from '@/lib/afirmaciones';

/**
 * Sube el calendario editorial y escribe los carruseles que faltan.
 *
 * ── Por qué el bucle corre en el navegador ──────────────────────────────────
 * Doce carruseles son media hora y una ruta de Next se corta a los cinco
 * minutos, así que "un botón que lo hace todo en una petición" no existe. Las
 * opciones eran una cola de trabajos en el servidor —con su estado, su
 * reinicio y su endpoint de consulta— o que el bucle viva aquí y llame a
 * `/api/redactar` una vez por fila, que es lo que ya hace `npm run mes` desde
 * la terminal.
 *
 * Aquí gana lo segundo, y no solo por ser menos código: **cada carrusel se
 * guarda en cuanto sale**. Si se cierra la pestaña a la mitad, lo escrito está
 * escrito, y volver a abrir el panel enseña los que faltan. La pestaña tiene
 * que quedarse abierta mientras trabaja, y eso se dice en pantalla en vez de
 * dejar que se descubra solo.
 *
 * ── Lo que este panel no hace ───────────────────────────────────────────────
 * No exporta y no aprueba. Todo entra como `borrador`, la cola de afirmaciones
 * queda entera y al final se dice cuántas acaban de entrar — que es el costo
 * real de escribir doce de golpe, y el que no se ve mientras se mira la barra.
 */

type Fila = {
  numero: number | null;
  fecha: string;
  tema: string;
  pilar: string;
  objetivo: 'guardar' | 'compartir' | 'comentar' | 'agendar' | null;
  nota: string;
  linea: number;
  slug: string;
  /** Con qué carrusel ya escrito coincide, o `null` si falta. */
  hecho: string | null;
};

type Saltada = { linea: number; tema: string; porque: string };

/** Lo que le pasa a una fila durante la tanda. */
type Estado =
  | { fase: 'espera' }
  | { fase: 'escribiendo'; desde: number }
  | { fase: 'hecho'; afirmaciones: number; seguridad: number; paleta: string; avisos: string[] }
  | { fase: 'fallo'; porque: string };

/** Cuánto tarda un carrusel en una corrida normal, en segundos. Medido. */
const POR_CARRUSEL = 155;

const reloj = (s: number) =>
  s < 60 ? `${Math.round(s)}s` : `${Math.floor(s / 60)} min ${String(Math.round(s % 60)).padStart(2, '0')}s`;

export function Calendario() {
  const router = useRouter();
  const [filas, setFilas] = useState<Fila[]>([]);
  const [saltadas, setSaltadas] = useState<Saltada[]>([]);
  const [hay, setHay] = useState<boolean | null>(null);
  const [elegidas, setElegidas] = useState<Set<number>>(new Set());
  const [estados, setEstados] = useState<Record<number, Estado>>({});
  const [error, setError] = useState<string>();
  const [trabajando, setTrabajando] = useState(false);
  const [ahora, setAhora] = useState(Date.now());
  const [encima, setEncima] = useState(false);
  const parar = useRef(false);

  const faltan = filas.filter((f) => !f.hecho);
  /*
   * Lo escrito en esta sesión también queda fuera, y no solo lo que ya estaba
   * escrito al cargar. Es el cinturón por si `refrescar` no llegara: sin esto,
   * un segundo clic en el botón redactaría otra vez lo que se acaba de
   * escribir y lo guardaría encima.
   */
  const escogidas = faltan.filter(
    (f) => elegidas.has(f.linea) && estados[f.linea]?.fase !== 'hecho',
  );

  /* ── cargar lo que ya hay ─────────────────────────────────────────────── */

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch('/api/calendario');
        const c = await r.json();
        recibir(c);
      } catch {
        setHay(false);
      }
    })();
  }, []);

  function recibir(c: { hay?: boolean; filas?: Fila[]; saltadas?: Saltada[]; error?: string }) {
    setHay(Boolean(c.hay));
    setFilas(c.filas ?? []);
    setSaltadas(c.saltadas ?? []);
    setError(c.error);
    // Todo lo que falta va marcado: el camino de cero clics es "escríbelos
    // todos", que es lo que se pide el 90 % de las veces. Desmarcar es para
    // cuando se quiere solo un trozo.
    setElegidas(new Set((c.filas ?? []).filter((f) => !f.hecho).map((f) => f.linea)));
    setEstados({});
  }

  /**
   * Vuelve a preguntar cuáles están escritos, sin borrar lo que se acaba de ver.
   *
   * Hace falta al terminar la tanda y no es cosmético: `hecho` se calculó al
   * cargar la página, así que las filas que se acaban de escribir seguirían
   * contando como pendientes y **marcadas**. Un segundo clic en el botón las
   * volvería a redactar y a guardar encima — que es justo lo que la tanda de
   * la terminal no puede hacer, y aquí sí podía.
   *
   * A diferencia de `recibir`, respeta lo que se había desmarcado a mano y deja
   * los resultados en pantalla.
   */
  async function refrescar() {
    try {
      const c = await (await fetch('/api/calendario')).json();
      if (!c.filas) return;
      setFilas(c.filas);
      setSaltadas(c.saltadas ?? []);
      setElegidas((antes) => {
        const pendientes = new Set(
          (c.filas as Fila[]).filter((f) => !f.hecho).map((f) => f.linea),
        );
        return new Set([...antes].filter((l) => pendientes.has(l)));
      });
    } catch {
      // Si falla, lo peor que pasa es que la lista quede vieja hasta recargar.
    }
  }

  /* ── el reloj y el aviso de no cerrar ─────────────────────────────────── */

  useEffect(() => {
    if (!trabajando) return;
    const t = setInterval(() => setAhora(Date.now()), 1000);

    // El bucle vive en esta pestaña: cerrarla a la mitad para la tanda. Lo
    // escrito no se pierde, pero el resto no se escribe, así que conviene
    // preguntarlo en vez de dejar que pase.
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', avisar);
    return () => {
      clearInterval(t);
      window.removeEventListener('beforeunload', avisar);
    };
  }, [trabajando]);

  /* ── subir el archivo ─────────────────────────────────────────────────── */

  async function subir(archivo: File) {
    setError(undefined);
    try {
      const texto = await archivo.text();
      const r = await fetch('/api/calendario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto }),
      });
      const c = await r.json();
      if (!r.ok) throw new Error(c.error);
      recibir(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el archivo.');
    }
  }

  /* ── la tanda ─────────────────────────────────────────────────────────── */

  /**
   * Una fila detrás de otra, nunca en paralelo.
   *
   * En paralelo se ganaría mucho tiempo y se rompería la librería de íconos:
   * cada ícono generado entra en el manifiesto, y dos carruseles a la vez que
   * pidan el mismo concepto lo generarían dos veces y una escritura se comería
   * a la otra. Es la misma razón que en `scripts/mes.mjs`.
   */
  async function escribir() {
    parar.current = false;
    setTrabajando(true);
    setError(undefined);

    // Las fotos que ya se gastaron, para que dos carruseles del mismo mes no
    // salgan con la misma imagen. La ruta las devuelve y aquí se acumulan.
    let usadas: string[] = [];

    for (const fila of escogidas) {
      if (parar.current) break;
      setEstados((e) => ({ ...e, [fila.linea]: { fase: 'escribiendo', desde: Date.now() } }));

      try {
        const r = await fetch('/api/redactar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tema: fila.tema,
            slug: fila.slug,
            usadas,
            // Lo que decidiste tú en la hoja. El redactor escribe hacia esto y
            // no se lo inventa. Ver lib/redactar.ts.
            editorial: {
              pilar: fila.pilar,
              objetivo: fila.objetivo ?? undefined,
              nota: fila.nota,
              fecha: fila.fecha,
            },
          }),
        });
        const c = await r.json();
        if (!r.ok) throw new Error(c.error);
        usadas = c.usadas ?? usadas;

        const g = await fetch('/api/post', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ post: c.post }),
        });
        const guardado = await g.json();
        if (!g.ok) throw new Error(guardado.error);

        const afirmaciones = afirmacionesDe(c.post);
        setEstados((e) => ({
          ...e,
          [fila.linea]: {
            fase: 'hecho',
            afirmaciones: afirmaciones.length,
            seguridad: afirmaciones.filter((a) => a.disparadores.includes('seguridad')).length,
            paleta: c.post.paleta,
            avisos: c.avisos ?? [],
          },
        }));
      } catch (e) {
        // Uno que falla no se lleva la tanda: el siguiente sigue, y el que
        // falló se recupera volviendo a darle al botón.
        setEstados((e2) => ({
          ...e2,
          [fila.linea]: { fase: 'fallo', porque: e instanceof Error ? e.message : 'no se pudo' },
        }));
      }
    }

    setTrabajando(false);
    // El orden importa poco, pero las dos hacen falta: `refrescar` apaga las
    // filas que se acaban de escribir para que un segundo clic no las pise, y
    // `router.refresh` vuelve a pintar la lista de carruseles de la portada.
    await refrescar();
    router.refresh();
  }

  /* ── lo que se enseña ─────────────────────────────────────────────────── */

  const hechos = Object.values(estados).filter((e) => e.fase === 'hecho');
  const fallos = Object.values(estados).filter((e) => e.fase === 'fallo');
  const totalAfirmaciones = hechos.reduce((s, e) => s + (e.fase === 'hecho' ? e.afirmaciones : 0), 0);
  const totalSeguridad = hechos.reduce((s, e) => s + (e.fase === 'hecho' ? e.seguridad : 0), 0);
  const rotas = saltadas.filter((s) => !/reel|sin tema/.test(s.porque));
  const noCarrusel = saltadas.length - rotas.length;

  return (
    <details className="tarjeta" data-calendario>
      <summary>
        <span className="chip">calendario</span>
        <span className="tarjeta__titulo">Escribir varios desde el calendario</span>
      </summary>

      <div className="tarjeta__cuerpo">
        {/* ── el archivo ── */}
        <label
          className="soltar"
          data-encima={encima ? '' : undefined}
          onDragOver={(e) => {
            e.preventDefault();
            setEncima(true);
          }}
          onDragLeave={() => setEncima(false)}
          onDrop={(e) => {
            e.preventDefault();
            setEncima(false);
            const archivo = e.dataTransfer.files[0];
            if (archivo) void subir(archivo);
          }}
        >
          <input
            type="file"
            accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values"
            hidden
            onChange={(e) => {
              const archivo = e.target.files?.[0];
              if (archivo) void subir(archivo);
              e.target.value = '';
            }}
          />
          <strong>{hay ? 'Reemplazar el calendario' : 'Suelta aquí el calendario'}</strong>
          <span>
            CSV o TSV con las columnas <code>Fecha</code>, <code>Tema</code> y, si las tienes,{' '}
            <code>Día</code>, <code>Tipo</code>, <code>Pilar</code>, <code>Objetivo</code> y{' '}
            <code>Nota</code>. Se buscan por su nombre, así que el orden da igual.
          </span>
        </label>

        {error ? <p className="aviso">{error}</p> : null}

        {hay === false && !error ? (
          <p className="pista">
            Todavía no hay calendario. También se puede pegar la hoja directamente en{' '}
            <code>content/calendario.tsv</code>.
          </p>
        ) : null}

        {/* ── lo que la hoja tiene y no se va a escribir ── */}
        {filas.length > 0 ? (
          <p className="pista">
            <strong>{filas.length}</strong> carrusel(es) en la hoja
            {noCarrusel ? ` · ${noCarrusel} fila(s) que no lo son` : ''} ·{' '}
            <strong>{filas.length - faltan.length}</strong> ya escrito(s)
          </p>
        ) : null}

        {rotas.length ? (
          <ul className="avisos">
            {rotas.map((s) => (
              <li key={s.linea}>
                Línea {s.linea} «{s.tema}»: {s.porque}
              </li>
            ))}
          </ul>
        ) : null}

        {/* ── la lista ── */}
        {filas.length > 0 ? (
          <ol className="calendario">
            {filas.map((f) => {
              const estado = estados[f.linea];
              return (
                <li
                  key={f.linea}
                  data-hecho={f.hecho ? '' : undefined}
                  data-fase={estado?.fase}
                >
                  <label>
                    <input
                      type="checkbox"
                      disabled={Boolean(f.hecho) || trabajando || estado?.fase === 'hecho'}
                      checked={elegidas.has(f.linea)}
                      onChange={(e) =>
                        setElegidas((s) => {
                          const n = new Set(s);
                          if (e.target.checked) n.add(f.linea);
                          else n.delete(f.linea);
                          return n;
                        })
                      }
                    />
                    <span className="calendario__fecha">{f.fecha}</span>
                    <span className="calendario__tema">{f.tema}</span>
                  </label>

                  <span className="calendario__meta">
                    {f.pilar ? <em>{f.pilar}</em> : null}
                    {f.objetivo ? <b>{f.objetivo}</b> : null}
                    {f.nota ? <span>{f.nota}</span> : null}
                  </span>

                  {f.hecho ? (
                    <span className="calendario__estado">ya escrito · {f.hecho}</span>
                  ) : estado?.fase === 'escribiendo' ? (
                    <span className="calendario__estado" data-vivo>
                      escribiendo… {reloj((ahora - estado.desde) / 1000)}
                    </span>
                  ) : estado?.fase === 'hecho' ? (
                    <span className="calendario__estado">
                      {estado.paleta} · {estado.afirmaciones} por revisar
                      {estado.seguridad ? `, ${estado.seguridad} de seguridad` : ''}
                    </span>
                  ) : estado?.fase === 'fallo' ? (
                    <span className="calendario__estado" data-fallo>
                      {estado.porque}
                    </span>
                  ) : null}

                  {estado?.fase === 'hecho' && estado.avisos.length ? (
                    <ul className="avisos">
                      {estado.avisos.map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ol>
        ) : null}

        {/* ── el botón ── */}
        {faltan.length > 0 ? (
          <>
            <button
              className="boton"
              disabled={trabajando || escogidas.length === 0}
              onClick={() => void escribir()}
            >
              {trabajando
                ? `escribiendo ${hechos.length + fallos.length + 1} de ${escogidas.length}…`
                : escogidas.length === 0
                  ? 'Marca al menos uno'
                  : `Escribir ${escogidas.length}`}
            </button>

            {trabajando ? (
              <>
                <p className="pista">
                  Deja esta pestaña abierta. Cada carrusel se guarda en cuanto sale, así que si se
                  corta, lo escrito se queda y este panel vuelve a enseñar los que falten.
                </p>
                <button className="boton sm" onClick={() => (parar.current = true)}>
                  Parar al terminar este
                </button>
              </>
            ) : (
              <p className="pista">
                Unos dos minutos y medio cada uno: calcula{' '}
                <strong>{reloj(escogidas.length * POR_CARRUSEL)}</strong>. Salen como borrador y
                hay que revisarlos uno a uno.
              </p>
            )}
          </>
        ) : filas.length > 0 ? (
          <p className="pista">No falta ninguno del calendario.</p>
        ) : null}

        {/* ── el costo de verdad ── */}
        {!trabajando && hechos.length > 0 ? (
          <p className="pista">
            <strong>{hechos.length}</strong> escrito(s)
            {fallos.length ? `, ${fallos.length} sin escribir` : ''}. La cola quedó con{' '}
            <strong>{totalAfirmaciones}</strong> afirmación(es) por revisar
            {totalSeguridad ? (
              <>
                , de las cuales <strong>{totalSeguridad}</strong> son indicaciones de seguridad: esas
                las firma el doctor
              </>
            ) : null}
            . Ninguno se puede pasar de borrador hasta que estén revisadas.
          </p>
        ) : null}
      </div>
    </details>
  );
}
