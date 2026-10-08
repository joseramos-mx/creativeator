import 'server-only';

import { join } from 'node:path';
import { almacen } from '../almacen';
import { COMPARTIDO } from '../proyecto';
import sharp from 'sharp';
import { fusionar, gitignoreDeIconos, type Entrada } from '../manifiesto';
import { etiquetar, slugificar } from './etiquetas';

/**
 * lib/iconos/guardar.ts — un ícono generado entra en la librería.
 *
 * Vive aquí y no dentro de una ruta porque lo usan dos caminos: elegir una
 * variante a mano en el editor, y el relleno automático al redactar. **El ícono
 * generado entra por la misma puerta que los descargados** —mismo destino,
 * mismo slug, mismas etiquetas— y si cada camino tuviera su copia, uno acabaría
 * etiquetando distinto y el buscador encontraría unos y no otros según de dónde
 * vinieran.
 *
 * Lo que lleva de más son cuatro campos: `origen`, `proveedor`, `prompt` y
 * `fecha`. El prompt es el que importa —es lo único que permite regenerar la
 * pieza si cambia el estilo de la cuenta— y sobrevive a las reingestas gracias
 * a `fusionar`. Ver lib/manifiesto.ts.
 */

const DESTINO = join(process.cwd(), 'public', 'iconos');
const THUMB = 192;

export type IconoGuardado = { slug: string; entrada: Entrada };

export async function guardarIcono(
  png: Buffer,
  nombre: string,
  concepto: string,
  modelo: string,
): Promise<IconoGuardado> {
  const slug = slugificar(nombre || concepto);
  if (!slug) throw new Error('Falta el nombre del ícono.');

  const meta = await sharp(png).metadata();
  if (!meta.hasAlpha) {
    // El mismo filtro que la ingesta, y por el mismo motivo: si el croma no
    // recortó nada, lo que entraría es un cuadrado opaco.
    throw new Error('Esa imagen no tiene transparencia: el recorte del fondo no funcionó.');
  }

  const miniatura = await sharp(png).resize(THUMB, THUMB).png().toBuffer();

  const sinonimos = JSON.parse((await almacen.leerTexto(join(process.cwd(), COMPARTIDO, 'sinonimos.json'))) ?? '{}');
  const manifiesto: Entrada[] = JSON.parse((await almacen.leerTexto(join(DESTINO, 'manifest.json'))) ?? '[]');
  const indice = new Map<string, Entrada>(manifiesto.map((e) => [String(e.slug), e]));

  // Los cuatro campos de la generación van fuera de `fusionar`, que por
  // definición solo conserva lo que la ingesta NO calcula: metidos dentro se
  // perderían.
  const entrada: Entrada = {
    ...fusionar(indice.get(slug), {
      slug,
      nombre: nombre || slug,
      etiquetas: etiquetar(slug, nombre || slug, sinonimos),
      color: await colorDominante(png),
      w: meta.width ?? 1024,
      h: meta.height ?? 1024,
      bytes: png.length,
    }),
    origen: 'generado',
    proveedor: modelo,
    prompt: concepto,
    fecha: new Date().toISOString().slice(0, 10),
  };

  indice.set(slug, entrada);
  const lista = [...indice.values()].sort((a, b) => String(a.slug).localeCompare(String(b.slug)));
  // El PNG, su miniatura, el manifiesto y el .gitignore van juntos: en Vercel
  // es un solo commit, y un ícono sin su entrada no lo encuentra el buscador.
  // Lo propio se versiona; lo de Thiings no. Ver lib/manifiesto.ts.
  await almacen.escribir(
    [
      { ruta: join(DESTINO, `${slug}.png`), datos: png },
      { ruta: join(DESTINO, 'thumbs', `${slug}.png`), datos: miniatura },
      { ruta: join(DESTINO, 'manifest.json'), datos: `${JSON.stringify(lista, null, 1)}\n` },
      { ruta: join(DESTINO, '.gitignore'), datos: gitignoreDeIconos(lista) },
    ],
    `Ícono generado: ${slug}`,
  );

  return { slug, entrada };
}

/** El mismo cálculo que la ingesta: decide si el ícono se funde con la paleta. */
async function colorDominante(png: Buffer) {
  const { data, info } = await sharp(png)
    .resize(64, 64, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const cubos = new Map<string, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i + 3] < 200) continue;
    const clave = `${data[i] >> 5},${data[i + 1] >> 5},${data[i + 2] >> 5}`;
    const c = cubos.get(clave) ?? { n: 0, r: 0, g: 0, b: 0 };
    c.n++; c.r += data[i]; c.g += data[i + 1]; c.b += data[i + 2];
    cubos.set(clave, c);
  }

  let mejor: { n: number; r: number; g: number; b: number } | null = null;
  for (const c of cubos.values()) if (!mejor || c.n > mejor.n) mejor = c;
  if (!mejor) return null;

  const hex = (v: number) => Math.round(v / mejor!.n).toString(16).padStart(2, '0');
  return `#${hex(mejor.r)}${hex(mejor.g)}${hex(mejor.b)}`.toUpperCase();
}
