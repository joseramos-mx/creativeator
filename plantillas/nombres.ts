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
export const NOMBRES_PLANTILLA = ['clinica', 'plana'] as const;

export type NombrePlantilla = (typeof NOMBRES_PLANTILLA)[number];
