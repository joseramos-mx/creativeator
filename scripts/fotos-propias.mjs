/**
 * scripts/fotos-propias.mjs — las fotos de una cuenta, convertidas en su banco.
 *
 *   npm run fotos:propias -- --proyecto ahimsatravel <carpeta o .zip>
 *
 * Toma una carpeta ordenada por país y ciudad —como «Fotografías Ahimsa» en
 * Drive, o el .zip que Drive baja de ella—, y por cada foto:
 *
 *   1. la endereza, la baja a 1440 × 1800 como mucho y la guarda en
 *      public/proyectos/<id>/fotos/<país>/<ciudad>/<nombre>.jpg;
 *   2. le pide a Claude que diga qué se ve, si sale alguien y si el centro
 *      está libre para la frase, y lo apunta en fotos/catalogo.json.
 *
 * Se puede volver a correr cuando la cuenta suba fotos nuevas: las que ya
 * están en el catálogo no se vuelven a mirar ni a cobrar. Y se guarda después
 * de cada tanda, así que cortarlo a la mitad no pierde lo ya hecho.
 *
 * Lo que sale lo lee lib/bancos/propio.ts.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, relative, sep } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import JSZip from 'jszip';
import sharp from 'sharp';
import { z } from 'zod';
import { proyectoDeArgumentos, rutasDe, sinProyecto } from '../lib/proyecto.ts';
import { aSlug } from '../lib/slug.ts';

/** El lienzo es 1080 × 1350; un tercio más deja margen para recortar. */
const LADO = { ancho: 1440, alto: 1800 };
/** Lo que ve Claude. Para decir qué hay en la foto sobra. */
const LADO_VISTA = 640;
/** Fotos por llamada, y llamadas a la vez. */
const POR_TANDA = 8;
const A_LA_VEZ = 3;
const MODELO = process.env.CLAUDE_MODELO_AUXILIAR?.trim() || 'claude-sonnet-5';
const EXTENSIONES = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic']);

const Descripcion = z.object({
  fotos: z.array(
    z.object({
      n: z.number(),
      descripcion: z.string(),
      etiquetas: z.array(z.string()),
      personas: z.enum(['ninguna', 'lejos', 'rostro']),
      centroLibre: z.boolean(),
    }),
  ),
});

try {
  process.loadEnvFile('.env.local');
} catch {
  // Sin .env.local vale la variable de entorno, si está.
}

const proyecto = proyectoDeArgumentos();
const origen = sinProyecto(process.argv.slice(2)).find((a) => !a.startsWith('--'));
if (!origen || !existsSync(origen)) {
  console.error('Uso: npm run fotos:propias -- --proyecto <id> <carpeta o .zip>');
  process.exit(1);
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('Falta ANTHROPIC_API_KEY en .env.local.');
  process.exit(1);
}

const rutas = rutasDe(proyecto);

/* ── las fotos de origen, de carpeta o de zip ─────────────────────────────── */

/** `{ partes: ['Francia', 'París', 'IMG_1.jpeg'], leer() }` por foto. */
async function listarOrigen(origen) {
  if (statSync(origen).isDirectory()) {
    const fotos = [];
    const recorrer = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const ruta = join(dir, e.name);
        if (e.isDirectory()) recorrer(ruta);
        else if (EXTENSIONES.has(extname(e.name).toLowerCase())) {
          fotos.push({ partes: relative(origen, ruta).split(sep), leer: async () => readFileSync(ruta) });
        }
      }
    };
    recorrer(origen);
    return fotos;
  }
  const zip = await JSZip.loadAsync(readFileSync(origen));
  return Object.values(zip.files)
    .filter((f) => !f.dir && EXTENSIONES.has(extname(f.name).toLowerCase()))
    .map((f) => {
      // Drive mete todo bajo una carpeta con el nombre de la carpeta compartida.
      const partes = f.name.split('/');
      return { partes: partes.length > 2 ? partes.slice(1) : partes, leer: () => f.async('nodebuffer') };
    });
}

/** País y ciudad salen de las carpetas: «Francia /París/x.jpeg». */
function lugarDe(partes) {
  const carpetas = partes.slice(0, -1).map((p) => p.trim());
  const nombre = basename(partes.at(-1), extname(partes.at(-1)));
  return {
    pais: carpetas[0] ?? '',
    ciudad: carpetas[1] ?? '',
    // Los nombres de Fotos de iOS son un UUID largo: los ocho primeros bastan.
    nombre: aSlug(nombre).split('-')[0].slice(0, 12) || aSlug(nombre),
  };
}

/* ── el catálogo ──────────────────────────────────────────────────────────── */

const catalogo = existsSync(rutas.catalogoFotos) ? JSON.parse(readFileSync(rutas.catalogoFotos, 'utf8')) : [];
const ya = new Set(catalogo.map((f) => f.id));

function guardarCatalogo() {
  catalogo.sort((a, b) => a.id.localeCompare(b.id));
  mkdirSync(dirname(rutas.catalogoFotos), { recursive: true });
  writeFileSync(rutas.catalogoFotos, JSON.stringify(catalogo, null, 2) + '\n');
}

/* ── describir ────────────────────────────────────────────────────────────── */

const cliente = new Anthropic();
let entrada = 0;
let salida = 0;

async function describir(tanda) {
  const contenido = [];
  for (const [n, f] of tanda.entries()) {
    contenido.push({ type: 'text', text: `Foto ${n + 1} — ${[f.pais, f.ciudad].filter(Boolean).join(', ')}` });
    contenido.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: f.vista.toString('base64') } });
  }
  contenido.push({
    type: 'text',
    text: `Son fotos de viaje de una agente de viajes. Van a ir de fondo, a sangre, en
carruseles de Instagram con una frase corta encima, y hay que poder elegirlas
sin abrirlas. Por cada foto, con su número:

  · descripcion — qué se ve, en español y en una frase concreta: "maleta abierta
    en el piso con vino, chocolates y una chamarra", "pantalla del avión con el
    mapa de llegada a Madrid". Si se reconoce el lugar, nómbralo.
  · etiquetas — de cinco a diez palabras en inglés, del vocabulario de un banco
    de fotos: "suitcase", "airplane", "eiffel tower", "street", "cafe".
  · personas — "ninguna"; "lejos" si sale alguien de espaldas, pequeño o sin
    que se le vea la cara; "rostro" si hay una cara que se reconoce.
  · centroLibre — si la franja del centro está despejada (cielo, pared, piso,
    agua) para poner dos renglones de texto blanco encima y que se lean.`,
  });

  const respuesta = await cliente.messages.parse({
    model: MODELO,
    max_tokens: 4000,
    messages: [{ role: 'user', content: contenido }],
    output_config: { format: zodOutputFormat(Descripcion) },
  });
  entrada += respuesta.usage.input_tokens;
  salida += respuesta.usage.output_tokens;
  const fotos = respuesta.parsed_output?.fotos ?? [];
  return tanda.map((f, i) => fotos.find((d) => d.n === i + 1));
}

/* ── todo junto ───────────────────────────────────────────────────────────── */

const fotos = await listarOrigen(origen);
const pendientes = [];
for (const foto of fotos) {
  const { pais, ciudad, nombre } = lugarDe(foto.partes);
  const id = [aSlug(pais), ciudad ? aSlug(ciudad) : '', nombre].filter(Boolean).join('/');
  if (ya.has(id)) continue;
  ya.add(id);
  pendientes.push({ ...foto, id, pais, ciudad });
}
console.log(`${fotos.length} fotos en el origen · ${catalogo.length} ya en el catálogo · ${pendientes.length} por hacer.`);

let hechas = 0;
let fallidas = 0;

async function procesar(tanda) {
  // Primero el archivo: enderezado según el EXIF, que es como se ve en el teléfono.
  for (const f of tanda) {
    const original = await f.leer();
    const derecha = sharp(original).rotate();
    const archivo = await derecha
      .clone()
      .resize({ width: LADO.ancho, height: LADO.alto, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 84, mozjpeg: true })
      .toBuffer();
    const meta = await sharp(archivo).metadata();
    f.ancho = meta.width;
    f.alto = meta.height;
    f.archivo = archivo;
    f.vista = await sharp(archivo).resize({ width: LADO_VISTA, height: LADO_VISTA, fit: 'inside' }).jpeg({ quality: 78 }).toBuffer();
  }

  let descripciones;
  try {
    descripciones = await describir(tanda);
  } catch (e) {
    fallidas += tanda.length;
    console.error(`  una tanda falló (${e instanceof Error ? e.message : e}); se reintenta al volver a correr.`);
    return;
  }

  for (const [i, f] of tanda.entries()) {
    const d = descripciones[i];
    if (!d) {
      fallidas++;
      continue;
    }
    const destino = join(rutas.fotos, ...f.id.split('/')) + '.jpg';
    mkdirSync(dirname(destino), { recursive: true });
    writeFileSync(destino, f.archivo);
    catalogo.push({
      id: f.id,
      url: `${rutas.urlFotos}/${f.id}.jpg`,
      pais: f.pais,
      ciudad: f.ciudad,
      ancho: f.ancho,
      alto: f.alto,
      descripcion: d.descripcion,
      etiquetas: d.etiquetas,
      personas: d.personas,
      centroLibre: d.centroLibre,
    });
    hechas++;
  }
  guardarCatalogo();
  console.log(`  ${hechas}/${pendientes.length}`);
}

const tandas = [];
for (let i = 0; i < pendientes.length; i += POR_TANDA) tandas.push(pendientes.slice(i, i + POR_TANDA));
for (let i = 0; i < tandas.length; i += A_LA_VEZ) {
  await Promise.all(tandas.slice(i, i + A_LA_VEZ).map(procesar));
}

guardarCatalogo();
console.log(
  `Listo: ${hechas} nuevas, ${fallidas} sin describir, ${catalogo.length} en el catálogo.` +
    (entrada ? ` Tokens: ${entrada} de entrada, ${salida} de salida (${MODELO}).` : ''),
);
if (fallidas) process.exitCode = 1;
