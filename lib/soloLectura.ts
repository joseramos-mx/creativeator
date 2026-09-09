/**
 * lib/soloLectura.ts — el despliegue no escribe.
 *
 * En Vercel el disco del proyecto es de solo lectura y cada petición corre en
 * un contenedor que se destruye al terminar, así que las rutas que guardan
 * archivos no pueden funcionar allá. Eso no se arregla: **es lo que es**, y el
 * despliegue existe para otra cosa —ver los carruseles y bajarlos al teléfono
 * desde /descargas—.
 *
 * Lo que sí se puede arreglar es cómo se entera quien lo intente. Sin esto, dar
 * a guardar en el teléfono devuelve un error de permisos de Node en crudo, o
 * peor: escribe en un /tmp que se evapora y parece que guardó. Con esto dice lo
 * que pasa y dónde sí se puede.
 *
 * `VERCEL` la pone la propia plataforma; en tu máquina no existe y todo
 * funciona como siempre.
 */

export const soloLectura = process.env.VERCEL === '1';

export function avisoDeSoloLectura() {
  return Response.json(
    {
      error:
        'Este despliegue es de solo lectura: en Vercel el disco no se puede escribir. ' +
        'Para editar, abre el proyecto en tu computadora. Para bajar los slides al teléfono, ve a /descargas.',
    },
    { status: 503 },
  );
}
