'use client';

import { useParams } from 'next/navigation';

/**
 * El proyecto de la página en la que está el componente.
 *
 * Sale de la URL (/<proyecto>/…) y no de un estado guardado a propósito: con
 * dos pestañas abiertas en dos cuentas, cada una guarda en la suya. Un
 * "proyecto activo" guardado en una cookie haría que el editor de una pestaña
 * guardara en la cuenta que se eligió en la otra.
 */
export function useProyecto(): string {
  const { proyecto } = useParams<{ proyecto: string }>();
  return proyecto;
}

/** La ruta de la API del proyecto: `api('/post')` → `/api/<proyecto>/post`. */
export function useApi(): (ruta: string) => string {
  const proyecto = useProyecto();
  return (ruta) => `/api/${proyecto}${ruta}`;
}
