import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { aCandidato } from './pexels';
import type { Banco, Candidato } from './tipos';

/**
 * lib/bancos/laboratorio.ts — el banco que no sale a la red.
 *
 * Devuelve la muestra real de Pexels que está guardada en scripts/muestras/, y
 * "baja" un archivo que ya está en public/media/. Con eso las pruebas de
 * Playwright recorren el flujo entero —buscar, apartar, elegir, descargar,
 * crédito escrito, barrera satisfecha— sin una sola llamada y sin depender de
 * que Pexels tenga hoy las mismas fotos que ayer.
 *
 * Pasa por `aCandidato()`, el mismo normalizador que el adaptador de verdad.
 * Un banco falso que además normalizara distinto no probaría nada.
 */

const MUESTRA = join(process.cwd(), 'scripts', 'muestras', 'pexels-aula.json');
const ARCHIVO = join(process.cwd(), 'public', 'media', 'laboratorio-edicion', '01.jpg');

export const laboratorio: Banco = {
  nombre: 'laboratorio',

  disponible: () => true,

  // Los mismos que habría propuesto el modelo para el slide del contagio en la
  // escuela, escritos a mano. Con esto la prueba recorre las dos etapas sin
  // llamar a nadie.
  criterios: () => ({
    query: 'children classroom backpacks school',
    criterios: 'Niños en ambiente escolar, sin nada clínico.',
    descartar: ['gym', 'sports equipment', 'adults only'],
  }),

  async buscar(query, cuantas) {
    const muestra = JSON.parse(await readFile(MUESTRA, 'utf8'));
    const candidatos: Candidato[] = muestra.photos.map(aCandidato);

    // Una foto de gimnasio que la muestra real no trae, para que la prueba de
    // regresión tenga qué apartar. Es el caso que originó todo esto: el slide
    // del contagio en la escuela se publicó con la foto de un gimnasio.
    candidatos.push({
      ...candidatos[0],
      id: 'laboratorio-gimnasio',
      descripcion: 'Adults training with sport equipment in a gym',
    });

    return candidatos.slice(0, cuantas);
  },

  async bajar() {
    return readFile(ARCHIVO);
  },
};
