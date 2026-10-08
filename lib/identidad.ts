import 'server-only';

import { extname, join } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import sharp from 'sharp';
import { z } from 'zod';
import { CUESTIONARIO, EXTENSIONES_MATERIAL, respuestasComoTexto, type Respuestas } from './cuestionario';
import { MODELO_REDACCION } from './modelo';
import { almacen, guardar, type Cambio } from './almacen';
import { hayProyecto } from './posts';
import { PROYECTO_DE_PRUEBAS, rutasDe } from './proyecto';

/**
 * lib/identidad.ts — quién es la cuenta, por escrito.
 *
 * Cada proyecto que se lleva tiene un manual de identidad, posts pasados, un
 * Canva o un documento que dice a qué se dedican y cómo llegaron ahí. Eso se
 * sube aquí como **materiales**, se contesta el cuestionario de
 * lib/cuestionario.ts, y Claude lo lee todo para escribir:
 *
 *  · `identidad.md` — el documento de la cuenta, para personas y para la IA;
 *  · `voz.md` y las piezas de `prompts/` — adaptados de esa identidad;
 *  · los campos de `proyecto.json` que salen de ahí: nombre, ciudad, cierre…;
 *  · y las **preguntas** que le faltan, en vez de inventar las respuestas.
 *
 * **Nada se escribe sin que alguien lo vea.** `proponerTextos` solo devuelve
 * la propuesta; `guardarTextos` es otro paso, desde la página de identidad,
 * después de leerla y corregirla. Una cuenta que ya tiene su voz afinada a mano
 * —la del Dr. Edwin— no la pierde por darle a un botón.
 */

/* ── el cuestionario ─────────────────────────────────────────────────────── */

export async function leerCuestionario(proyecto: string): Promise<Respuestas> {
  const crudo = (await almacen.leerTexto(rutasDe(proyecto).cuestionario)) ?? '{}';
  const leido = JSON.parse(crudo) as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(leido).filter((e): e is [string, string] => typeof e[1] === 'string'),
  );
}

export async function guardarCuestionario(proyecto: string, respuestas: Respuestas): Promise<void> {
  const validas = new Set(CUESTIONARIO.flatMap((s) => s.preguntas.map((p) => p.id)));
  const limpias = Object.fromEntries(
    Object.entries(respuestas).filter(([id, v]) => validas.has(id) && typeof v === 'string' && v.trim()),
  );
  await guardar(rutasDe(proyecto).cuestionario, `${JSON.stringify(limpias, null, 2)}\n`, `${proyecto}: cuestionario de identidad`);
}

/* ── los materiales ──────────────────────────────────────────────────────── */

export type Material = { nombre: string; bytes: number };

/**
 * El tope de lo que se le manda a Claude de una vez. La API acepta 32 MB por
 * petición; se deja aire para el texto y para que el base64 no lo rebase.
 */
const TOPE_BYTES = 22 * 1024 * 1024;

/** Lado largo de una imagen. Más grande no le da más a Claude y cuesta más. */
const LADO_IMAGEN = 1568;

export async function listarMateriales(proyecto: string): Promise<Material[]> {
  const entradas = await almacen.listar(rutasDe(proyecto).materiales);
  return entradas
    .filter((e) => e.tipo === 'archivo' && EXTENSIONES_MATERIAL.includes(extname(e.nombre).toLowerCase()))
    .map((e) => ({ nombre: e.nombre, bytes: e.bytes }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

function nombreSeguro(nombre: string): string {
  const ext = extname(nombre).toLowerCase();
  const base = nombre
    .slice(0, nombre.length - ext.length)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return `${base || 'material'}${ext}`;
}

/**
 * Guarda un material. Las imágenes se bajan a 1568 px de lado largo, que es lo
 * más que Claude aprovecha: un PNG de 4500 px exportado de Canva pesaría diez
 * veces más y no diría nada más.
 */
export async function guardarMaterial(proyecto: string, nombre: string, datos: Buffer): Promise<Material> {
  const ext = extname(nombre).toLowerCase();
  if (!EXTENSIONES_MATERIAL.includes(ext)) {
    throw new Error(
      `«${nombre}» no se puede leer. Sirven PDF, imágenes (PNG, JPG, WebP, GIF) y texto (MD, TXT); ` +
        'un Word o un Canva se exportan a PDF primero.',
    );
  }
  let bytes = datos;
  if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
    const meta = await sharp(datos).metadata();
    if (Math.max(meta.width ?? 0, meta.height ?? 0) > LADO_IMAGEN) {
      bytes = await sharp(datos).resize({ width: LADO_IMAGEN, height: LADO_IMAGEN, fit: 'inside' }).toBuffer();
    }
  }
  const final = nombreSeguro(nombre);
  await guardar(join(rutasDe(proyecto).materiales, final), bytes, `${proyecto}: material ${final}`);
  return { nombre: final, bytes: bytes.length };
}

export async function quitarMaterial(proyecto: string, nombre: string): Promise<void> {
  // Solo un nombre que ya esté en la lista: nada de rutas armadas desde fuera.
  const existe = (await listarMateriales(proyecto)).some((m) => m.nombre === nombre);
  if (existe) {
    await almacen.escribir(
      [{ ruta: join(rutasDe(proyecto).materiales, nombre), datos: null }],
      `${proyecto}: quitar material ${nombre}`,
    );
  }
}

const TIPO_IMAGEN: Record<string, 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

/** Los materiales como bloques de contenido para Claude. */
async function bloquesDeMateriales(proyecto: string): Promise<Anthropic.ContentBlockParam[]> {
  const dir = rutasDe(proyecto).materiales;
  const materiales = await listarMateriales(proyecto);
  const total = materiales.reduce((s, m) => s + m.bytes, 0);
  if (total > TOPE_BYTES) {
    throw new Error(
      `Los materiales pesan ${(total / 1048576).toFixed(1)} MB y caben ${TOPE_BYTES / 1048576} MB. ` +
        'Quita alguno o sube el PDF del manual con menos páginas.',
    );
  }

  const bloques: Anthropic.ContentBlockParam[] = [];
  for (const m of materiales) {
    const ext = extname(m.nombre).toLowerCase();
    const datos = await almacen.leer(join(dir, m.nombre));
    if (!datos) continue;
    if (ext === '.pdf') {
      bloques.push({
        type: 'document',
        title: m.nombre,
        source: { type: 'base64', media_type: 'application/pdf', data: datos.toString('base64') },
      });
    } else if (TIPO_IMAGEN[ext]) {
      bloques.push({ type: 'text', text: `Material: ${m.nombre}` });
      bloques.push({
        type: 'image',
        source: { type: 'base64', media_type: TIPO_IMAGEN[ext], data: datos.toString('base64') },
      });
    } else {
      bloques.push({ type: 'text', text: `Material: ${m.nombre}\n\n${datos.toString('utf8')}` });
    }
  }
  return bloques;
}

/* ── los textos de la cuenta ─────────────────────────────────────────────── */

const Marca = z.object({
  nombre: z.string(),
  usuario: z.string(),
  especialidad: z.string(),
  ciudad: z.string(),
  plataforma: z.string(),
  giro: z.string(),
  fuentes: z.array(z.string()),
  cierre: z.object({ lugar: z.string(), invitacion: z.string() }),
});

/** Todo lo que sale de la identidad, con el nombre del archivo donde va. */
export const Textos = z.object({
  identidad: z.string(),
  voz: z.string(),
  alcance: z.string(),
  estructura: z.string(),
  iconos: z.string(),
  fotos: z.string(),
  fotosBanco: z.string(),
  marca: Marca,
});

export type TTextos = z.infer<typeof Textos>;

const Propuesta = Textos.extend({
  /** Lo que falta saber. Se enseña; no se guarda. */
  preguntas: z.array(z.string()),
});

export type TPropuesta = z.infer<typeof Propuesta>;

const PIEZAS = { alcance: 'alcance', estructura: 'estructura', iconos: 'iconos', fotos: 'fotos', fotosBanco: 'fotos-banco' } as const;

const leerSiHay = async (ruta: string) => (await almacen.leerTexto(ruta)) ?? '';

/** Los textos como están en disco, para la página de identidad. */
export async function leerTextos(proyecto: string): Promise<TTextos> {
  const r = rutasDe(proyecto);
  const config = JSON.parse((await almacen.leerTexto(r.config)) ?? '{}');
  const piezas = Object.fromEntries(
    await Promise.all(
      Object.entries(PIEZAS).map(async ([clave, archivo]) => [clave, await leerSiHay(r.prompt(archivo))]),
    ),
  ) as Record<keyof typeof PIEZAS, string>;
  return {
    identidad: await leerSiHay(r.identidad),
    voz: await leerSiHay(r.voz),
    ...piezas,
    marca: {
      nombre: config.nombre ?? '',
      usuario: config.usuario ?? '',
      especialidad: config.especialidad ?? '',
      ciudad: config.ciudad ?? '',
      plataforma: config.plataforma ?? '',
      giro: config.giro ?? '',
      fuentes: Array.isArray(config.fuentes) ? config.fuentes : [],
      cierre: config.cierre ?? { lugar: '', invitacion: '' },
    },
  };
}

/**
 * Escribe los textos que se revisaron en la página. `proyecto.json` se edita
 * sobre lo que ya tenía: logo, plantilla e íconos recientes no son de aquí.
 */
export async function guardarTextos(proyecto: string, textos: TTextos): Promise<void> {
  const r = rutasDe(proyecto);
  const limpio = Textos.parse(textos);
  const conSalto = (t: string) => (t.trim() ? `${t.trim()}\n` : '');

  const cambios: Cambio[] = [
    { ruta: r.identidad, datos: conSalto(limpio.identidad) },
    { ruta: r.voz, datos: conSalto(limpio.voz) },
    ...Object.entries(PIEZAS).map(([clave, archivo]) => ({
      ruta: r.prompt(archivo),
      datos: conSalto(limpio[clave as keyof typeof PIEZAS]),
    })),
  ];

  const config = JSON.parse((await almacen.leerTexto(r.config)) ?? '{}');
  const { fuentes, cierre, ...resto } = limpio.marca;
  cambios.push({
    ruta: r.config,
    datos: `${JSON.stringify(
      {
        ...config,
        ...Object.fromEntries(Object.entries(resto).map(([k, v]) => [k, v.trim()])),
        fuentes: fuentes.map((f) => f.trim()).filter(Boolean),
        cierre: { lugar: cierre.lugar.trim(), invitacion: cierre.invitacion.trim() },
      },
      null,
      2,
    )}\n`,
  });
  // Todo en un commit: la identidad, la voz y la marca cambian juntas.
  await almacen.escribir(cambios, `${proyecto}: identidad y textos de la IA`);
}

/** La identidad de la cuenta, si ya tiene. La redacción la lee con la voz. */
export async function leerIdentidad(proyecto: string): Promise<string | undefined> {
  const texto = (await leerSiHay(rutasDe(proyecto).identidad)).trim();
  return texto || undefined;
}

/* ── la propuesta ────────────────────────────────────────────────────────── */

/**
 * Los textos de otra cuenta, como ejemplo de **forma**. Las piezas se insertan
 * en medio de prompts fijos —una empieza a media frase, otra va sangrada como
 * viñeta—, y eso se enseña mejor con un ejemplo que se describe.
 */
async function ejemploDeForma(proyecto: string): Promise<string> {
  if (proyecto === PROYECTO_DE_PRUEBAS || !(await hayProyecto(PROYECTO_DE_PRUEBAS))) return '';
  const t = await leerTextos(PROYECTO_DE_PRUEBAS);
  if (!t.voz) return '';
  const bloque = (titulo: string, texto: string) => `### ${titulo}\n\n<ejemplo>\n${texto.trim()}\n</ejemplo>`;
  return `## Así se ven en otra cuenta

Son de ${t.marca.nombre} (${t.marca.giro}). **Imita la forma, la extensión y el
nivel de detalle; nunca el contenido.** Nada de lo de abajo es de la cuenta
nueva.

${bloque('voz', t.voz)}

${bloque('alcance (va justo después de «<especialidad>. »)', t.alcance)}

${bloque('estructura', t.estructura)}

${bloque('iconos (el primer párrafo va sangrado: continúa una viñeta)', t.iconos)}

${bloque('fotos', t.fotos)}

${bloque('fotosBanco (con su encabezado)', t.fotosBanco)}

### marca

<ejemplo>
${JSON.stringify(t.marca, null, 2)}
</ejemplo>`;
}

function instrucciones(respuestas: Respuestas, materiales: Material[], actual: TTextos, ejemplo: string): string {
  const contestado = respuestasComoTexto(respuestas);
  return `Vas a conocer una cuenta de Instagram y Facebook para la que una agencia
escribe carruseles, y a dejar por escrito quién es y cómo se escribe por ella.

## Lo que contestó quien lleva la cuenta

${contestado || '(No contestó el cuestionario: todo sale de los materiales.)'}

## Los materiales

${
  materiales.length
    ? `Van arriba: ${materiales.map((m) => m.nombre).join(', ')}. Pueden ser el manual de
identidad, posts publicados, el Canva de una plantilla o el documento del
negocio. Léelos todos. **El tono de verdad está en los posts publicados más que
en lo que la cuenta dice de sí misma**: si se contradicen, manda lo publicado y
dilo en preguntas.`
    : '(No hay materiales: todo sale del cuestionario.)'
}

${
  actual.identidad.trim()
    ? `## La identidad que ya tiene

Ya existe una. Mejórala con lo nuevo; no la tires.

<identidad_actual>
${actual.identidad.trim()}
</identidad_actual>`
    : ''
}

## Lo que tienes que escribir

**identidad** — un documento Markdown con estas secciones, en este orden:

  # <nombre de la cuenta>
  ## A qué se dedican
  ## Cómo llegaron aquí
  ## Qué los hace distintos
  ## A quién le hablan
  ## Cómo suenan — tono, trato, frases que sí, frases que no, emojis
  ## De qué hablan y de qué no
  ## Identidad visual — colores (con su hex si aparece), tipografías, estilo de
     imagen, tal como salen del manual o de los posts
  ## Lo que no se dice nunca

Escribe lo que sabes. **Lo que no sabes no lo inventes**: deja la sección corta
y pon lo que falta en preguntas. Una identidad con huecos se completa; una con
datos inventados se publica.

**voz** — el system prompt de quien redacta los carruseles. En segunda persona
("Escribes los carruseles de…"), con: a quién le hablas, cómo suenas, los
límites (lo que no se promete ni se dice), y la fórmula del copy de la
publicación: sus bloques, sus emojis si los usa la cuenta, el cierre según el
objetivo —guardar, compartir, comentar o agendar— y cinco hashtags en
MayúsculasPegadas, el último cruzando especialidad y ciudad.

**alcance** — qué temas son de la cuenta y cuáles no, aunque se parezcan. Va
justo después de la especialidad, así que empieza continuando esa frase.

**estructura** — cuántos slides lleva un carrusel y qué va en cada uno, en lista
numerada. Los tipos que existen son portada (siempre el primero, con foto),
contenido y lista. Entre cuatro y ocho slides. El cierre no se cuenta: se añade
solo.

**iconos** — lo que nunca se pide como ícono en esta cuenta, y qué pedir en su
lugar. **fotos** — qué foto de banco sí y cuál no, para quien redacta.
**fotosBanco** — lo mismo para quien busca la foto, con un encabezado \`##\`.

**marca** — nombre, usuario (con @), especialidad (como la firmaría la cuenta),
ciudad, plataforma (dónde agenda o contacta la gente), giro ("una pediatra",
"una distribuidora de acero": quién es, dicho por un tercero), fuentes (las que
puede citar; si no hay ninguna clara, las instituciones de referencia de su
rama) y cierre: dos líneas cortas para el último slide, \`lugar\` y
\`invitacion\` ("*Consulta en* **{ciudad}**", "Agenda tu cita desde"). Aceptan
*itálica* y **negrita**; {ciudad} y {plataforma} se sustituyen solos.

**preguntas** — lo que te falta saber para que todo lo anterior sea de verdad
de esta cuenta. Como mucho ocho, concretas, contestables en una línea. Si con lo
que hay alcanza, déjala vacía.

Todo en español de México.

${ejemplo}`;
}

export async function proponerTextos(proyecto: string): Promise<TPropuesta> {
  const [respuestas, materiales, actual, bloques, ejemplo] = await Promise.all([
    leerCuestionario(proyecto),
    listarMateriales(proyecto),
    leerTextos(proyecto),
    bloquesDeMateriales(proyecto),
    ejemploDeForma(proyecto),
  ]);

  if (!Object.keys(respuestas).length && !materiales.length) {
    throw new Error('Contesta el cuestionario o sube algún material primero: no hay de dónde sacar la identidad.');
  }

  const cliente = new Anthropic();
  let respuesta;
  try {
    // En streaming: con un manual en PDF y una docena de posts, la respuesta
    // tarda lo bastante como para que una petición sin stream se corte.
    respuesta = await cliente.messages
      .stream({
        model: MODELO_REDACCION,
        max_tokens: 32000,
        thinking: { type: 'adaptive' },
        messages: [
          {
            role: 'user',
            content: [...bloques, { type: 'text', text: instrucciones(respuestas, materiales, actual, ejemplo) }],
          },
        ],
        output_config: { format: zodOutputFormat(Propuesta) },
      })
      .finalMessage();
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new Error('La llave de Anthropic no es válida. Revisa ANTHROPIC_API_KEY.');
    if (e instanceof Anthropic.RateLimitError) throw new Error('Demasiadas peticiones seguidas. Espera un minuto.');
    if (e instanceof Anthropic.APIError) throw new Error(`La API respondió ${e.status}: ${e.message}`);
    throw e;
  }

  if (respuesta.stop_reason === 'refusal') {
    throw new Error('El modelo declinó escribir la identidad. Revisa los materiales.');
  }
  if (respuesta.stop_reason === 'max_tokens') {
    throw new Error('La respuesta se cortó a la mitad. Prueba con menos materiales.');
  }
  const propuesta = respuesta.parsed_output;
  if (!propuesta) throw new Error('El modelo no devolvió la estructura esperada.');
  return propuesta;
}
