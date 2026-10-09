'use client';

import { useState } from 'react';
import { TAILWIND, TONOS } from '@/plantillas/tailwind';
import type { Post } from '@/plantillas/clinica/tipos';

/**
 * Los colores de un post de la plantilla plana, de la paleta de Tailwind (la
 * misma de uicolors.app): el fondo de todos los slides y el color en que se
 * funde la foto de la portada. Sin elegir nada, el post usa el de la cuenta.
 *
 * El texto se pone solo —blanco u oscuro, el que más contraste dé— y se puede
 * forzar, para los tonos medios donde los dos se leen.
 */
type Colores = NonNullable<Post['colores']>;

const nombreDe = (hex?: string) => {
  if (!hex) return null;
  for (const f of TAILWIND) {
    for (const t of TONOS) if (f.tonos[t] === hex.toUpperCase()) return `${f.nombre} ${t}`;
  }
  return hex;
};

export function ColoresDelPost({
  colores,
  fondoDeLaCuenta,
  onCambio,
}: {
  colores: Post['colores'];
  /** El color de la paleta del post, para enseñar qué se usa sin elegir. */
  fondoDeLaCuenta: string;
  onCambio: (c: Post['colores']) => void;
}) {
  const [abierto, setAbierto] = useState<'fondo' | 'degradado' | null>(null);

  const elegir = (hex: string) => {
    if (abierto === 'fondo') onCambio({ ...(colores ?? {}), fondo: hex } as Colores);
    if (abierto === 'degradado') onCambio({ fondo: colores?.fondo ?? fondoDeLaCuenta, ...colores, degradado: hex });
    setAbierto(null);
  };

  const muestra = (hex: string | undefined, porDefecto: string) => (
    <span className="colores__muestra" style={{ background: hex ?? porDefecto }} />
  );

  return (
    <div className="colores" data-colores>
      <label>Colores de este post</label>
      <div className="colores__fila">
        <button
          className="boton sm"
          aria-pressed={abierto === 'fondo'}
          onClick={() => setAbierto(abierto === 'fondo' ? null : 'fondo')}
        >
          {muestra(colores?.fondo, fondoDeLaCuenta)} Fondo · {nombreDe(colores?.fondo) ?? 'el de la cuenta'}
        </button>
        <button
          className="boton sm"
          aria-pressed={abierto === 'degradado'}
          onClick={() => setAbierto(abierto === 'degradado' ? null : 'degradado')}
        >
          {muestra(colores?.degradado ?? colores?.fondo, fondoDeLaCuenta)} Degradado de la portada ·{' '}
          {nombreDe(colores?.degradado) ?? 'el del fondo'}
        </button>
        {colores ? (
          <select
            value={colores.tinta ?? ''}
            onChange={(e) => onCambio({ ...colores, tinta: e.target.value || undefined })}
            aria-label="Color del texto"
          >
            <option value="">Texto automático</option>
            <option value="#FFFFFF">Texto blanco</option>
            <option value="#1F2937">Texto oscuro</option>
          </select>
        ) : null}
        {colores?.degradado ? (
          <button className="boton sm" onClick={() => onCambio({ ...colores, degradado: undefined })}>
            degradado igual al fondo
          </button>
        ) : null}
        {colores ? (
          <button className="boton sm" onClick={() => onCambio(undefined)}>
            volver a los de la cuenta
          </button>
        ) : null}
      </div>

      {abierto ? (
        <div className="colores__rejilla" role="listbox" aria-label={`Elegir ${abierto}`}>
          <span />
          {TONOS.map((t) => (
            <span key={t} className="colores__tono">
              {t}
            </span>
          ))}
          {TAILWIND.map((f) => (
            <div key={f.familia} className="colores__familia">
              <span className="colores__nombre">{f.nombre}</span>
              {TONOS.map((t) => {
                const hex = f.tonos[t];
                const actual = (abierto === 'fondo' ? colores?.fondo : colores?.degradado) === hex;
                return (
                  <button
                    key={t}
                    className="colores__celda"
                    style={{ background: hex }}
                    title={`${f.nombre} ${t} · ${hex}`}
                    aria-selected={actual}
                    data-color={hex}
                    onClick={() => elegir(hex)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
