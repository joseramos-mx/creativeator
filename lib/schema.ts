/**
 * lib/schema.ts
 *
 * La forma del contenido, en Zod. Se usa en tres momentos:
 *
 *  · al leer un JSON de proyectos/<id>/posts/, para que un archivo editado a mano no
 *    reviente la app en silencio (falla al leerlo, con el campo y el motivo);
 *  · al guardar desde el editor (fase 4);
 *  · al validar lo que devuelve el modelo al redactar (fase 6).
 *
 * Es el mismo esquema en los tres casos a propósito: si la IA devuelve algo que
 * el editor no podría guardar, queremos enterarnos antes de escribirlo a disco.
 */
import { z } from 'zod';
import { NOMBRES_PALETA, PALETA_POR_DEFECTO } from '@/plantillas/clinica/tokens';
import { NOMBRES_PLANTILLA } from '@/plantillas/nombres';
import { fotosSinCredito } from './fotos';

/** Texto con el marcado de la plantilla: *serif itálica*, **negrita**, saltos. */
const TextoMarcado = z.string();

/** Ruta dentro de public/. Nunca una URL externa: Pinterest no es un CDN. */
const RutaLocal = z
  .string()
  .startsWith('/', 'las imágenes se guardan en public/ y la ruta empieza con /');

/**
 * La excepción de un slide: la única forma de meter píxeles a mano en el
 * contenido. Si un campo no está, manda el token.
 */
export const Overrides = z
  .object({
    /** Empuja el bloque de contenido hacia abajo (o hacia arriba, si es negativo). */
    offsetY: z.number(),
    tituloPx: z.number().positive(),
    cuerpoPx: z.number().positive(),
    mediaAncho: z.number().positive(),
    mediaAlto: z.number().positive(),
  })
  .partial();

/**
 * De dónde salió la foto y bajo qué términos.
 *
 * Va en el JSON del post y no en una hoja aparte porque la hoja aparte se
 * pierde. Una foto clínica publicada sin saber de dónde vino es un problema
 * que aparece meses después, cuando ya está en el feed y nadie se acuerda: si
 * era de banco, de un paciente o de una búsqueda de imágenes.
 *
 * `fuente` es de dónde se sacó —Unsplash, Freepik, el consultorio— y
 * `licencia` bajo qué se puede usar. Los dos hacen falta: "Unsplash" sin más
 * no dice si esa foto en concreto pedía atribución. `autor` y `url` son
 * opcionales porque no todas las licencias los exigen, pero cuando la licencia
 * pide crédito, ahí es donde va.
 */
export const Credito = z.object({
  fuente: z.string().min(1, 'de dónde salió la foto'),
  licencia: z.string().min(1, 'bajo qué términos se puede usar'),
  /**
   * El texto de la licencia, para que el nombre no haya que creérselo.
   *
   * "Pexels License" escrito en un JSON es una afirmación; con el enlace al
   * lado es una afirmación comprobable, que es toda la diferencia entre este
   * campo y el "verificada" que este proyecto no escribe en ningún sitio.
   */
  licenciaUrl: z.string().optional(),
  autor: z.string().optional(),
  url: z.string().optional(),
  /**
   * El consentimiento de la persona fotografiada: **la referencia del
   * documento, nunca un sí**.
   *
   * Un booleano diría que alguien firmó algo alguna vez y no serviría para
   * nada más. El consentimiento es revocable, así que el día que un paciente
   * lo retire hay que poder encontrar en qué carruseles salió su foto, y para
   * eso hace falta un identificador que se pueda buscar. Ver
   * `scripts/consentimiento.mjs`.
   */
  consentimiento: z
    .object({
      referencia: z.string().min(1, 'el identificador del documento firmado'),
      fecha: z.string().optional(),
    })
    .optional(),
});

export const Visual = z.discriminatedUnion('clase', [
  z.object({ clase: z.literal('ninguno') }),
  z.object({
    clase: z.literal('foto'),
    src: RutaLocal,
    alto: z.number().positive().optional(),
    /** Qué buscar en el banco de fotos. Lo llena la IA; no se dibuja. */
    ideaImagen: z.string().optional(),
    credito: Credito.optional(),
  }),
  z.object({
    clase: z.literal('icono'),
    /** Vacío = falta elegir ícono. El editor lo marca. */
    slug: z.string().optional(),
    tam: z.number().positive().optional(),
    /** Concepto corto en inglés para casar con el manifiesto. Lo llena la IA. */
    iconoSugerido: z.string().optional(),
  }),
]);

/** Ícono chico encima del título. No sustituye al visual: lo acompaña. */
export const Emblema = z.object({
  slug: z.string(),
  tam: z.number().positive().optional(),
});

const Portada = z.object({
  tipo: z.literal('portada'),
  titulo: TextoMarcado,
  pregunta: z.string(),
  /**
   * La portada lleva la foto suelta y no un `visual` como los de contenido,
   * porque aquí es fondo a sangre y no un bloque. El crédito va aparte por la
   * misma razón, pero es el mismo: una foto de portada sin procedencia es
   * exactamente el mismo problema que una de dentro.
   */
  foto: RutaLocal.optional(),
  fotoCredito: Credito.optional(),
  overrides: Overrides.optional(),
});

const Contenido = z.object({
  tipo: z.literal('contenido'),
  titulo: TextoMarcado,
  bajada: z.string().optional(),
  cuerpo: z.string(),
  emblema: Emblema.optional(),
  visual: Visual.default({ clase: 'ninguno' }),
  fuente: z.string().optional(),
  overrides: Overrides.optional(),
});

const Lista = z.object({
  tipo: z.literal('lista'),
  titulo: TextoMarcado,
  puntos: z.array(z.string()).min(2).max(5),
  fuente: z.string().optional(),
  overrides: Overrides.optional(),
});

/**
 * El cierre toma de proyecto.json todo menos una cosa: la línea grande,
 * que sí es de este carrusel. Acepta el marcado de la plantilla.
 */
const Cierre = z.object({
  tipo: z.literal('cierre'),
  frase: TextoMarcado.optional(),
});

export const Slide = z.discriminatedUnion('tipo', [Portada, Contenido, Lista, Cierre]);

export const Post = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/, 'solo minúsculas, números y guiones'),
  tema: z.string(),
  creado: z.string(),
  /** Filtra la lista y dice qué falta revisar del mes. */
  estado: z.enum(['borrador', 'aprobado', 'publicado']).default('borrador'),
  /**
   * La paleta del carrusel. Se valida contra las llaves que existen de verdad
   * en plantillas/clinica/tokens.ts, así que "naraja" falla al leer el archivo y no
   * cuatro pasos después, mirando el PNG ya exportado.
   *
   * Azul cuando el tema no tiene color obvio. Es la respuesta, no un relleno.
   */
  paleta: z.enum(NOMBRES_PALETA).default(PALETA_POR_DEFECTO),

  /** El texto que va debajo del carrusel en Instagram. Ver proyectos/<id>/voz.md. */
  copy: z.string().optional(),

  /**
   * Los tres datos del brief que no se pintan en ningún slide. Sirven para
   * decidir, y en la fase 6 para darle contexto al modelo cuando redacte.
   */

  /** La línea editorial. Sirve para no repetir eje dos veces en el mes. */
  pilar: z.string().optional(),
  /**
   * La acción que se busca del lector: guardar, compartir, comentar, agendar.
   * Determina cuál de los cierres del copy se enfatiza.
   */
  objetivo: z.string().optional(),
  /** El gancho de calendario: qué hace que este tema toque publicarse ahora. */
  nota: z.string().optional(),

  hashtags: z.array(z.string()).optional(),

  slides: z.array(Slide).min(2),
});

/**
 * El mismo post, con la barrera de las licencias.
 *
 * Va aparte de `Post` a propósito: **la barrera es del guardado, no de la
 * lectura**. Si la validación de lectura la exigiera, un carrusel publicado
 * antes de que este mecanismo existiera dejaría de poder abrirse, y el archivo
 * histórico se volvería ilegible por una regla que no existía cuando se
 * escribió. Leer nunca se bloquea; declararlo aprobado, sí.
 *
 * Y va en el estado, no en la exportación: `borrador` se guarda siempre, así
 * que redactar y editar no se interrumpen nunca.
 */
export const PostGuardable = Post.superRefine((post, ctx) => {
  if (post.estado === 'borrador') return;

  // Lo que no se puede decir de dónde salió no se declara aprobado. Las fotos
  // subidas a mano llevan su crédito puesto solas (ver CREDITO_PROPIO en
  // lib/edicion.ts), así que esto solo detiene a una foto que nadie sabe de
  // dónde vino.
  const sinCredito = fotosSinCredito(post);
  if (sinCredito.length > 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['estado'],
      message:
        `no se puede guardar como "${post.estado}" con ${sinCredito.length} ` +
        `${sinCredito.length === 1 ? 'foto sin fuente ni licencia' : 'fotos sin fuente ni licencia'}:\n` +
        sinCredito.map((f) => `      · ${f.donde} (${f.src})`).join('\n'),
    });
  }
});

export const Marca = z.object({
  nombre: z.string(),
  usuario: z.string(),
  especialidad: z.string(),
  ciudad: z.string(),
  plataforma: z.string(),
  /** Logotipo de la plataforma de citas. Si falta, se escribe el nombre. */
  plataformaLogo: RutaLocal.optional(),
  logo: RutaLocal,
  /** Puede ir vacío mientras no exista la foto del cierre. */
  retrato: z.string(),
  iconosRecientes: z.array(z.string()).default([]),
  /**
   * Las dos líneas de la llamada a la acción del cierre, encima del logo de la
   * plataforma. Aceptan el marcado de la plantilla, y `{ciudad}` y
   * `{plataforma}` se sustituyen por los de arriba: así cambiar de ciudad sigue
   * siendo cambiar un solo campo.
   */
  cierre: z.object({
    lugar: TextoMarcado,
    invitacion: TextoMarcado,
  }),
});

/**
 * proyectos/<id>/proyecto.json — la marca y lo que la app necesita saber de
 * la cuenta para escribir por ella.
 *
 * Lo que es de la marca y se pinta va en `Marca`, que es lo que recibe la
 * plantilla. Lo de aquí abajo solo lo leen la redacción y la búsqueda de fotos.
 */
export const Proyecto = Marca.extend({
  /** Qué diseño usa. Ver plantillas/nombres.ts. */
  plantilla: z.enum(NOMBRES_PLANTILLA),
  /**
   * Quién es la cuenta, dicho como lo diría un tercero: "un dermatólogo",
   * "una pediatra", "una distribuidora de acero". Entra en las frases de los
   * prompts que lo necesitan ("un carrusel de Instagram de …").
   */
  giro: z.string().min(3),
  /**
   * Las fuentes que el redactor puede citar. Fuera de esta lista, una cifra
   * no lleva respaldo, y el prompt se lo dice así.
   */
  fuentes: z.array(z.string().min(1)).min(1),
});

export type TCredito = z.infer<typeof Credito>;
export type TOverrides = z.infer<typeof Overrides>;
export type TVisual = z.infer<typeof Visual>;
export type TEmblema = z.infer<typeof Emblema>;
export type TSlide = z.infer<typeof Slide>;
/** Cada variante por separado, para tipar los componentes de cada tipo. */
export type TSlidePortada = Extract<TSlide, { tipo: 'portada' }>;
export type TSlideContenido = Extract<TSlide, { tipo: 'contenido' }>;
export type TSlideLista = Extract<TSlide, { tipo: 'lista' }>;
export type TSlideCierre = Extract<TSlide, { tipo: 'cierre' }>;

export type TPost = z.infer<typeof Post>;
export type TMarca = z.infer<typeof Marca>;
export type TProyecto = z.infer<typeof Proyecto>;

/**
 * Valida y explica. Zod solo dice "invalid"; esto dice en qué post, en qué
 * campo y qué se esperaba, que es lo que sirve cuando el archivo se editó a
 * mano y la app dejó de arrancar.
 */
export function validar<T>(esquema: z.ZodType<T>, datos: unknown, origen: string): T {
  const r = esquema.safeParse(datos);
  if (r.success) return r.data;

  const detalle = r.error.issues
    .map((i) => `  · ${i.path.join('.') || '(raíz)'}: ${i.message}`)
    .join('\n');
  throw new Error(`No se pudo leer ${origen}:\n${detalle}`);
}
