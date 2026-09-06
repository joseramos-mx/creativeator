'use client';

import {
  OVERRIDES_DEMASIADOS,
  borrarSlide,
  cambiarSlide,
  contarOverrides,
  duplicarSlide,
  limpiarOverrides,
  moverSlide,
  nuevoSlide,
  tituloDeTarjeta,
} from '@/lib/edicion';
import type { Post, Slide } from '@/template/tipos';
import type { EstadoAjuste } from '@/template/usarAjuste';

export type Seleccion = { slide: number; parte: 'bloque' | 'titulo' | 'cuerpo' | 'media' };

type Props = {
  slide: Slide;
  indice: number;
  total: number;
  abierta: boolean;
  onAbrir: () => void;
  aviso?: EstadoAjuste;
  seleccion: Seleccion | null;
  onSeleccion: (s: Seleccion | null) => void;
  setPost: (f: (p: Post) => Post) => void;
};

export function PanelSlide({
  slide,
  indice,
  total,
  abierta,
  onAbrir,
  aviso,
  seleccion,
  onSeleccion,
  setPost,
}: Props) {
  const cambiar = (cambios: Partial<Slide>) => setPost((p) => cambiarSlide(p, indice, cambios));
  const overrides = contarOverrides(slide);

  return (
    <details className="tarjeta" open={abierta}>
      <summary
        onClick={(e) => {
          e.preventDefault();
          onAbrir();
        }}
      >
        <span className="chip">
          {indice === 0 ? 'portada' : indice === total - 1 ? 'cierre' : String(indice).padStart(2, '0')}
        </span>
        <span className="tarjeta__titulo">{tituloDeTarjeta(slide)}</span>
        {aviso?.tituloApretado || aviso?.cuerpoApretado ? <span className="punto" title="hay que recortar" /> : null}
        <span className="tarjeta__botones">
          <button className="boton sm" title="subir" onClick={() => setPost((p) => moverSlide(p, indice, -1))}>
            ↑
          </button>
          <button className="boton sm" title="bajar" onClick={() => setPost((p) => moverSlide(p, indice, 1))}>
            ↓
          </button>
          <button className="boton sm" title="duplicar" onClick={() => setPost((p) => duplicarSlide(p, indice))}>
            ⧉
          </button>
          <button className="boton sm" title="borrar" onClick={() => setPost((p) => borrarSlide(p, indice))}>
            ✕
          </button>
        </span>
      </summary>

      <div className="tarjeta__cuerpo">
        <Avisos aviso={aviso} slide={slide} />

        {slide.tipo === 'portada' ? (
          <>
            <label>Título — *itálica serif* y **negrita crema**</label>
            <textarea rows={2} value={slide.titulo} onChange={(e) => cambiar({ titulo: e.target.value } as Partial<Slide>)} />
            <label>Pregunta del papel rasgado</label>
            <input value={slide.pregunta} onChange={(e) => cambiar({ pregunta: e.target.value } as Partial<Slide>)} />
            <Imagen ruta={slide.foto} />
          </>
        ) : null}

        {slide.tipo === 'contenido' ? (
          <>
            <label>Título</label>
            <textarea rows={2} value={slide.titulo} onChange={(e) => cambiar({ titulo: e.target.value } as Partial<Slide>)} />
            <label>Bajada en negrita (opcional)</label>
            <textarea
              rows={2}
              value={slide.bajada ?? ''}
              onChange={(e) => cambiar({ bajada: e.target.value || undefined } as Partial<Slide>)}
            />
            <label>Cuerpo — de 35 a 55 palabras</label>
            <textarea rows={5} value={slide.cuerpo} onChange={(e) => cambiar({ cuerpo: e.target.value } as Partial<Slide>)} />

            <label>Elemento visual</label>
            <select
              value={slide.visual.clase}
              onChange={(e) => {
                const clase = e.target.value as 'ninguno' | 'foto' | 'icono';
                if (clase === 'ninguno') return cambiar({ visual: { clase: 'ninguno' } } as Partial<Slide>);
                if (clase === 'icono') return cambiar({ visual: { clase: 'icono', tam: 260 } } as Partial<Slide>);
                cambiar({ visual: { clase: 'foto', src: '/media/pendiente.jpg' } } as Partial<Slide>);
              }}
            >
              <option value="ninguno">ninguno</option>
              <option value="foto">foto</option>
              <option value="icono">ícono</option>
            </select>

            {slide.visual.clase === 'foto' ? (
              <>
                <Imagen ruta={slide.visual.src} />
                {slide.visual.ideaImagen ? <p className="pista">Buscar: “{slide.visual.ideaImagen}”</p> : null}
              </>
            ) : null}

            {slide.visual.clase === 'icono' ? (
              <>
                <div className="fila">
                  <div>
                    <label>Ícono (slug de public/iconos)</label>
                    <input
                      value={slide.visual.slug ?? ''}
                      onChange={(e) =>
                        cambiar({
                          visual: { ...slide.visual, slug: e.target.value || undefined },
                        } as Partial<Slide>)
                      }
                    />
                  </div>
                  <div style={{ flex: '0 0 92px' }}>
                    <label>Tamaño</label>
                    <input
                      value={slide.visual.tam ?? 260}
                      onChange={(e) =>
                        cambiar({
                          visual: { ...slide.visual, tam: Number(e.target.value) || 260 },
                        } as Partial<Slide>)
                      }
                    />
                  </div>
                </div>
                {!slide.visual.slug ? (
                  <p className="pista pista--aviso">
                    Falta elegir el ícono
                    {slide.visual.iconoSugerido ? ` (el brief sugiere “${slide.visual.iconoSugerido}”)` : ''}. El
                    buscador llega en la fase 5.
                  </p>
                ) : null}
              </>
            ) : null}

            <label>Emblema encima del título (slug, opcional)</label>
            <input
              value={slide.emblema?.slug ?? ''}
              onChange={(e) =>
                cambiar({ emblema: e.target.value ? { slug: e.target.value } : undefined } as Partial<Slide>)
              }
            />

            <label>Fuente citada</label>
            <input
              value={slide.fuente ?? ''}
              onChange={(e) => cambiar({ fuente: e.target.value || undefined } as Partial<Slide>)}
            />
          </>
        ) : null}

        {slide.tipo === 'lista' ? (
          <>
            <label>Título</label>
            <textarea rows={2} value={slide.titulo} onChange={(e) => cambiar({ titulo: e.target.value } as Partial<Slide>)} />
            <label>Puntos — uno por renglón, cuatro es el máximo cómodo</label>
            <textarea
              rows={6}
              value={slide.puntos.join('\n')}
              onChange={(e) =>
                cambiar({ puntos: e.target.value.split('\n').filter((p) => p.trim()) } as Partial<Slide>)
              }
            />
            <label>Fuente citada</label>
            <input
              value={slide.fuente ?? ''}
              onChange={(e) => cambiar({ fuente: e.target.value || undefined } as Partial<Slide>)}
            />
          </>
        ) : null}

        {slide.tipo === 'cierre' ? (
          <p className="pista">Este slide se arma solo con los datos de content/marca.json.</p>
        ) : null}

        {slide.tipo !== 'cierre' ? (
          <Ajustes
            slide={slide}
            indice={indice}
            overrides={overrides}
            seleccion={seleccion}
            onSeleccion={onSeleccion}
            setPost={setPost}
          />
        ) : null}

        <button className="boton" onClick={() => setPost((p) => nuevoSlide(p, indice))}>
          + slide debajo
        </button>
      </div>
    </details>
  );
}

/**
 * El aviso del ajuste automático.
 *
 * Dice lo que hay que hacer, no lo que pasó. "Se encogió la letra" describe el
 * síntoma y deja al usuario sin saber qué hacer; el problema real es que el
 * texto es más largo de lo que cabe, y la solución es recortarlo.
 */
function Avisos({ aviso, slide }: { aviso?: EstadoAjuste; slide: Slide }) {
  if (!aviso?.tituloApretado && !aviso?.cuerpoApretado) return null;

  const cuerpo = slide.tipo === 'lista' ? 'los puntos' : 'el cuerpo';
  const que = [aviso.tituloApretado && 'el título', aviso.cuerpoApretado && cuerpo]
    .filter(Boolean)
    .join(' y ');

  return (
    <p className="aviso">
      Hay que recortar {que}: ya no cabe ni en el tamaño mínimo. Encogerlo más lo vuelve ilegible en
      un teléfono.
    </p>
  );
}

/** El modo de empuje y el contador de ajustes a mano. */
function Ajustes({
  slide,
  indice,
  overrides,
  seleccion,
  onSeleccion,
  setPost,
}: {
  slide: Slide;
  indice: number;
  overrides: number;
  seleccion: Seleccion | null;
  onSeleccion: (s: Seleccion | null) => void;
  setPost: (f: (p: Post) => Post) => void;
}) {
  if (slide.tipo === 'cierre') return null;
  const detalle = slide.overrides
    ? Object.entries(slide.overrides)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${k} ${v}`)
        .join(' · ')
    : '';

  return (
    <div className="ajustes">
      <div className="fila">
        {(['bloque', 'titulo', 'cuerpo', 'media'] as const).map((parte) => (
          <button
            key={parte}
            className="boton sm"
            aria-pressed={seleccion?.parte === parte}
            onClick={() => onSeleccion(seleccion?.parte === parte ? null : { slide: indice, parte })}
          >
            {parte}
          </button>
        ))}
      </div>

      {overrides === 0 ? (
        <p className="pista">Sin ajustes a mano: este slide sale tal cual lo dice la plantilla.</p>
      ) : (
        <>
          <p className="pista">
            {overrides === 1 ? '1 ajuste a mano' : `${overrides} ajustes a mano`} · {detalle}
          </p>
          {overrides >= OVERRIDES_DEMASIADOS ? (
            <p className="aviso">
              Este slide ya junta {overrides} ajustes a mano. Si te pasa en varios slides, lo que está
              mal es el valor de la plantilla, no este slide: súbelo a template/tokens.ts.
            </p>
          ) : null}
          <button className="boton" onClick={() => setPost((p) => limpiarOverrides(p, indice))}>
            quitar los ajustes
          </button>
        </>
      )}
    </div>
  );
}

function Imagen({ ruta }: { ruta?: string }) {
  return (
    <p className="pista">
      {ruta && ruta !== '/media/pendiente.jpg' ? (
        <>
          Imagen: <code>{ruta}</code>
        </>
      ) : (
        'Sin imagen.'
      )}{' '}
      Arrástrala sobre el slide de la derecha para cambiarla.
    </p>
  );
}
