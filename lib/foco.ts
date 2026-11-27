import { join } from 'node:path';
import sharp from 'sharp';
import { almacen } from './almacen';

/**
 * lib/foco.ts — el encuadre automático de la foto de portada.
 *
 * `cover` recorta por el centro (o por arriba, en `plana`), y eso deja fuera
 * justo lo que importa cuando la foto es de una persona: la mamá del crup
 * quedaba con la cabeza bajo el degradado. Aquí se busca dónde está lo
 * interesante y se mueve el recorte para que caiga donde la plantilla deja la
 * foto a la vista.
 *
 * Lo interesante lo encuentra sharp con su estrategia `attention`, que pesa
 * piel, saturación y contraste: no reconoce caras, pero casi siempre cae en
 * ellas porque son lo más saturado y con más detalle de una foto de banco. Si
 * se equivoca, para eso están los deslizadores.
 */

const LIENZO = { ancho: 1080, alto: 1350 };

/**
 * Qué parte de la portada se ve de verdad y dónde debería caer el centro de
 * interés, en fracciones del lienzo. En `plana` y `clinica` el título y su
 * degradado tapan la mitad de abajo; en `foto` la foto va entera.
 */
const VISTA: Record<string, { alto: number; centroY: number }> = {
  plana: { alto: 0.62, centroY: 0.31 },
  clinica: { alto: 0.62, centroY: 0.31 },
  foto: { alto: 1, centroY: 0.45 },
};

export type Encuadre = { fotoX: number; fotoY: number };

/** La foto de una URL servida (`/proyectos/…`), leída del disco o del repo. */
async function leerFoto(src: string): Promise<Buffer> {
  if (!src.startsWith('/proyectos/') || src.includes('..')) {
    throw new Error('Solo se encuadran fotos guardadas en el proyecto.');
  }
  const ruta = join(process.cwd(), 'public', ...decodeURIComponent(src.split('?')[0]).split('/'));
  const datos = await almacen.leer(ruta);
  if (!datos) throw new Error(`No está la foto ${src}.`);
  return datos;
}

/**
 * Dónde dejar el recorte, en % de `background-position`.
 *
 * Con `cover` la foto se escala hasta cubrir el lienzo y sobra por un solo
 * lado. Si el punto de interés está en `f` (fracción de la foto) y debe caer en
 * `t` (fracción del lienzo), la posición `p` cumple
 * `f·foto + p·(lienzo − foto) = t·lienzo`. Por el lado que no sobra, 50.
 */
export async function encuadreAutomatico(src: string, plantilla = 'clinica'): Promise<Encuadre> {
  const datos = await leerFoto(src);
  // `rotate()` primero: una foto de celular trae la orientación en el EXIF y
  // el navegador la respeta al pintarla.
  const base = sharp(datos).rotate();
  const { width: w = 0, height: h = 0 } = await base.clone().toBuffer({ resolveWithObject: true }).then((r) => r.info);
  if (!w || !h) throw new Error('No se pudo leer el tamaño de la foto.');

  const vista = VISTA[plantilla] ?? VISTA.clinica;
  const caja = { ancho: LIENZO.ancho, alto: Math.round(LIENZO.alto * vista.alto) };

  // El mejor recorte con la forma de lo que se ve; su centro es el foco.
  const { info } = await base
    .clone()
    .resize(caja.ancho, caja.alto, { fit: 'cover', position: sharp.strategy.attention })
    .toBuffer({ resolveWithObject: true });
  const k = Math.max(caja.ancho / w, caja.alto / h);
  const izquierda = Math.abs(info.cropOffsetLeft ?? 0);
  const arriba = Math.abs(info.cropOffsetTop ?? 0);
  const fx = (izquierda + caja.ancho / 2) / (w * k);
  const fy = (arriba + caja.alto / 2) / (h * k);

  const escala = Math.max(LIENZO.ancho / w, LIENZO.alto / h);
  const posicion = (f: number, foto: number, lienzo: number, t: number) => {
    if (foto - lienzo < 1) return 50;
    const p = (f * foto - t * lienzo) / (foto - lienzo);
    return Math.round(Math.min(1, Math.max(0, p)) * 1000) / 10;
  };

  return {
    fotoX: posicion(fx, w * escala, LIENZO.ancho, 0.5),
    fotoY: posicion(fy, h * escala, LIENZO.alto, vista.centroY),
  };
}
