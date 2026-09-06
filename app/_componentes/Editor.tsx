'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { BotonExportar } from './BotonExportar';
import { ImportarBrief } from './ImportarBrief';
import { PanelSlide, type Seleccion } from './PanelSlide';
import {
  aceptaImagen,
  cambiarTamIcono,
  empujarOverride,
  ponerImagen,
} from '@/lib/edicion';
import { Slide } from '@/template/Slide';
import { ProveedorDeAvisos } from '@/template/avisos';
import { bloque, lienzo, paletas, tipo } from '@/template/tokens';
import type { Marca, Post } from '@/template/tipos';
import type { EstadoAjuste } from '@/template/usarAjuste';

const DESARROLLO = process.env.NODE_ENV === 'development';
const RETRASO_GUARDADO = 600;

type EstadoGuardado = 'limpio' | 'guardando' | 'guardado' | 'error';

/**
 * El editor: formulario a la izquierda, carrusel a la derecha.
 *
 * Cuatro cosas hacen la diferencia en el uso diario, y son las que están
 * resueltas aquí:
 *
 *  · La imagen se suelta sobre el slide, no sobre un campo del formulario. Es
 *    el gesto natural y ahorra la mitad de los clics.
 *  · No hay botón de guardar. Se guarda solo, 600 ms después de la última tecla.
 *  · Cuando el ajuste automático tocó el mínimo, el aviso dice que hay que
 *    recortar el texto, que es lo que hay que hacer, y no que se encogió, que
 *    es lo que pasó.
 *  · Las flechas empujan el slide y escriben en `overrides`, con un contador
 *    que avisa cuando un slide junta demasiados ajustes a mano.
 */
export function Editor({ inicial, marca, capturas }: { inicial: Post; marca: Marca; capturas?: string[] }) {
  const [post, setPost] = useState<Post>(inicial);
  const [guardado, setGuardado] = useState<EstadoGuardado>('limpio');
  const [errorGuardado, setErrorGuardado] = useState<string>();
  const [avisos, setAvisos] = useState<Record<number, EstadoAjuste>>({});
  const [seleccion, setSeleccion] = useState<Seleccion | null>(null);
  const [abierta, setAbierta] = useState<number | null>(0);
  const [rejilla, setRejilla] = useState(false);
  const [overlay, setOverlay] = useState(false);
  const [zoom, setZoom] = useState(0.42);
  const [soltando, setSoltando] = useState<number | null>(null);
  // Los recientes se llevan en el editor y no en el servidor: si solo se leyeran
  // al cargar la página, el ícono que acabas de usar no aparecería arriba hasta
  // la siguiente recarga, que es justo cuando ya no te sirve.
  const [recientes, setRecientes] = useState<string[]>(marca.iconosRecientes ?? []);
  const [subiendo, setSubiendo] = useState<number | null>(null);

  // ── guardado automático, sin botón ───────────────────────────────────────
  const primera = useRef(true);
  useEffect(() => {
    if (primera.current) {
      primera.current = false;
      return;
    }
    setGuardado('guardando');
    const t = setTimeout(async () => {
      try {
        const r = await fetch('/api/post', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ post }),
        });
        if (!r.ok) throw new Error((await r.json()).error ?? 'No se pudo guardar.');
        setGuardado('guardado');
        setErrorGuardado(undefined);
      } catch (e) {
        setGuardado('error');
        setErrorGuardado(e instanceof Error ? e.message : 'No se pudo guardar.');
      }
    }, RETRASO_GUARDADO);
    return () => clearTimeout(t);
  }, [post]);

  const reportarAjuste = useCallback((i: number, estado: EstadoAjuste) => {
    setAvisos((prev) => {
      const antes = prev[i];
      if (
        antes &&
        antes.tituloApretado === estado.tituloApretado &&
        antes.cuerpoApretado === estado.cuerpoApretado
      ) {
        return prev;
      }
      return { ...prev, [i]: estado };
    });
  }, []);

  // ── soltar una imagen encima del slide ───────────────────────────────────
  const subirImagen = useCallback(
    async (i: number, archivo: File) => {
      if (!aceptaImagen(post.slides[i])) return;
      setSubiendo(i);
      try {
        const datos = new FormData();
        datos.append('archivo', archivo);
        datos.append('slug', post.slug);
        const r = await fetch('/api/subir', { method: 'POST', body: datos });
        const cuerpo = await r.json();
        if (!r.ok) throw new Error(cuerpo.error);
        setPost((p) => ponerImagen(p, i, cuerpo.ruta));
      } catch (e) {
        setErrorGuardado(e instanceof Error ? e.message : 'No se pudo subir la imagen.');
        setGuardado('error');
      } finally {
        setSubiendo(null);
      }
    },
    [post.slides, post.slug],
  );

  const usarIcono = useCallback((slug: string) => {
    setRecientes((prev) => [slug, ...prev.filter((s) => s !== slug)].slice(0, 12));
    // Se apunta en content/marca.json sin esperar: si falla, no se pierde nada.
    void fetch('/api/recientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug }),
    });
  }, []);

  // Sin esto, soltar fuera de un slide hace que el navegador abra la imagen y
  // se pierda lo que no se hubiera guardado todavía.
  useEffect(() => {
    const parar = (e: DragEvent) => e.preventDefault();
    window.addEventListener('dragover', parar);
    window.addEventListener('drop', parar);
    return () => {
      window.removeEventListener('dragover', parar);
      window.removeEventListener('drop', parar);
    };
  }, []);

  // ── atajos: rejilla, referencia y el modo de empuje ──────────────────────
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      const objetivo = e.target as HTMLElement | null;
      if (objetivo && /^(INPUT|TEXTAREA|SELECT)$/.test(objetivo.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const k = e.key;
      if (k.toLowerCase() === 'g') return setRejilla((v) => !v);
      if (k.toLowerCase() === 'r' && capturas) return setOverlay((v) => !v);
      if (k === 'Escape') return setSeleccion(null);
      if (!DESARROLLO || !seleccion) return;

      const paso = e.shiftKey ? 10 : 1;
      const i = seleccion.slide;
      const slide = post.slides[i];
      if (slide.tipo === 'cierre') return;

      const esPortada = slide.tipo === 'portada';
      const baseTitulo = esPortada ? tipo.tituloPortada.px : tipo.titulo.px;
      const baseCuerpo = slide.tipo === 'lista' ? tipo.punto.px : tipo.cuerpo.px;

      const empujar = (campo: Parameters<typeof empujarOverride>[2], delta: number, base: number, min?: number) => {
        e.preventDefault();
        setPost((p) => empujarOverride(p, i, campo, delta, { base, min }));
      };

      if (k === 'ArrowUp' || k === 'ArrowDown') {
        const signo = k === 'ArrowUp' ? -1 : 1;
        if (seleccion.parte === 'media' && esFoto(slide)) {
          return empujar('mediaAlto', signo * paso, bloque.mediaAlto, 60);
        }
        return empujar('offsetY', signo * paso, 0);
      }

      if (k === '+' || k === '=' || k === '-') {
        const signo = k === '-' ? -1 : 1;
        if (seleccion.parte === 'titulo') return empujar('tituloPx', signo * paso, baseTitulo, 20);
        if (seleccion.parte === 'cuerpo') return empujar('cuerpoPx', signo * paso, baseCuerpo, 16);
        if (seleccion.parte === 'media') {
          if (esFoto(slide)) return empujar('mediaAncho', signo * paso, bloque.mediaAncho, 100);
          e.preventDefault();
          // El tamaño del ícono es contenido, no una excepción de maquetación.
          return setPost((p) => cambiarTamIcono(p, i, signo * paso));
        }
      }
    };

    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [seleccion, post.slides, capturas]);

  const leyenda = useMemo(() => {
    if (guardado === 'guardando') return 'guardando…';
    if (guardado === 'guardado') return 'guardado';
    if (guardado === 'error') return errorGuardado ?? 'no se pudo guardar';
    return `${post.slides.length} slides · ${post.estado}`;
  }, [guardado, errorGuardado, post.slides.length, post.estado]);

  return (
    <div className="editor">
      <aside className="panel">
        <div className="panel__cabecera">
          <Link className="boton" href="/">
            ← carruseles
          </Link>
          <span className="sep" />
          <span className="estado" data-estado={guardado}>
            {leyenda}
          </span>
        </div>

        <Ficha post={post} setPost={setPost} />
        <ImportarBrief slug={post.slug} onImportar={(nuevo) => setPost(nuevo)} />

        {post.slides.map((slide, i) => (
          <PanelSlide
            key={i}
            slide={slide}
            recientes={recientes}
            paleta={post.paleta}
            onUsarIcono={usarIcono}
            indice={i}
            total={post.slides.length}
            abierta={abierta === i}
            onAbrir={() => setAbierta(abierta === i ? null : i)}
            aviso={avisos[i]}
            seleccion={seleccion?.slide === i ? seleccion : null}
            onSeleccion={setSeleccion}
            setPost={setPost}
          />
        ))}
      </aside>

      <main className="lienzo">
        <div className="lienzo__barra">
          <button className="boton" aria-pressed={rejilla} onClick={() => setRejilla((v) => !v)}>
            <kbd className="tecla">G</kbd> rejilla
          </button>
          {capturas ? (
            <button className="boton" aria-pressed={overlay} onClick={() => setOverlay((v) => !v)}>
              <kbd className="tecla">R</kbd> referencia
            </button>
          ) : null}
          {[0.28, 0.42, 0.6, 1].map((z) => (
            <button key={z} className="boton" aria-pressed={zoom === z} onClick={() => setZoom(z)}>
              {Math.round(z * 100)}%
            </button>
          ))}
          <span className="sep" />
          {DESARROLLO && seleccion ? (
            <span className="pista">
              {seleccion.parte} del {String(seleccion.slide).padStart(2, '0')} ·{' '}
              <kbd className="tecla">↑</kbd>
              <kbd className="tecla">↓</kbd> mover · <kbd className="tecla">+</kbd>
              <kbd className="tecla">−</kbd> tamaño · <kbd className="tecla">esc</kbd> soltar
            </span>
          ) : DESARROLLO ? (
            <span className="pista">Haz clic en un título, un texto o una imagen para empujarlo.</span>
          ) : null}
          <BotonExportar slug={post.slug} slides={post.slides.length} />
        </div>

        <ProveedorDeAvisos reportar={reportarAjuste}>
          <div className="mazo">
            {post.slides.map((slide, i) => (
              <div
                className="marco marco--soltable"
                key={i}
                data-soltando={soltando === i ? '' : undefined}
                data-subiendo={subiendo === i ? '' : undefined}
                style={{ width: lienzo.ancho * zoom, height: lienzo.alto * zoom }}
                onDragOver={(e) => {
                  if (!aceptaImagen(slide)) return;
                  e.preventDefault();
                  setSoltando(i);
                }}
                onDragLeave={() => setSoltando((s) => (s === i ? null : s))}
                onDrop={(e) => {
                  e.preventDefault();
                  setSoltando(null);
                  const archivo = e.dataTransfer.files?.[0];
                  if (archivo) void subirImagen(i, archivo);
                }}
              >
                <span className="etiqueta">
                  {i === 0 ? 'portada' : i === post.slides.length - 1 ? 'cierre' : String(i).padStart(2, '0')}
                  {subiendo === i ? ' · subiendo…' : ''}
                  {soltando === i ? ' · suelta aquí' : ''}
                </span>

                <div
                  className="marco__lienzo"
                  /* A 100 % no se aplica transform: una capa de composición cambia el
                     antialias del texto, y la exportación se verifica píxel a píxel
                     contra esta misma vista. */
                  style={zoom === 1 ? undefined : { transform: `scale(${zoom})`, width: lienzo.ancho }}
                  onClick={(e) => {
                    if (!DESARROLLO || slide.tipo === 'cierre') return;
                    setSeleccion({ slide: i, parte: parteTocada(e.target as HTMLElement) });
                  }}
                >
                  <Slide
                    slides={post.slides}
                    indice={i}
                    marca={marca}
                    paleta={post.paleta}
                    ayudas={{ rejilla, overlay: overlay ? capturas?.[i] : undefined }}
                  />
                </div>
              </div>
            ))}
          </div>
        </ProveedorDeAvisos>
      </main>
    </div>
  );
}

/** Qué bloque del slide se tocó, para saber qué empujan las teclas. */
function parteTocada(el: HTMLElement): Seleccion['parte'] {
  if (el.closest('.titulo')) return 'titulo';
  if (el.closest('.cuerpo, .bajada, .lista')) return 'cuerpo';
  if (el.closest('.media, .icono, .emblema')) return 'media';
  return 'bloque';
}

function esFoto(slide: Post['slides'][number]) {
  return slide.tipo === 'contenido' && slide.visual.clase === 'foto';
}

/** Los datos del carrusel que no se pintan en ningún slide. */
function Ficha({ post, setPost }: { post: Post; setPost: (f: (p: Post) => Post) => void }) {
  const [copiado, setCopiado] = useState(false);

  return (
    <details className="tarjeta" open>
      <summary>
        <span className="chip">ficha</span>
        <span className="tarjeta__titulo">{post.tema}</span>
      </summary>
      <div className="tarjeta__cuerpo">
        <label>Tema</label>
        <input value={post.tema} onChange={(e) => setPost((p) => ({ ...p, tema: e.target.value }))} />

        <div className="fila">
          <div>
            <label>Estado</label>
            <select
              value={post.estado}
              onChange={(e) => setPost((p) => ({ ...p, estado: e.target.value as Post['estado'] }))}
            >
              <option value="borrador">borrador</option>
              <option value="aprobado">aprobado</option>
              <option value="publicado">publicado</option>
            </select>
          </div>
          <div>
            <label>Paleta</label>
            <select
              value={post.paleta}
              onChange={(e) => setPost((p) => ({ ...p, paleta: e.target.value as Post['paleta'] }))}
            >
              {Object.entries(paletas).map(([nombre, p]) => (
                <option key={nombre} value={nombre}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Pilar — la línea editorial</label>
            <input
              value={post.pilar ?? ''}
              onChange={(e) => setPost((p) => ({ ...p, pilar: e.target.value || undefined }))}
            />
          </div>
        </div>

        <p className="pista">{paletas[post.paleta].cuando}</p>

        <label>Objetivo — la acción buscada</label>
        <input
          value={post.objetivo ?? ''}
          onChange={(e) => setPost((p) => ({ ...p, objetivo: e.target.value || undefined }))}
        />

        <label>Nota — el gancho de calendario</label>
        <input
          value={post.nota ?? ''}
          onChange={(e) => setPost((p) => ({ ...p, nota: e.target.value || undefined }))}
        />

        <label>Hashtags {post.hashtags?.length ? `(${post.hashtags.length})` : ''}</label>
        <input
          value={post.hashtags?.join(' ') ?? ''}
          onChange={(e) =>
            setPost((p) => ({
              ...p,
              hashtags: e.target.value.trim() ? e.target.value.split(/\s+/) : undefined,
            }))
          }
        />

        <label>Copy — el texto que va debajo del carrusel</label>
        <textarea
          rows={10}
          value={post.copy ?? ''}
          onChange={(e) => setPost((p) => ({ ...p, copy: e.target.value || undefined }))}
        />
        <button
          className="boton"
          onClick={async () => {
            await navigator.clipboard.writeText(post.copy ?? '');
            setCopiado(true);
            setTimeout(() => setCopiado(false), 1500);
          }}
        >
          {copiado ? 'copiado' : 'copiar el copy'}
        </button>
      </div>
    </details>
  );
}
