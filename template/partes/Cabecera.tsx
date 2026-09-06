import type { Marca } from '../tipos';

/** Nombre y usuario arriba a la izquierda, con la especialidad debajo. */
export function Cabecera({ marca }: { marca: Marca }) {
  return (
    <div className="cabecera">
      <b>
        {marca.nombre} | {marca.usuario}
      </b>
      <span>{marca.especialidad}</span>
    </div>
  );
}
