/**
 * plantillas/nombres.ts — las plantillas que existen.
 *
 * Va aparte de plantillas/index.ts, que trae los componentes de React, porque
 * el esquema de lib/schema.ts necesita la lista para validar `proyecto.json` y
 * no tiene por qué cargar una plantilla entera para eso.
 *
 * Una plantilla es un diseño completo: sus tipos de slide, su CSS y sus
 * tokens. Cada proyecto dice cuál usa en el campo `plantilla`. Para añadir una
 * nueva, ver el README («Una plantilla nueva»).
 */
export const NOMBRES_PLANTILLA = ['clinica', 'plana', 'foto'] as const;

export type NombrePlantilla = (typeof NOMBRES_PLANTILLA)[number];

/**
 * Si la plantilla toma su diseño de `diseno` en proyecto.json. Todas menos
 * `clinica`, que está medida a mano. Es la pregunta que antes se hacía como
 * `plantilla === 'plana'`, cuando no había otra configurable.
 */
export function conDiseno(plantilla: string | undefined): boolean {
  return plantilla !== undefined && plantilla !== 'clinica';
}
