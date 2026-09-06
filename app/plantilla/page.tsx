import { Visor } from '@/app/_componentes/Visor';
import { leerMarca, leerPost } from '@/lib/posts';
import { paletas, type NombrePaleta } from '@/template/tokens';
import { capturas, limites } from './datos';

/**
 * /plantilla — el banco de pruebas.
 *
 * El primer mazo es el carrusel publicado leído de content/posts/, así que con
 * la tecla R se le encima la captura real y las diferencias saltan solas. Que
 * salga del mismo JSON que usa la app entera es a propósito: un banco que pinta
 * datos distintos a los de producción no prueba nada.
 *
 * Después van los casos límite y, al final, **el mismo carrusel en cada
 * paleta**. Esa última parte es la que hace que las paletas cerradas funcionen:
 * una paleta se revisa una vez, aquí, con contenido de verdad encima, y a
 * partir de ahí es una opción segura. Sin esto, cada post sería una apuesta.
 */
export const dynamic = 'force-dynamic';

export default async function Plantilla() {
  const publicado = await leerPost('impetigo-regreso-a-clases');
  const marca = await leerMarca();

  return (
    <Visor
      titulo={`Plantilla · ${marca.usuario}`}
      subtitulo="Banco de pruebas. Aquí se prueba un cambio de diseño antes de tocar contenido."
      mazos={[
        {
          id: 'referencia',
          titulo: 'Carrusel publicado',
          nota: (
            <>
              El post de <code>content/posts/{publicado.slug}.json</code>, en el mismo orden que las
              capturas de <code>public/referencia/</code>. Con la referencia encendida, lo que
              coincide se apaga y lo que baila queda brillante: es la forma más rápida de cazar una
              diferencia de tracking o de interlineado.
            </>
          ),
          post: publicado,
          marca,
          capturas,
        },
        ...Object.entries(paletas).map(([nombre, p]) => ({
          titulo: `Paleta ${p.nombre}`,
          nota: `${p.cuando} — fondo ${p.fondo}, palomita ${p.check}.`,
          post: publicado,
          marca,
          paleta: nombre as NombrePaleta,
        })),
        {
          titulo: 'Casos límite',
          nota: 'Título de tres renglones, cuerpo que no cabe, lista de cinco puntos y slide sin elemento visual. Aquí se ve trabajar al ajuste automático.',
          post: limites,
          marca,
        },
      ]}
    />
  );
}
