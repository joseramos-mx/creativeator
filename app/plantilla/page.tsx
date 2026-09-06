import { Visor } from '@/app/_componentes/Visor';
import { leerMarca, leerPost, marcaDePost } from '@/lib/posts';
import { capturas, limites } from './datos';

/**
 * /plantilla — el banco de pruebas.
 *
 * Dos mazos. El de arriba es el carrusel publicado leído de content/posts/, así
 * que con la tecla R se le encima la captura real y las diferencias saltan
 * solas. El de abajo son los casos que rompen cosas.
 *
 * Que el primero salga del mismo JSON que usa la app entera es a propósito: un
 * banco de pruebas que pinta datos distintos a los de producción no prueba nada.
 */
export const dynamic = 'force-dynamic';

export default async function Plantilla() {
  const publicado = await leerPost('impetigo-regreso-a-clases');
  const [marcaPublicado, marca] = await Promise.all([
    marcaDePost(publicado.slug),
    leerMarca(),
  ]);

  return (
    <Visor
      titulo={`Plantilla · ${marca.usuario}`}
      subtitulo="Banco de pruebas. Aquí se prueba un cambio de diseño antes de tocar contenido."
      mazos={[
        {
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
          marca: marcaPublicado,
          capturas,
        },
        {
          titulo: 'Casos límite',
          nota: 'Título de tres renglones, cuerpo que no cabe, lista de cinco puntos y slide sin elemento visual. Aquí se ve trabajar al ajuste automático.',
          post: limites,
          marca: { ...marca, papel: '/marca/papel-07.svg' },
        },
      ]}
    />
  );
}
