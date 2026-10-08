/**
 * scripts/laboratorio.mjs — `npm run laboratorio`
 *
 * Escribe los carruseles de laboratorio, que son sobre los que corren las
 * pruebas. Existen por una razón concreta: una prueba de Playwright borró un
 * slide de un post publicado, porque un clic calculado sobre una lista que se
 * estaba repintando cayó en el botón equivocado. El slide se recuperó de git,
 * pero el problema no era el slide: era que el clic pudiera llegar ahí.
 *
 * Desde entonces las pruebas solo tocan slugs que empiezan por `laboratorio-`,
 * y este script los devuelve a su estado inicial antes de cada corrida. Que
 * sean posts de verdad, en proyectos/dr-edwin/posts/ y leídos por el mismo código, es a
 * propósito: una prueba contra datos falsos no prueba el camino real.
 */

import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PROYECTO_DE_PRUEBAS, rutasDe } from '../lib/proyecto.ts';

export const PREFIJO = 'laboratorio-';

/** Los carruseles de laboratorio son de un proyecto: ver PROYECTO_DE_PRUEBAS. */
export const PROYECTO = PROYECTO_DE_PRUEBAS;
const RUTAS = rutasDe(PROYECTO);
const POSTS = RUTAS.posts;
const MEDIA_URL = `/proyectos/${PROYECTO}/media/laboratorio-edicion`;

/**
 * El de edición: lleva un slide de cada tipo, con foto, con ícono y con
 * emblema, para que las pruebas del editor tengan dónde arrastrar, qué empujar
 * y qué buscar.
 */
const edicion = {
  slug: 'laboratorio-edicion',
  tema: 'Laboratorio · edición',
  creado: '2026-01-01',
  estado: 'borrador',
  paleta: 'azul',
  copy: 'Carrusel de laboratorio. No es contenido: es sobre lo que corren las pruebas.',
  slides: [
    {
      tipo: 'portada',
      titulo: '*Carrusel de*\n**laboratorio**',
      pregunta: '¿Sobre qué corren las pruebas?',
      foto: `${MEDIA_URL}/portada.jpg`,
    },
    {
      tipo: 'contenido',
      titulo: 'Un slide **con foto**',
      bajada: 'Con bajada, para que el bloque cargue lo que puede cargar.',
      cuerpo:
        'Este slide existe para probar el arrastre de imágenes sobre el propio slide y el empuje con flechas. Su foto se reemplaza en cada corrida y no le importa a nadie.',
      visual: {
        clase: 'foto',
        src: `${MEDIA_URL}/01.jpg`,
        ideaImagen: 'lo que la prueba espera encontrar descrito aquí',
      },
      fuente: 'Prueba.',
    },
    {
      tipo: 'contenido',
      titulo: '*Un slide* **con ícono**',
      cuerpo:
        'Este otro prueba el buscador de íconos, el aviso de los que se funden con la paleta y el tamaño por slide. Y no lo trates con antibiótico sin valoración médica.',
      visual: { clase: 'icono', slug: 'informacion', tam: 280, iconoSugerido: 'magnifying glass' },
      fuente: 'Prueba.',
    },
    {
      tipo: 'lista',
      titulo: '**Una lista** de cuatro.',
      puntos: [
        'El primer punto, con su palomita.',
        'El segundo, para ver la separación entre puntos.',
        'El tercero, que en la paleta verde cambia de color.',
        'Y el cuarto, que es el máximo cómodo.',
      ],
      fuente: 'Prueba.',
    },
    { tipo: 'cierre' },
  ],
};

/**
 * El de paletas: el mismo carrusel pero con el emblema y todo lo que se mide
 * contra el fondo, para las pruebas que cambian de paleta.
 */
const paletas = {
  slug: 'laboratorio-paletas',
  tema: 'Laboratorio · paletas',
  creado: '2026-01-01',
  estado: 'borrador',
  paleta: 'azul',
  slides: [
    {
      tipo: 'portada',
      titulo: '*El velo sigue*\na la **paleta**',
      pregunta: '¿Termina fundido en el fondo?',
      foto: `${MEDIA_URL}/portada.jpg`,
    },
    {
      tipo: 'contenido',
      emblema: { slug: 'alerta' },
      titulo: 'Con **emblema** encima',
      cuerpo:
        'El triángulo de alerta es amarillo por semántica y no se puede cambiar de color: sobre naranja es donde se mide si la sombra lo despega.',
      visual: { clase: 'foto', src: `${MEDIA_URL}/01.jpg` },
      fuente: 'Prueba.',
    },
    {
      tipo: 'contenido',
      titulo: 'Un **ícono** sobre el fondo',
      cuerpo:
        'Los de Thiings traen color fijo y no se recolorean, así que aquí se mide cuáles se funden con cada paleta y si la sombra los despega.',
      visual: { clase: 'icono', slug: 'informacion', tam: 280 },
      fuente: 'Prueba.',
    },
    {
      tipo: 'lista',
      titulo: '**Palomitas** sobre el fondo',
      puntos: [
        'En la paleta verde la palomita cambia de color.',
        'Con el verde de siempre desaparecería.',
      ],
      fuente: 'Prueba.',
    },
    { tipo: 'cierre', frase: 'Y la línea grande del cierre.' },
  ],
};

const LABORATORIO = [edicion, paletas];

/** Las fotos de laboratorio salen de las de ejemplo, para no depender de nada. */
async function copiarMedia() {
  const destino = RUTAS.media('laboratorio-edicion');
  await mkdir(destino, { recursive: true });
  const origen = RUTAS.media('impetigo-regreso-a-clases');
  for (const [de, a] of [
    ['portada.jpg', 'portada.jpg'],
    ['01.jpg', '01.jpg'],
  ]) {
    await copyFile(join(origen, de), join(destino, a)).catch(() => {});
  }
}

export async function reiniciarLaboratorio() {
  await copiarMedia();
  for (const post of LABORATORIO) {
    await writeFile(join(POSTS, `${post.slug}.json`), `${JSON.stringify(post, null, 2)}\n`, 'utf8');
  }
  return LABORATORIO.map((p) => p.slug);
}

// Se ejecuta solo cuando se llama directo; importado desde las pruebas, no.
if (process.argv[1]?.endsWith('laboratorio.mjs')) {
  const slugs = await reiniciarLaboratorio();
  console.log(`Laboratorio reiniciado: ${slugs.join(', ')}`);
}
