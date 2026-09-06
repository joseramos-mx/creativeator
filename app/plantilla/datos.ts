import type { Post } from '@/template/tipos';

/**
 * Datos quemados del banco de pruebas.
 *
 * El primer mazo es el carrusel de impétigo tal como se publicó: mismos textos,
 * mismos tipos de slide y mismo orden que las capturas de public/referencia/.
 * Sirve para superponer la captura con la tecla R y ver dónde baila la
 * plantilla. Si un día cambias un token, este mazo es el que te dice si lo
 * mejoraste o lo rompiste.
 *
 * El segundo mazo son los casos límite: los textos que no caben, el título de
 * tres renglones, la lista de cinco. No se parecen a nada publicado a propósito;
 * están para reventar el ajuste automático antes de que lo reviente un post real.
 *
 * En la fase 2 esto se muda a content/posts/*.json y se lee desde el servidor.
 */

const MEDIA = '/media/impetigo-regreso-a-clases';

export const publicado: Post = {
  slug: 'impetigo-regreso-a-clases',
  tema: 'Impétigo en el regreso a clases',
  creado: '2026-09-04',
  estado: 'publicado',
  slides: [
    {
      tipo: 'portada',
      titulo: '*La infección de*\nRegreso **a clases**',
      pregunta: '¿Qué es el impétigo?',
      foto: `${MEDIA}/portada.jpg`,
    },
    {
      tipo: 'contenido',
      titulo: 'El impétigo se dispara\n**en el regreso a clases.**',
      bajada: 'Costras color miel en la cara de tu hijo: ojo, es contagioso.',
      cuerpo:
        'Esas llaguitas con costra amarilla o color miel, casi siempre alrededor de la nariz y la boca, son impétigo: una infección bacteriana de la piel muy común en niños y muy contagiosa. Y el regreso a clases es justo cuando más se dispara.',
      visual: { clase: 'foto', src: `${MEDIA}/01.jpg` },
      fuente: 'Cleveland Clinic.',
    },
    {
      tipo: 'contenido',
      titulo: '*¿Cómo* **reconocerlo?**',
      cuerpo:
        'Empieza como pequeñas ampollas o granitos rojos que se rompen y forman una costra amarillenta, como si la piel tuviera miel encima. Suele picar. Es de las infecciones de piel más frecuentes en la infancia: cerca del 10% de las consultas de piel en niños.',
      visual: { clase: 'icono', slug: 'informacion', tam: 280 },
      fuente: 'StatPearls y KidsHealth.',
    },
    {
      tipo: 'contenido',
      emblema: { slug: 'alerta' },
      titulo: '**Por qué se riega** *tan rápido.*',
      cuerpo:
        'Se contagia al tocar las llagas y también al compartir toallas, ropa o cobijas. El calor y los lugares con muchos niños, como la escuela, lo disparan. Sin tratamiento, puede seguir contagiando durante semanas.',
      visual: { clase: 'foto', src: `${MEDIA}/03.jpg` },
      fuente: 'Mayo Clinic y AAP.',
    },
    {
      tipo: 'lista',
      titulo: '**Qué hacer y qué no.**',
      // En el post publicado este título va más chico que el de token.
      overrides: { tituloPx: 75 },
      puntos: [
        'Necesita antibiótico: en crema si es poco, tomado si está extendido. Termina el tratamiento completo.',
        'Que no se rasque: uñas cortas, lava manos seguido y cubre las llagas.',
        'No compartas toallas, ropa ni sábanas mientras esté activo.',
        'Puede volver a clases unas 24 horas después de empezar el antibiótico.',
      ],
      fuente: 'Mayo Clinic y AAP.',
    },
    {
      tipo: 'contenido',
      titulo: '¿Cuándo verlo con el **médico?**',
      cuerpo:
        'No lo trates a ciegas ni con remedios: necesita el antibiótico correcto y dejar de contagiar. Y ojo, se confunde con un fuego, que es viral y se trata distinto. Si tu hijo tiene estas costras, o si hay fiebre o se extiende, acude a valoración.',
      visual: { clase: 'icono', slug: 'termometro', tam: 430 },
      fuente: 'Cleveland Clinic.',
    },
    { tipo: 'cierre' },
  ],
};

/** Las capturas publicadas, en el mismo orden que los slides de arriba. */
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
