import { faltaParaEscribir, remoto } from './almacen';

/**
 * lib/soloLectura.ts — cuando el despliegue no puede escribir.
 *
 * En Vercel el disco del proyecto es de solo lectura y cada petición corre en
 * un contenedor que se destruye al terminar. Con `GITHUB_TOKEN` eso da igual:
 * se escribe en el repositorio (lib/almacen.ts). Sin él, las rutas que guardan
 * contestan diciendo qué falta, en vez de un error de permisos de Node en crudo
 * o, peor, escribir en un /tmp que se evapora y parecer que guardó.
 */

/**
 * Solo cuando no hay dónde escribir: en Vercel **sin** `GITHUB_TOKEN`. Con el
 * token, cada cambio es un commit en el repositorio (ver lib/almacen.ts) y el
 * despliegue edita igual que la computadora.
 */
export const soloLectura = process.env.VERCEL === '1' && !remoto;

export function avisoDeSoloLectura() {
  return Response.json(
    {
      error: `Este despliegue es de solo lectura. ${faltaParaEscribir() ?? ''} Ver el README, «Usarlo desde Vercel».`,
    },
    { status: 503 },
  );
}
