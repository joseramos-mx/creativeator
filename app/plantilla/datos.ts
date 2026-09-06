import type { Post } from '@/template/tipos';

/**
 * Los casos límite del banco de pruebas.
 *
 * Textos que no caben, título de tres renglones, lista de cinco puntos, slide
 * sin elemento visual. No se parecen a nada publicado a propósito: están para
 * reventar el ajuste automático antes de que lo reviente un post real.
 *
 * Esto sí se queda quemado en el código, porque no es contenido: es la prueba.
 * El carrusel publicado, que sí es contenido, vive en content/posts/.
 */

/** Las capturas publicadas, en el orden de los slides del post de impétigo. */
export const capturas = [
  '/referencia/portada.png',
  '/referencia/contenido-01.png',
  '/referencia/contenido-02.png',
  '/referencia/contenido-03.png',
  '/referencia/lista-04.png',
  '/referencia/contenido-05.png',
  '/referencia/cierre-06.png',
];

export const limites: Post = {
  slug: 'casos-limite',
  tema: 'Casos límite de la plantilla',
  creado: '2026-09-05',
  estado: 'borrador',
  slides: [
    {
      tipo: 'portada',
      titulo: '*Tres renglones para*\nver hasta dónde\n**aguanta la portada**',
      pregunta: '¿Y si la pregunta es larga?',
    },
    {
      tipo: 'contenido',
      titulo: 'Un título de tres renglones\nque además trae **negrita**\ny *serif itálica* al final.',
      bajada: 'Con bajada, para que el bloque cargue todo lo que puede cargar.',
      cuerpo:
        'Cuerpo de largo normal, para que se vea qué le queda al bloque cuando el título se come tres renglones y encima hay bajada.',
      visual: { clase: 'ninguno' },
      fuente: 'Caso de prueba.',
    },
    {
      tipo: 'contenido',
      titulo: 'Cuerpo **demasiado largo**',
      cuerpo:
        'Este párrafo pasa de largo a propósito para que el ajuste automático tenga que trabajar. Un texto pegado nunca mide lo que el diseño espera, y lo que pasa entonces es justo lo que hay que poder ver aquí: la letra baja de dos en dos hasta caber, y si toca el mínimo, el aviso dice que hay que recortar en vez de seguir encogiendo. Cualquier redactor va a escribir de más alguna vez, así que la plantilla tiene que aguantarlo sin romperse ni dejar el texto colgando fuera del área.',
      visual: { clase: 'icono', slug: 'llanto' },
      fuente: 'Caso de prueba.',
    },
    {
      tipo: 'lista',
      titulo: 'Lista de **cinco puntos**',
      puntos: [
        'Con cinco puntos el bloque ya no cabe cómodo y el ajuste baja el cuerpo.',
        'Cuatro es el máximo cómodo; el quinto es el que avisa.',
        'Cada punto sigue siendo accionable y de una o dos líneas.',
        'La palomita se apoya en la primera línea base, no en la caja.',
        'Y este quinto es el que obliga a decidir si sobra.',
      ],
      fuente: 'Caso de prueba.',
    },
    {
      tipo: 'contenido',
      titulo: 'Sin nada **visual**',
      cuerpo:
        'Cuando el slide no lleva ni foto ni ícono, el bloque de texto se centra solo en el área. Es el caso más simple y el que revela si los márgenes están bien puestos.',
      visual: { clase: 'ninguno' },
    },
    { tipo: 'cierre' },
  ],
};
