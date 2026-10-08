'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { SEPARACION_MINIMA, buscar, crearBuscador, separacion, type Icono } from '@/lib/iconos';
import { paletaDe, type NombrePaleta } from '@/plantillas/clinica/tokens';
import { guardarVariante, variantesDe, type Variante } from './generarIcono';

/**
 * El buscador de íconos: un modal con campo de búsqueda y rejilla de
 * miniaturas.
 *
 * El manifiesto se carga una sola vez y se queda en memoria del módulo. Diez
 * mil entradas son unos cientos de kilobytes; volver a pedirlo cada vez que se
 * abre el modal sería trabajo de más para nada.
 */
let cache: Promise<Icono[]> | null = null;

function cargarManifiesto() {
  // Por /archivo y no por /iconos: en Vercel, /iconos/manifest.json es el del
  // último build y no trae los íconos generados después. Ver lib/servir.ts.
  cache ??= fetch('/archivo/iconos/manifest.json', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => [] as Icono[]);
  return cache;
}

/** Después de guardar un ícono nuevo: que el próximo modal lo vea. */
export function olvidarManifiesto() {
  cache = null;
}

export function BuscadorIconos({
  sugerencia,
  recientes,
  paleta,
  fondo: fondoDeLaCuenta,
  onElegir,
  onCerrar,
}: {
  /** Lo que propuso el brief o la IA, para no empezar con la caja vacía. */
  sugerencia?: string;
  recientes: string[];
  /** La del post: los íconos se marcan contra su fondo, no contra el azul. */
  paleta: NombrePaleta;
  /** El color real del fondo, si la cuenta tiene el suyo. */
  fondo?: string;
  onElegir: (slug: string) => void;
  onCerrar: () => void;
}) {
  const fondo = fondoDeLaCuenta ?? paletaDe(paleta).fondo;
  const [manifiesto, setManifiesto] = useState<Icono[] | null>(null);
  const [consulta, setConsulta] = useState(sugerencia ?? '');
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    cargarManifiesto().then(setManifiesto);
    campo.current?.focus();
    campo.current?.select();
  }, []);

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar();
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [onCerrar]);

  const fuse = useMemo(() => (manifiesto ? crearBuscador(manifiesto) : null), [manifiesto]);

  const { resultados, sinCoincidencias } = useMemo(() => {
    if (!manifiesto) return { resultados: [] as Icono[], sinCoincidencias: false };

    // Sin búsqueda: primero los recientes, y detrás el resto de la librería.
    const porSlug = new Map(manifiesto.map((i) => [i.slug, i]));
    const todos = [
      ...(recientes.map((s) => porSlug.get(s)).filter(Boolean) as Icono[]),
      ...manifiesto.filter((i) => !recientes.includes(i.slug)),
    ];

    if (!consulta.trim()) return { resultados: todos, sinCoincidencias: false };

    const encontrados = fuse ? buscar(fuse, consulta) : [];
    // Si la búsqueda no da nada, se enseña la librería igual. El concepto que
    // sugirió el brief casi nunca está tal cual —proponía "magnifying glass" y
    // se publicó otra cosa—, y abrir en una rejilla vacía no ayuda a nadie.
    return encontrados.length
      ? { resultados: encontrados, sinCoincidencias: false }
      : { resultados: todos, sinCoincidencias: true };
  }, [manifiesto, fuse, consulta, recientes]);

  // Generar: para lo que la librería no tiene. Es la librería de todas las
  // cuentas, así que lo que se genere aquí lo encuentran las demás.
  const [generando, setGenerando] = useState(false);
  const [guardando, setGuardando] = useState<number | null>(null);
  const [generados, setGenerados] = useState<{ concepto: string; modelo: string; variantes: Variante[] } | null>(null);
  const [errorGenerar, setErrorGenerar] = useState<string>();

  async function generar() {
    const concepto = consulta.trim() || sugerencia?.trim() || '';
    if (concepto.length < 3) {
      setErrorGenerar('Escribe qué ícono quieres, mejor en inglés: «knitted baby bootie», «saline nasal spray».');
      return;
    }
    setGenerando(true);
    setErrorGenerar(undefined);
    try {
      setGenerados({ concepto, ...(await variantesDe(concepto, 2)) });
    } catch (e) {
      setErrorGenerar(e instanceof Error ? e.message : 'No se pudo generar.');
    } finally {
      setGenerando(false);
    }
  }

  async function usarGenerado(i: number) {
    if (!generados) return;
    setGuardando(i);
    setErrorGenerar(undefined);
    try {
      const slug = await guardarVariante(generados.variantes[i].png, generados.concepto, generados.modelo);
      olvidarManifiesto();
      onElegir(slug);
    } catch (e) {
      setErrorGenerar(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setGuardando(null);
    }
  }

  const hayRecientes = (!consulta.trim() || sinCoincidencias) && recientes.length > 0;

  return (
    <div className="modal" onClick={onCerrar}>
      <div className="modal__caja" onClick={(e) => e.stopPropagation()}>
        <div className="modal__cabecera">
          <input
            ref={campo}
            value={consulta}
            placeholder="lupa, estetoscopio, termómetro…"
            onChange={(e) => setConsulta(e.target.value)}
          />
          <button className="boton" onClick={onCerrar}>
            cerrar
          </button>
        </div>

        <div className="generar-icono" data-generar-icono>
          <button className="boton" onClick={() => void generar()} disabled={generando || guardando !== null}>
            {generando ? 'Generando… (unos 20 s)' : `Generar con IA${consulta.trim() ? ` «${consulta.trim()}»` : ''}`}
          </button>
          <span className="pista">Dos opciones con el estilo de la librería; la que elijas se queda para todas las cuentas.</span>
          {errorGenerar ? <p className="aviso">{errorGenerar}</p> : null}
          {generados ? (
            <div className="rejilla-iconos">
              {generados.variantes.map((v, i) => (
                <button
                  key={i}
                  className="icono-opcion"
                  disabled={guardando !== null}
                  title={v.aviso}
                  onClick={() => void usarGenerado(i)}
                >
                  <span className="icono-opcion__fondo" style={{ background: fondo }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`data:image/png;base64,${v.png}`} alt="" />
                  </span>
                  <span>{guardando === i ? 'guardando…' : 'usar esta'}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {sugerencia && consulta === sugerencia ? (
          <p className="pista">
            El brief sugería “{sugerencia}”. Búscalo en español si no aparece nada.
          </p>
        ) : null}

        {manifiesto === null ? (
          <p className="pista">Cargando la librería…</p>
        ) : manifiesto.length === 0 ? (
          <p className="aviso">
            No hay manifiesto todavía. Corre <code>npm run iconos</code> apuntando a la carpeta
            donde tengas los PNG, o deja caer uno en <code>iconos-entrada/</code> con el servidor
            corriendo.
          </p>
        ) : (
          <>
            <p className={sinCoincidencias ? 'pista pista--aviso' : 'pista'}>
              {sinCoincidencias ? (
                <>Nada con “{consulta}”. Te dejo la librería completa · </>
              ) : null}
              {hayRecientes ? 'recientes primero · ' : ''}
              {resultados.length} de {manifiesto.length} íconos
            </p>
            <div className="rejilla-iconos">
              {resultados.map((icono) => (
                <Opcion key={icono.slug} icono={icono} fondo={fondo} onElegir={onElegir} />
              ))}
            </div>
            {sinCoincidencias ? (
              <p className="pista">
                Si la palabra que buscas debería encontrar algo, agrégala a{' '}
                <code>compartido/sinonimos.json</code> y vuelve a correr <code>npm run iconos</code>.
              </p>
            ) : null}
            <p className="pista">
              Los marcados en ámbar se funden con el fondo de esta paleta. Se pueden usar, pero
              van a leerse mal en el teléfono.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Una opción de la rejilla, sobre el fondo de la paleta del post.
 *
 * La miniatura se pinta encima de ese fondo a propósito: es la única forma de
 * ver si el ícono se despega antes de elegirlo, y sale gratis.
 */
function Opcion({
  icono,
  fondo,
  onElegir,
}: {
  icono: Icono;
  fondo: string;
  onElegir: (slug: string) => void;
}) {
  const sep = separacion(icono, fondo);
  const flojo = sep !== null && sep < SEPARACION_MINIMA;

  return (
    <button
      className="icono-opcion"
      data-flojo={flojo ? '' : undefined}
      title={
        `${icono.nombre}
${icono.etiquetas.join(' · ')}` +
        (sep !== null ? `
separación del fondo: ${Math.round(sep)}` : '')
      }
      onClick={() => onElegir(icono.slug)}
    >
      <span className="icono-opcion__fondo" style={{ background: fondo }}>
        <img src={`/iconos/thumbs/${icono.slug}.png`} alt="" loading="lazy" />
      </span>
      <span>{icono.slug}</span>
    </button>
  );
}
