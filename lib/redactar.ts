import 'server-only';

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { NOMBRES_PALETA, PALETA_POR_DEFECTO, paletas } from '@/template/tokens';
import { afirmacionesDe } from './afirmaciones';
import { desescapar } from './brief';
import { FOTO_PENDIENTE } from './edicion';
import { leerMarca } from './posts';
import type { TMarca, TPost, TSlide } from './schema';

/**
 * lib/redactar.ts — el borrador que escribe el modelo.
 *
 * El modelo escribe **texto**, no diseño: devuelve los campos que la plantilla
 * espera y nada más. Todo lo que sea posición, tamaño o color se decide en
 * template/tokens.ts. Lo único parecido a diseño que sí elige es la paleta, y
 * la elige por el tema, con las mismas reglas que están escritas en el token.
 *
 * Lo que sale de aquí es siempre un **borrador**. La cola de revisión de
 * lib/afirmaciones.ts es lo que decide si puede llegar a aprobado, y no se
 * salta: entre generar y exportar hay una persona, siempre.
 */

const MODELO = 'claude-opus-5';

/**
 * La forma que se le pide al modelo.
 *
 * Todo obligatorio y sin uniones discriminadas a propósito: la salida
 * estructurada es más fiable con un esquema plano, y los campos que no aplican
 * se piden vacíos (`""`, `[]`) en vez de ausentes. La conversión a slides de
 * verdad la hace `aPost()` aquí abajo, donde el esquema estricto sí manda.
 */
const SlideRedactado = z.object({
  tipo: z.enum(['portada', 'contenido', 'lista', 'cierre']),
  titulo: z.string(),
  /** Solo en la portada: la pregunta del papel rasgado. */
  pregunta: z.string(),
  bajada: z.string(),
  cuerpo: z.string(),
  puntos: z.array(z.string()),
  fuente: z.string(),
  /** Solo en el cierre: la línea grande, si el tema pide una. */
  frase: z.string(),
  visual: z.enum(['foto', 'icono', 'ninguno']),
  ideaImagen: z.string(),
  iconoSugerido: z.string(),
});

const Redaccion = z.object({
  tema: z.string(),
  paleta: z.enum(NOMBRES_PALETA),
  /** Por qué esa paleta, en una línea. Se enseña; no se guarda en el post. */
  porQuePaleta: z.string(),
  /** Los tres del brief que no se pintan en ningún slide. Ver lib/schema.ts. */
  pilar: z.string(),
  objetivo: z.enum(['guardar', 'compartir', 'comentar', 'agendar']),
  nota: z.string(),
  slides: z.array(SlideRedactado).min(4).max(9),
  copy: z.string(),
  hashtags: z.array(z.string()),
  /**
   * Lo que el modelo dice haber afirmado.
   *
   * No se usa para construir la cola —la cola sale de leer el texto, porque un
   * modelo que inventa una cifra también puede omitirla de su lista— sino para
   * cruzarla: lo que el extractor encuentra y esto no declara es más
   * sospechoso, no menos.
   */
  afirmaciones: z.array(z.object({ texto: z.string(), fuente: z.string() })),
});

export type TRedaccion = z.infer<typeof Redaccion>;

export type ResultadoRedaccion = {
  post: TPost;
  porQuePaleta: string;
  avisos: string[];
};

export async function redactar(tema: string, slug: string): Promise<ResultadoRedaccion> {
  const voz = await readFile(join(process.cwd(), 'content', 'voz.md'), 'utf8');
  // La cuenta no está en voz.md, y el copy la necesita: el bloque 📲 nombra la
  // plataforma y el último hashtag lleva la ciudad.
  const marca = await leerMarca();
  const cliente = new Anthropic();

  let respuesta;
  try {
    // En streaming aunque no se enseñe el avance: un carrusel entero con
    // pensamiento adaptativo tarda lo bastante como para que una petición sin
    // stream se acerque al tiempo límite. `finalMessage()` trae igual el
    // `parsed_output`, así que aquí abajo no cambia nada.
    respuesta = await cliente.messages
      .stream({
        model: MODELO,
        max_tokens: 16000,
        thinking: { type: 'adaptive' },
        system: voz,
        messages: [{ role: 'user', content: instrucciones(tema, marca) }],
        output_config: { format: zodOutputFormat(Redaccion) },
      })
      .finalMessage();
  } catch (e) {
    throw new Error(explicar(e));
  }

  if (respuesta.stop_reason === 'refusal') {
    throw new Error(
      `El modelo declinó redactar este tema (${respuesta.stop_details?.category ?? 'sin categoría'}). ` +
        'Reformula el tema o escríbelo a mano.',
    );
  }
  if (respuesta.stop_reason === 'max_tokens') {
    throw new Error('La respuesta se cortó a la mitad. Prueba con un tema más acotado.');
  }

  const redaccion = respuesta.parsed_output;
  if (!redaccion) throw new Error('El modelo no devolvió la estructura esperada.');

  const post = aPost(redaccion, slug);
  return { post, porQuePaleta: redaccion.porQuePaleta, avisos: revisar(redaccion, post) };
}

/** El error de la API, dicho en el idioma del editor y no en el del SDK. */
function explicar(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) {
    return 'La ANTHROPIC_API_KEY no es válida. Revisa .env.local.';
  }
  if (e instanceof Anthropic.RateLimitError) {
    return 'La API está limitando las llamadas. Espera un minuto y vuelve a intentarlo.';
  }
  if (e instanceof Anthropic.APIConnectionError) {
    return 'No se pudo conectar con la API. Revisa la conexión.';
  }
  if (e instanceof Anthropic.APIError) {
    return `La API respondió ${e.status ?? 'con un error'}: ${e.message}`;
  }
  return e instanceof Error ? e.message : 'No se pudo redactar.';
}

/* ── el prompt ────────────────────────────────────────────────────────────── */

function instrucciones(tema: string, marca: TMarca) {
  const opciones = Object.entries(paletas)
    .map(([nombre, p]) => `  · ${nombre}: ${p.cuando}`)
    .join('\n');

  return `Escribe un carrusel de Instagram sobre: ${tema}

## La cuenta

${marca.nombre} · ${marca.usuario} · ${marca.especialidad} · ${marca.ciudad}.
Las citas se agendan en ${marca.plataforma}, con el enlace en la biografía.

## Estructura

Siete slides, en este orden, que es el de la cuenta:

  1. portada    — titulo con marcado, pregunta de cinco palabras o menos
  2. contenido  — qué es
  3. contenido  — cómo se reconoce
  4. contenido  — por qué importa ahora, o cómo se contagia
  5. lista      — cuatro puntos accionables
  6. contenido  — cuándo acudir a consulta
  7. cierre     — sin campos, salvo la línea grande si el tema pide una

En cada slide rellena solo lo que le toca y deja el resto vacío ("" o []).

## La paleta

Elige una por el tema:

${opciones}

Si el tema no tiene un color obvio —impétigo, dermatitis atópica— la respuesta
es "${PALETA_POR_DEFECTO}". Es la respuesta, no un relleno: no fuerces una
asociación de color que no está.

## El elemento visual

En cada slide de contenido elige "foto", "icono" o "ninguno", y llena:

  · ideaImagen — qué debe mostrar la foto, en una frase concreta y en español.
    Esto no se dibuja: es la instrucción para quien busque la imagen, y es lo
    que evita que acabe puesta una foto que no enseña lo que dice el texto.
  · iconoSugerido — el concepto en inglés, corto ("magnifying glass").

Nunca pidas una foto que muestre una lesión inventada o generada: las fotos
clínicas vienen de banco con licencia o del consultorio.

## Las cifras y las fuentes — lo más importante

Una cifra plausible con una institución al lado es el error más difícil de
cazar, porque llega con aspecto de verificado. Por eso:

  · Prefiere lo cualitativo. "Es de los motivos de consulta más frecuentes en
    verano" es mejor que "el 18% de las consultas de verano" si no estás seguro
    de la cifra. Bajar la especificidad siempre es preferible.
  · Si usas una cifra, tiene que llevar su institución en "fuente". Una cifra
    sin respaldo no debe existir.
  · Nunca atribuyas lo que no puedes atribuir. Si no sabes qué institución
    respalda un dato, quita el dato; no le pongas una institución plausible.
  · Declara en "afirmaciones" todo lo que afirmes como dato, con su fuente. Un
    médico va a revisar esa lista una por una antes de publicar.

Instituciones válidas: Mayo Clinic, Cleveland Clinic, AAP, AAD, KidsHealth,
StatPearls.

## Los tres campos que no se pintan en ningún slide

  · pilar — la línea editorial del post, en tres o cuatro palabras: "Cuidado
    diario de la piel", "Lo que no es alergia". Sirve para no repetir eje dos
    veces en el mismo mes.
  · objetivo — qué se busca del lector: guardar, compartir, comentar o agendar.
    Decide a cuál de los cierres del copy se le carga la mano.
  · nota — el gancho de calendario, corto: "Primeros calores", "Semana de
    frío". Qué hace que este tema toque publicarse ahora.

## El copy

Sigue la fórmula que está en tus instrucciones, con sus bloques y sus emojis, y
termina en exactamente cinco hashtags en MayúsculasPegadas, con su almohadilla
("#PielSensible"). El último cruza especialidad y ciudad.`;
}

/* ── de la redacción al post ──────────────────────────────────────────────── */

function aPost(r: TRedaccion, slug: string): TPost {
  const slides: TSlide[] = [];

  for (const bruto of r.slides) {
    // El modelo escribe los saltos de línea como `\n` de dos caracteres,
    // porque así se los describe voz.md. Sin esto el slide sale con un "\n"
    // impreso en medio del título; se vio en la primera redacción de prueba.
    const s = { ...bruto, titulo: desescapar(bruto.titulo), frase: desescapar(bruto.frase) };

    if (s.tipo === 'portada') {
      slides.push({ tipo: 'portada', titulo: s.titulo, pregunta: s.pregunta });
      continue;
    }
    if (s.tipo === 'cierre') {
      slides.push({ tipo: 'cierre', ...(s.frase ? { frase: s.frase } : {}) });
      continue;
    }
    if (s.tipo === 'lista') {
      slides.push({
        tipo: 'lista',
        titulo: s.titulo,
        puntos: s.puntos.slice(0, 5),
        ...(s.fuente ? { fuente: s.fuente } : {}),
      });
      continue;
    }

    slides.push({
      tipo: 'contenido',
      titulo: s.titulo,
      ...(s.bajada ? { bajada: s.bajada } : {}),
      cuerpo: s.cuerpo,
      // Ni la idea de imagen ni el ícono sugerido se dibujan: la primera es
      // para quien busque la foto, el segundo para el buscador de íconos.
      visual:
        s.visual === 'foto'
          ? { clase: 'foto', src: FOTO_PENDIENTE, ...(s.ideaImagen ? { ideaImagen: s.ideaImagen } : {}) }
          : s.visual === 'icono'
            ? { clase: 'icono', ...(s.iconoSugerido ? { iconoSugerido: s.iconoSugerido } : {}) }
            : { clase: 'ninguno' },
      ...(s.fuente ? { fuente: s.fuente } : {}),
    });
  }

  return {
    slug,
    tema: r.tema || 'Sin tema',
    creado: new Date().toISOString().slice(0, 10),
    // Siempre borrador. Lo que sale del modelo no está aprobado por nadie.
    estado: 'borrador',
    paleta: r.paleta ?? PALETA_POR_DEFECTO,
    copy: r.copy,
    ...(r.pilar ? { pilar: r.pilar } : {}),
    ...(r.objetivo ? { objetivo: r.objetivo } : {}),
    ...(r.nota ? { nota: r.nota } : {}),
    ...(r.hashtags.length ? { hashtags: r.hashtags } : {}),
    slides,
  };
}

/* ── el cruce ─────────────────────────────────────────────────────────────── */

function revisar(r: TRedaccion, post: TPost): string[] {
  const avisos: string[] = [];

  if (r.hashtags.length !== 5) {
    avisos.push(`Devolvió ${r.hashtags.length} hashtags; la fórmula pide cinco.`);
  }
  if (post.slides[0]?.tipo !== 'portada') avisos.push('El primer slide no es la portada.');
  if (post.slides.at(-1)?.tipo !== 'cierre') avisos.push('El último slide no es el cierre.');

  // El cruce: lo que se lee en el texto contra lo que el modelo dice haber
  // afirmado. Las que aparecen aquí y no en su lista no son un descuido menor.
  const declaradas = r.afirmaciones.map((a) => normalizar(a.texto));
  const noDeclaradas = afirmacionesDe(post).filter(
    (a) =>
      a.disparadores.includes('cifra') &&
      !declaradas.some((d) => d.includes(normalizar(a.texto).slice(0, 40)) || normalizar(a.texto).includes(d.slice(0, 40))),
  );
  for (const a of noDeclaradas) {
    avisos.push(`Afirma una cifra en ${a.donde} que no declaró: «${a.marcas.join(', ')}». Revísala con cuidado.`);
  }

  const sinFuente = afirmacionesDe(post).filter(
    (a) => a.disparadores.includes('cifra') && !a.fuente,
  );
  for (const a of sinFuente) {
    avisos.push(`Cifra sin fuente en ${a.donde}: «${a.marcas.join(', ')}». Quítala o atribúyela.`);
  }

  return avisos;
}

function normalizar(s: string) {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}
