/**
 * plantillas/paletas.ts — los colores que puede llevar un carrusel de una cuenta.
 *
 * El post guarda un nombre de paleta —`azul`, `amarillo`—, y el redactor elige
 * entre los que la cuenta tiene. En la plantilla `clinica` son las veinticinco
 * medidas de sus tokens; en la `plana`, las del diseño de la cuenta, con su
 * propio color. Lo usan el editor (el selector), la redacción y la propuesta de
 * temas (qué puede elegir el modelo), así que va aparte y sin `server-only`.
 */
import { NOMBRES_PALETA, PALETA_POR_DEFECTO, paletas as delaClinica, type NombrePaleta } from './clinica/tokens';
import type { TDiseno } from '@/lib/schema';

export type Paleta = {
  clave: NombrePaleta;
  etiqueta: string;
  /** El fondo del slide. */
  color: string;
  /** El texto encima. */
  tinta: string;
  /** Cuándo toca, para el modelo. */
  cuando: string;
  /** Si entra en el reparto cuando el tema no pide color. */
  variedad: boolean;
  /** Si el modelo la puede proponer sola. */
  automatica: boolean;
};

type ConDiseno = { plantilla?: string; diseno?: TDiseno };

/** El diseño de una cuenta `plana`, o el de por omisión si todavía no tiene. */
export function disenoDe(marca: ConDiseno): TDiseno {
  return (
    marca.diseno ?? {
      fondo: '#4FA0FB',
      tinta: '#FFFFFF',
      tituloFuente: 'Bagel Fat One',
      tituloMayusculas: false,
      textoFuente: 'Figtree',
      numeroFuente: 'Fredoka',
      paletas: [],
    }
  );
}

export function paletasDe(marca: ConDiseno): Paleta[] {
  if (marca.plantilla !== 'plana') {
    return NOMBRES_PALETA.map((clave) => {
      const p = delaClinica[clave];
      return {
        clave,
        etiqueta: p.nombre,
        color: p.fondo,
        tinta: p.titulo,
        cuando: p.cuando,
        variedad: Boolean((p as { variedad?: boolean }).variedad),
        automatica: Boolean((p as { automatica?: boolean }).automatica),
      };
    });
  }
  const d = disenoDe(marca);
  const propias = d.paletas.length
    ? d.paletas
    : [{ nombre: 'azul' as NombrePaleta, color: d.fondo, cuando: 'El color de la cuenta.', tinta: undefined }];
  return propias.map((p) => ({
    clave: p.nombre,
    etiqueta: delaClinica[p.nombre]?.nombre ?? p.nombre,
    color: p.color,
    tinta: p.tinta ?? d.tinta,
    cuando: p.cuando,
    variedad: true,
    automatica: true,
  }));
}

/** La que toca cuando el tema no pide color: la primera de la cuenta. */
export function paletaPorDefectoDe(marca: ConDiseno): NombrePaleta {
  return marca.plantilla === 'plana' ? paletasDe(marca)[0].clave : PALETA_POR_DEFECTO;
}

/** La paleta de un post, o la de por omisión si la cuenta no tiene esa. */
export function paletaDelPost(marca: ConDiseno, nombre: string | undefined): Paleta {
  const todas = paletasDe(marca);
  return todas.find((p) => p.clave === nombre) ?? todas.find((p) => p.clave === paletaPorDefectoDe(marca)) ?? todas[0];
}
