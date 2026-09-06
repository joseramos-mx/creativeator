import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { etiquetar, slugificar } from '@/lib/iconos/etiquetas';
import { fusionar, gitignoreDeIconos, type Entrada } from '@/lib/manifiesto';

/**
 * POST /api/icono/guardar — la variante elegida entra en la librería.
 *
 * `{ png, nombre, concepto, modelo }` → el PNG a 1024, su miniatura y la
 * entrada del manifiesto.
 *
 * **Entra por la misma puerta que los descargados.** Nada de una carpeta
 * aparte: mismo destino, mismo slug, mismas etiquetas de `lib/iconos/etiquetas`
 * y misma entrada de manifiesto. La normalización ya viene hecha del recorte
 * —recorte del transparente y recentrado con 4 % de aire—, que es lo que evita
 * que un ícono generado se vea de otro tamaño puesto al mismo tamaño en CSS.
 *
 * Lo que sí lleva de más son cuatro campos: `origen`, `proveedor`, `prompt` y
 * `fecha`. El prompt es el que importa — es lo único que permite regenerar la
 * pieza si algún día cambia el estilo de la cuenta— y sobrevive a las
 * reingestas gracias a `fusionar`. Ver lib/manifiesto.ts.
 */

const DESTINO = join(process.cwd(), 'public', 'iconos');
const THUMB = 192;

export async function POST(req: Request) {
  try {
    const { png, nombre, concepto, modelo } = await req.json();

    if (typeof png !== 'string' || !png) {
      return Response.json({ error: 'Falta la imagen.' }, { status: 400 });
    }
    const slug = slugificar(String(nombre ?? concepto ?? ''));
    if (!slug) return Response.json({ error: 'Falta el nombre del ícono.' }, { status: 400 });

    const bytes = Buffer.from(png, 'base64');
    const meta = await sharp(bytes).metadata();
    if (!meta.hasAlpha) {
      // El mismo filtro que la ingesta, y por el mismo motivo: si el croma no
      // recortó nada, lo que entraría es un cuadrado opaco.
      return Response.json(
        { error: 'Esa imagen no tiene transparencia: el recorte del fondo no funcionó.' },
        { status: 400 },
      );
    }

    await mkdir(join(DESTINO, 'thumbs'), { recursive: true });
    await writeFile(join(DESTINO, `${slug}.png`), bytes);
    await sharp(bytes).resize(THUMB, THUMB).png().toFile(join(DESTINO, 'thumbs', `${slug}.png`));

    const sinonimos = await readFile(join(process.cwd(), 'content', 'sinonimos.json'), 'utf8')
      .then(JSON.parse)
      .catch(() => ({}));

    const manifiesto = await readFile(join(DESTINO, 'manifest.json'), 'utf8')
      .then(JSON.parse)
      .catch(() => []);
    const indice = new Map<string, Entrada>(
      manifiesto.map((e: Entrada) => [String(e.slug), e]),
    );

    // `fusionar` solo conserva lo que NO calcula la ingesta, así que los cuatro
    // campos de la generación van fuera: son de esta ruta, que es quien los
    // sabe. Metidos dentro se perderían — pasó al primer intento.
    const entrada: Entrada = {
      ...fusionar(indice.get(slug), {
        slug,
        nombre: String(nombre ?? slug),
        etiquetas: etiquetar(slug, String(nombre ?? slug), sinonimos),
        color: await colorDominante(bytes),
        w: meta.width ?? 1024,
        h: meta.height ?? 1024,
        bytes: bytes.length,
      }),
      origen: 'generado',
      proveedor: modelo ?? null,
      prompt: concepto ?? null,
      fecha: new Date().toISOString().slice(0, 10),
    };

    indice.set(slug, entrada);
    const lista = [...indice.values()].sort((a, b) =>
      String(a.slug).localeCompare(String(b.slug)),
    );
    await writeFile(join(DESTINO, 'manifest.json'), `${JSON.stringify(lista, null, 1)}\n`);

    return Response.json({ slug, entrada });
  } catch (e) {
    const error = e instanceof Error ? e.message : 'No se pudo guardar el ícono.';
    return Response.json({ error }, { status: 400 });
  }
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
