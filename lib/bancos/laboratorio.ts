import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { aCandidato as aCandidatoClinico } from './commons';
import { aCandidato } from './pexels';
import { PROYECTO_DE_PRUEBAS, rutasDe } from '../proyecto';
import type { Banco, Candidato } from './tipos';

/**
 * lib/bancos/laboratorio.ts — el banco que no sale a la red.
 *
 * Devuelve la muestra real de Pexels que está guardada en scripts/muestras/, y
 * "baja" un archivo que ya está en la carpeta de fotos del laboratorio. Con eso las pruebas de
 * Playwright recorren el flujo entero —buscar, apartar, elegir, descargar,
 * crédito escrito, barrera satisfecha— sin una sola llamada y sin depender de
 * que Pexels tenga hoy las mismas fotos que ayer.
 *
 * Pasa por `aCandidato()`, el mismo normalizador que el adaptador de verdad.
 * Un banco falso que además normalizara distinto no probaría nada.
 */

const MUESTRA = join(process.cwd(), 'scripts', 'muestras', 'pexels-aula.json');
const MUESTRA_CLINICA = join(process.cwd(), 'scripts', 'muestras', 'commons-impetigo.json');
const ARCHIVO = join(rutasDe(PROYECTO_DE_PRUEBAS).media('laboratorio-edicion'), '01.jpg');

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

/**
 * El archivo clínico de laboratorio.
 *
 * Devuelve la muestra real de Wikimedia Commons guardada en disco, que ya trae
 * la variedad que hace falta: dominio público, CC0 y CC BY-SA. La cuarta es
 * inventada y no se puede usar —CC BY-NC-ND, la licencia de DermNet— para que
 * la prueba compruebe que el fallo en cerrado ocurre de verdad y no solo en el
 * banco de escritorio.
 */
export const archivoLaboratorio: Banco = {
  nombre: 'archivo-laboratorio',
  clinico: true,

  disponible: () => true,

  async buscar(query, cuantas) {
    const muestra = JSON.parse(await readFile(MUESTRA_CLINICA, 'utf8'));
    const paginas = [...muestra.query.pages];

    // Una con licencia no comercial, que es lo que no debe pasar.
    const noComercial = structuredClone(paginas[0]);
    noComercial.title = 'File:Laboratorio no comercial.jpg';
    noComercial.imageinfo[0].extmetadata.License = { value: 'cc-by-nc-nd-3.0' };
    noComercial.imageinfo[0].extmetadata.LicenseShortName = { value: 'CC BY-NC-ND 3.0' };
    paginas.push(noComercial);

    return paginas.map(aCandidatoClinico).filter((c) => c.descarga).slice(0, cuantas);
  },

  async bajar() {
    return readFile(ARCHIVO);
  },
};
