import 'server-only';

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { proporcionDeFondo, quitarCroma } from './croma';

/**
 * lib/iconos/gemini.ts — generar un ícono con Gemini.
 *
 * Detrás de la interfaz de `tipos.ts` por lo mismo que los bancos de fotos: el
 * soporte de transparencia cambia entre proveedores y entre versiones, y el día
 * que convenga cambiar se toca un archivo.
 *
 * Ninguno de los modelos de imagen de Gemini devuelve canal alfa, así que se
 * pide el fondo en verde croma y se recorta aquí. La alternativa —el doble
 * render sobre blanco y sobre negro— es más cara y solo gana en objetos
 * translúcidos; una lupa tiene vidrio, así que si el croma falla en el cristal,
 * ahí es donde hay que mirar primero.
 *
 * La marca de agua invisible SynthID va en la imagen y no se toca. Es lo
 * correcto: la pieza es generada y eso debe poder comprobarse.
 */

const API = 'https://generativelanguage.googleapis.com/v1beta/models';

/** El versátil. `-lite` es más barato y `gemini-3-pro-image` da más calidad. */
export const MODELO = 'gemini-3.1-flash-image';

export type IconoGenerado = {
  /** PNG con alfa, ya normalizado al tamaño y encuadre de la librería. */
  png: Buffer;
  /** Cuánto del render era fondo. Ver `proporcionDeFondo`. */
  fondo: number;
  aviso?: string;
};

/** El estilo congelado, que se antepone a cada concepto. Ver content/estilo-iconos.md. */
export async function leerEstilo(): Promise<string> {
  const texto = await readFile(join(process.cwd(), 'content', 'estilo-iconos.md'), 'utf8');
  // Solo la parte de arriba: lo que va después del separador explica el archivo
  // a quien lo edite, no al modelo.
  return texto.split('\n---\n')[0].trim();
}

export async function generar(
  concepto: string,
  cuantos = 3,
  modelo = MODELO,
): Promise<IconoGenerado[]> {
  const llave = process.env.GEMINI_API_KEY;
  if (!llave) throw new Error('Falta GEMINI_API_KEY en .env.local.');

  const estilo = await leerEstilo();
  const prompt = `${concepto}.\n\n${estilo}`;

  // En serie y no en paralelo: son tres llamadas de unos segundos y así un 429
  // no se lleva las tres por delante.
  const salidas: IconoGenerado[] = [];
  for (let i = 0; i < cuantos; i++) {
    salidas.push(await unaImagen(prompt, llave, modelo));
  }
  return salidas;
}

async function unaImagen(prompt: string, llave: string, modelo: string): Promise<IconoGenerado> {
  const r = await fetch(`${API}/${modelo}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': llave },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'] },
    }),
  });

  if (!r.ok) {
    const detalle = await r.text();
    throw new Error(`Gemini respondió ${r.status}: ${detalle.slice(0, 200)}`);
  }

  const cuerpo = await r.json();
  const partes = cuerpo?.candidates?.[0]?.content?.parts ?? [];
  const imagen = partes.find((p: { inlineData?: { data?: string } }) => p.inlineData?.data);
  if (!imagen) {
    const motivo = cuerpo?.candidates?.[0]?.finishReason ?? 'sin motivo';
    throw new Error(`Gemini no devolvió imagen (${motivo}).`);
  }

  const crudo = Buffer.from(imagen.inlineData.data, 'base64');
  return recortar(crudo);
}

/**
 * Del render sobre verde al PNG que entra en la librería.
 *
 * La normalización es la misma que la de la ingesta —recorte del transparente y
 * recentrado con 4 % de aire— y eso no es un detalle: sin ella el ícono
 * generado se ve de otro tamaño que los de la colección puesto al mismo tamaño
 * en CSS, que es la falla más visible de todas.
 */
export async function recortar(crudo: Buffer): Promise<IconoGenerado> {
  const { data, info } = await sharp(crudo).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const rgba = quitarCroma({ datos: data, ancho: info.width, alto: info.height });
  const fondo = proporcionDeFondo(rgba);

  const conAlfa = await sharp(Buffer.from(rgba), {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();

  const TAM = 1024;
  const AIRE = 0.04;
  const lado = Math.round(TAM * (1 - AIRE * 2));
  const borde = Math.round(TAM * AIRE);

  const png = await sharp(await sharp(conAlfa).trim({ threshold: 1 }).toBuffer())
    .resize(lado, lado, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({
      top: borde,
      bottom: borde,
      left: borde,
      right: borde,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toBuffer();

  // Los dos extremos que hay que cazar antes de guardar nada: un cuadrado
  // opaco porque el modelo ignoró el fondo verde, o un lienzo vacío.
  const aviso =
    fondo < 0.05
      ? 'El render casi no tiene fondo verde: puede haber salido un cuadrado opaco.'
      : fondo > 0.95
        ? 'El render es casi todo fondo: puede que no haya dibujado nada.'
        : undefined;

  return { png, fondo, ...(aviso ? { aviso } : {}) };
}
