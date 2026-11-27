import { join } from 'node:path';
import { almacen } from '../almacen';
import { rutasDe } from '../proyecto';
import type { Banco, Candidato } from './tipos';

/**
 * lib/bancos/propio.ts — las fotos de la cuenta, como si fueran un banco.
 *
 * Hay cuentas cuyo estilo **es** su material: Ahimsa Travel publica sus fotos
 * de viaje —la maleta abierta, la pantalla del avión— y una foto de Pexels ahí
 * se nota de inmediato. Así que las suyas van primero y el banco de verdad solo
 * entra cuando no hay ninguna del país o del tema.
 *
 * Las fotos viven en public/proyectos/<id>/fotos/<país>/<ciudad>/ con un
 * `catalogo.json` al lado, que deja `npm run fotos:propias`: qué se ve en cada
 * una, dicho por Claude al mirarla. Sin catálogo la cuenta no tiene banco
 * propio y todo sigue como antes.
 *
 * Una foto propia **no se copia** al carrusel: el slide apunta al archivo del
 * catálogo. Copiarla duplicaría en el repositorio cada foto cada vez que se
 * usa, y no hay nada que proteger — no caduca ni cambia de licencia.
 */

export const PROVEEDOR = 'propia';

export type FotoPropia = {
  /** `francia/paris/5d2c527f`. Es también lo que el modelo devuelve al elegirla. */
  id: string;
  /** La URL servida, como la escribe el post. */
  url: string;
  pais: string;
  ciudad: string;
  ancho: number;
  alto: number;
  /** Qué se ve, en español y en una frase. */
  descripcion: string;
  /** En inglés, para casar con las consultas al banco. */
  etiquetas: string[];
  /**
   * Si sale alguien y cómo. `rostro` es una cara que se reconoce: puede ser de
   * Fátima o de un cliente y desde aquí no se sabe, así que esas no se ponen
   * solas — se eligen a mano en el editor.
   */
  personas: 'ninguna' | 'lejos' | 'rostro';
  /** Si el centro de la foto está despejado para la frase. */
  centroLibre: boolean;
};

export async function leerCatalogo(proyecto: string): Promise<FotoPropia[]> {
  const crudo = await almacen.leerTexto(rutasDe(proyecto).catalogoFotos);
  if (!crudo) return [];
  try {
    const catalogo = JSON.parse(crudo);
    return Array.isArray(catalogo) ? catalogo : [];
  } catch {
    return [];
  }
}

/**
 * Las que se pueden poner sin que nadie mire: sin caras reconocibles, salvo
 * que la cuenta diga lo contrario (`fotosConRostro` en proyecto.json).
 */
export function automaticas(catalogo: FotoPropia[], conRostro = false): FotoPropia[] {
  return conRostro ? catalogo : catalogo.filter((f) => f.personas !== 'rostro');
}

/**
 * El catálogo como lo lee el modelo al redactar: una línea por foto.
 *
 * Va entero en el prompt —con 286 fotos son unos diez mil tokens— porque quien
 * escribió el slide es quien mejor sabe qué foto lo acompaña. Buscar después
 * por palabras sería volver a explicarle el slide a un buscador peor.
 */
export function catalogoParaPrompt(catalogo: FotoPropia[], conRostro = false): string {
  return automaticas(catalogo, conRostro)
    .map((f) => {
      const forma = f.alto > f.ancho * 1.1 ? 'vertical' : f.ancho > f.alto * 1.1 ? 'horizontal' : 'cuadrada';
      return `${f.id} · ${f.ciudad || f.pais} · ${forma}${f.centroLibre ? '' : ' · centro ocupado'}${f.personas === 'rostro' ? ' · con rostro' : ''} · ${f.descripcion}`;
    })
    .join('\n');
}

const CREDITO = {
  fuente: 'Proporcionada por la cuenta',
  licencia: 'Uso autorizado por la cuenta',
} as const;

export function aCandidato(f: FotoPropia): Candidato {
  return {
    id: f.id,
    proveedor: PROVEEDOR,
    descripcion: [f.descripcion, f.ciudad, f.pais, ...f.etiquetas].filter(Boolean).join(' · '),
    ancho: f.ancho,
    alto: f.alto,
    vista: f.url,
    descarga: f.url,
    credito: { ...CREDITO },
    ...(f.personas === 'rostro'
      ? { avisos: ['Sale una cara que se reconoce: confirma que es de la cuenta o que hay permiso.'] }
      : {}),
  };
}

const normalizar = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/**
 * Busca por palabras en la descripción, las etiquetas y el lugar.
 *
 * Es el buscador del editor, que recibe la consulta en inglés que propone
 * Claude o la que escribe quien edita. No necesita ser listo: el catálogo de
 * una cuenta son unos cientos de fotos y quien elige está mirando.
 */
export function bancoPropio(proyecto: string, catalogo: FotoPropia[]): Banco {
  return {
    nombre: 'fotos de la cuenta',
    disponible: () => catalogo.length > 0,

    async buscar(query, cuantas) {
      const palabras = normalizar(query)
        .split(/[^a-z0-9]+/)
        .filter((p) => p.length > 2);
      const puntuadas = catalogo.map((f) => {
        const texto = normalizar([f.descripcion, f.pais, f.ciudad, ...f.etiquetas].join(' '));
        const puntos = palabras.reduce((s, p) => s + (texto.includes(p) ? 1 : 0), 0);
        return { f, puntos };
      });
      return puntuadas
        .filter((p) => p.puntos > 0)
        .sort((a, b) => b.puntos - a.puntos)
        .slice(0, cuantas)
        .map((p) => aCandidato(p.f));
    },

    // Casi no se usa: `descargarFoto` no copia las propias. Queda para quien
    // pida los bytes por la interfaz de banco.
    async bajar(candidato) {
      const rutas = rutasDe(proyecto);
      const relativa = candidato.descarga.slice(rutas.urlFotos.length + 1);
      const datos = await almacen.leer(join(rutas.fotos, ...relativa.split('/')));
      if (!datos) throw new Error(`No está la foto ${candidato.id}.`);
      return datos;
    },
  };
}

/**
 * Las propias primero y, detrás, las del banco de verdad.
 *
 * Así el editor enseña las dos en la misma rejilla y quien edita no tiene que
 * saber que existen dos buscadores. Si el banco de verdad falla —sin llave,
 * sin cuota—, las propias salen igual.
 */
export function combinado(propio: Banco, otro: Banco): Banco {
  return {
    nombre: `${propio.nombre} + ${otro.nombre}`,
    disponible: () => propio.disponible() || otro.disponible(),
    async buscar(query, cuantas, orientacion) {
      const suyas = await propio.buscar(query, cuantas, orientacion);
      const ajenas = otro.disponible() ? await otro.buscar(query, cuantas, orientacion).catch(() => []) : [];
      return [...suyas, ...ajenas];
    },
    bajar: (candidato) => (candidato.proveedor === PROVEEDOR ? propio : otro).bajar(candidato),
  };
}
