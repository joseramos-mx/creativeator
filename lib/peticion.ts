import 'server-only';

import { existeProyecto } from './proyecto';

/**
 * lib/peticion.ts — el proyecto de una ruta de la API.
 *
 * Todas las rutas que leen o escriben contenido viven en /api/<proyecto>/…, y
 * el proyecto sale de la URL, no del cuerpo. Así el editor no puede guardar en
 * otra cuenta por mandar un campo equivocado: la cuenta es la de la página.
 */

export type ConProyecto = { params: Promise<{ proyecto: string }> };

/** El id del proyecto, o `null` si no existe. */
export async function proyectoDe(ctx: ConProyecto): Promise<string | null> {
  const { proyecto } = await ctx.params;
  return existeProyecto(proyecto) ? proyecto : null;
}

export function proyectoInexistente(): Response {
  return Response.json(
    { error: 'Ese proyecto no existe. Los proyectos son las carpetas de proyectos/.' },
    { status: 404 },
  );
}
