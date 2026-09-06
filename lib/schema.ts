/**
 * lib/schema.ts
 *
 * La forma del contenido, en Zod. Se usa en tres momentos:
 *
 *  · al leer un JSON de content/posts/, para que un archivo editado a mano no
 *    reviente la app en silencio (falla al leerlo, con el campo y el motivo);
 *  · al guardar desde el editor (fase 4);
 *  · al validar lo que devuelve el modelo al redactar (fase 6).
 *
 * Es el mismo esquema en los tres casos a propósito: si la IA devuelve algo que
 * el editor no podría guardar, queremos enterarnos antes de escribirlo a disco.
 */
import { z } from 'zod';

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

export const Visual = z.discriminatedUnion('clase', [
  z.object({ clase: z.literal('ninguno') }),
  z.object({
    clase: z.literal('foto'),
    src: RutaLocal,
    alto: z.number().positive().optional(),
    /** Qué buscar en el banco de fotos. Lo llena la IA; no se dibuja. */
    ideaImagen: z.string().optional(),
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
  foto: RutaLocal.optional(),
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
 * El cierre toma de content/marca.json todo menos una cosa: la línea grande,
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
  /** El texto que va debajo del carrusel en Instagram. Ver content/voz.md. */
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
  papel: RutaLocal,
  palomita: RutaLocal,
  flecha: RutaLocal,
  iconosRecientes: z.array(z.string()).default([]),
});

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
