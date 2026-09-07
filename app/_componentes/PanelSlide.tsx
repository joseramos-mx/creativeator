'use client';

import { useState } from 'react';
import { BuscadorClinicas } from './BuscadorClinicas';
import { BuscadorFotos } from './BuscadorFotos';
import { BuscadorIconos } from './BuscadorIconos';
import {
  FOTO_PENDIENTE,
  OVERRIDES_DEMASIADOS,
  borrarSlide,
  cambiarSlide,
  contarOverrides,
  duplicarSlide,
  limpiarOverrides,
  moverSlide,
  nuevoSlide,
  ponerClinica,
  ponerFotoDeBanco,
  tituloDeTarjeta,
} from '@/lib/edicion';
import type { NombrePaleta } from '@/template/tokens';
import type { Credito, Post, Slide } from '@/template/tipos';
import type { EstadoAjuste } from '@/template/usarAjuste';

export type Seleccion = { slide: number; parte: 'bloque' | 'titulo' | 'cuerpo' | 'media' };

type Props = {
  slide: Slide;
  /** El slug del post: la búsqueda de fotos lo necesita para guardar. */
  slug: string;
  /** El nombre del médico: el único que firma una imagen clínica. */
  medico: string;
  /** Los últimos íconos usados, de content/marca.json. */
  recientes: string[];
  /** La paleta del post: decide qué íconos se funden con el fondo. */
  paleta: NombrePaleta;
  onUsarIcono: (slug: string) => void;
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
  slug,
  medico,
  recientes,
  paleta,
  onUsarIcono,
  indice,
  total,
  abierta,
  onAbrir,
  aviso,
  seleccion,
  onSeleccion,
  setPost,
}: Props) {
  const [buscando, setBuscando] = useState(false);
  const cambiar = (cambios: Partial<Slide>) => setPost((p) => cambiarSlide(p, indice, cambios));
  const overrides = contarOverrides(slide);

  // `icono` y no `slug`: ahora el panel recibe el slug del post como prop y dos
  // cosas distintas con el mismo nombre en el mismo archivo se confunden.
  const elegirIcono = (icono: string) => {
    if (slide.tipo !== 'contenido' || slide.visual.clase !== 'icono') return;
    cambiar({ visual: { ...slide.visual, slug: icono } } as Partial<Slide>);
    setBuscando(false);
    onUsarIcono(icono);
  };

  return (
    <details className="tarjeta" data-slide={indice} open={abierta}>
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
          <button
            className="boton sm"
            title="borrar"
            onClick={() => {
              // Con confirmación a propósito: los otros tres botones son
              // reversibles de un vistazo y este no. Un clic perdido en la
              // cabecera de la tarjeta llegó a tirar un slide ya publicado.
              if (confirm(`¿Borrar el slide ${indice}? Esto no se deshace.`)) {
                setPost((p) => borrarSlide(p, indice));
              }
            }}
          >
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

            {/* La portada es la que más se ve y era la única sin buscador: su
                foto había que arrastrarla a mano. El crédito se escribe en el
                mismo movimiento, igual que en los slides de contenido. */}
            <BuscadorFotos
              slug={slug}
              indice={indice}
              onElegir={(ruta, credito) =>
                cambiar({ foto: ruta, fotoCredito: credito } as Partial<Slide>)
              }
            />

            {slide.foto ? (
              <CamposCredito
                credito={slide.fotoCredito}
                cambiar={(fotoCredito) => cambiar({ fotoCredito } as Partial<Slide>)}
              />
            ) : null}
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
                cambiar({ visual: { clase: 'foto', src: FOTO_PENDIENTE } } as Partial<Slide>);
              }}
            >
              <option value="ninguno">ninguno</option>
              <option value="foto">foto</option>
              <option value="icono">ícono</option>
            </select>

            {slide.visual.clase === 'foto' ? (
              <>
                <Imagen ruta={slide.visual.src} />
                {/* La idea de imagen es lo que habría cazado la foto del gimnasio:
                    dice qué debería mostrar el slide. Va como campo y no como
                    nota al pie porque hay que poder corregir lo que escribió la
                    IA, y porque un campo se lee y una nota al pie no. */}
                <label>Qué debería mostrar esta imagen</label>
                <input
                  value={slide.visual.ideaImagen ?? ''}
                  placeholder="niño con costras color miel alrededor de la boca"
                  onChange={(e) =>
                    cambiar({
                      visual: { ...slide.visual, ideaImagen: e.target.value || undefined },
                    } as Partial<Slide>)
                  }
                />

                {slide.visual.clinica ? (
                  <p className="pista pista--clinico">
                    Imagen clínica
                    {slide.visual.aprobacion
                      ? `, aprobada por ${slide.visual.aprobacion.aprobadaPor} el ${slide.visual.aprobacion.fecha}.`
                      : ' sin aprobar: el carrusel no puede salir de borrador.'}
                  </p>
                ) : null}

                <BuscadorFotos
                  slug={slug}
                  indice={indice}
                  onElegir={(ruta, credito) =>
                    setPost((p) => ponerFotoDeBanco(p, indice, ruta, credito))
                  }
                />

                <BuscadorClinicas
                  slug={slug}
                  indice={indice}
                  medico={medico}
                  onAprobar={(ruta, credito, aprobacion) =>
                    setPost((p) => ponerClinica(p, indice, ruta, credito, aprobacion))
                  }
                />

                <CamposCredito
                  credito={slide.visual.credito}
                  cambiar={(credito) =>
                    cambiar({ visual: { ...slide.visual, credito } } as Partial<Slide>)
                  }
                />
              </>
            ) : null}

            {slide.visual.clase === 'icono' ? (
              <>
                <div className="fila">
                  <div>
                    <label>Ícono</label>
                    <button className="boton" onClick={() => setBuscando(true)}>
                      {slide.visual.slug ? `cambiar · ${slide.visual.slug}` : 'buscar ícono…'}
                    </button>
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
                    {slide.visual.iconoSugerido ? ` · el brief sugiere “${slide.visual.iconoSugerido}”` : ''}.
                  </p>
                ) : null}

                {buscando ? (
                  <BuscadorIconos
                    sugerencia={slide.visual.iconoSugerido}
                    recientes={recientes}
                    paleta={paleta}
                    onElegir={elegirIcono}
                    onCerrar={() => setBuscando(false)}
                  />
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
          <>
            <label>Línea grande (opcional) — acepta *itálica* y **negrita**</label>
            <textarea
              rows={2}
              value={slide.frase ?? ''}
              onChange={(e) => cambiar({ frase: e.target.value || undefined } as Partial<Slide>)}
            />
            <p className="pista">
              Lo demás de este slide se arma solo con los datos de content/marca.json.
            </p>
          </>
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
      {ruta && ruta !== FOTO_PENDIENTE ? (
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

/**
 * De dónde salió la foto y bajo qué términos.
 *
 * Se pregunta aquí, cuando la foto se pone, porque es el único momento en que
 * alguien lo sabe. Un mes después, mirando el JSON, ya nadie se acuerda de si
 * esa imagen era de banco, del consultorio o de una búsqueda.
 *
 * El crédito llega al JSON solo cuando están la fuente y la licencia. Uno a
 * medias es peor que ninguno: parece registrado y no dice lo que hace falta.
 */
function CamposCredito({
  credito,
  cambiar,
}: {
  credito?: Credito;
  cambiar: (c: Credito | undefined) => void;
}) {
  const [c, setC] = useState<Partial<Credito>>(credito ?? {});

  const poner = (campo: keyof Credito, valor: Credito[keyof Credito]) => {
    const nuevo = { ...c, [campo]: valor || undefined };
    setC(nuevo);
    cambiar(nuevo.fuente && nuevo.licencia ? (nuevo as Credito) : undefined);
  };

  const aMedias = Boolean(c.fuente) !== Boolean(c.licencia);

  return (
    <>
      <div className="fila">
        <div>
          <label>De dónde salió</label>
          <input
            value={c.fuente ?? ''}
            placeholder="Unsplash, consultorio…"
            onChange={(e) => poner('fuente', e.target.value)}
          />
        </div>
        <div>
          <label>Licencia</label>
          <input
            value={c.licencia ?? ''}
            placeholder="Unsplash License, propia…"
            onChange={(e) => poner('licencia', e.target.value)}
          />
        </div>
      </div>

      {aMedias ? (
        <p className="pista pista--aviso">
          Faltan las dos para que el crédito se guarde: {c.fuente ? 'la licencia' : 'de dónde salió'}.
        </p>
      ) : null}

      <div className="fila">
        <div>
          <label>Autor (si la licencia pide crédito)</label>
          <input value={c.autor ?? ''} onChange={(e) => poner('autor', e.target.value)} />
        </div>
        <div>
          <label>Enlace al original</label>
          <input
            value={c.url ?? ''}
            placeholder="https://…"
            onChange={(e) => poner('url', e.target.value)}
          />
        </div>
      </div>

      <label>Consentimiento — la referencia del documento, no un "sí"</label>
      <input
        value={c.consentimiento?.referencia ?? ''}
        placeholder="expediente 218, consentimiento del 2026-03-04"
        onChange={(e) =>
          poner(
            'consentimiento',
            e.target.value
              ? { referencia: e.target.value, fecha: new Date().toISOString().slice(0, 10) }
              : undefined,
          )
        }
      />
      <p className="pista">
        Se guarda para poder buscarlo: el consentimiento se puede retirar, y ese día hay que
        encontrar en qué carruseles salió la foto. <code>npm run consentimiento</code> los lista.
      </p>
    </>
  );
}
