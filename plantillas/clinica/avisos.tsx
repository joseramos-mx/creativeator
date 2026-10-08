'use client';

import { createContext, useContext, useEffect, type ReactNode } from 'react';
import type { EstadoAjuste } from './usarAjuste';

type Reportar = (indice: number, estado: EstadoAjuste) => void;

const Canal = createContext<Reportar | null>(null);

/**
 * El editor escucha aquí cuándo un slide llegó al mínimo del ajuste.
 *
 * Va por contexto y no por props para que la plantilla no dependa del editor:
 * fuera del editor no hay proveedor, el aviso no va a ningún lado y los
 * componentes de slide siguen sirviendo igual en /render y en el banco.
 */
export function ProveedorDeAvisos({
  reportar,
  children,
}: {
  reportar: Reportar;
  children: ReactNode;
}) {
  return <Canal.Provider value={reportar}>{children}</Canal.Provider>;
}

export function useReportarAjuste(indice: number | undefined, estado: EstadoAjuste) {
  const reportar = useContext(Canal);
  useEffect(() => {
    if (reportar && indice !== undefined) reportar(indice, estado);
  }, [reportar, indice, estado.tituloApretado, estado.cuerpoApretado]);
}
