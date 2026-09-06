import type { Post, Slide } from '@/template/tipos';

/**
 * lib/brief.ts — de un brief pegado a mano al JSON del carrusel.
 *
 * El brief se escribe en un documento, no en un formulario, así que el lector
 * está hecho para ser tolerante: no le importan las mayúsculas, ni los acentos
 * de las etiquetas, ni los renglones en blanco de más, ni que un valor siga en
 * el renglón siguiente.
 *
 * La estructura que espera:
 *
 *     Pilar: prevención
 *     Objetivo: que identifiquen el impétigo a tiempo
 *     Tema: Impétigo en el regreso a clases
 *     Nota: publicar antes del 15 de agosto
 *     Frase: Costras color miel en la cara de tu hijo
 *     Hashtags: #impetigo #dermatologia #durango
 *
 *     Portada
 *     Título: *La infección de*\nRegreso **a clases**
 *     Pregunta: ¿Qué es el impétigo?
 *
 *     Slide 1
 *     Título: El impétigo se dispara\n**en el regreso a clases.**
 *     Bajada: Costras color miel: ojo, es contagioso.
 *     Cuerpo: Esas llaguitas con costra…
 *     Fuente: Cleveland Clinic.
 *     Imagen: niño con costras alrededor de la boca
 *
 *     Lista
 *     Título: **Qué hacer y qué no.**
 *     - Necesita antibiótico…
 *     - Que no se rasque…
 *
 *     Cierre
 *
 *     Copy:
 *     El texto completo que va debajo del carrusel.
 *
 * Lo único que hay que tocar para adaptarlo a otro formato de brief son los dos
 * diccionarios de abajo: ETIQUETAS y SECCIONES.
 */

/** Etiqueta del brief → campo. Se comparan sin acentos y en minúsculas. */
const ETIQUETAS: Record<string, string> = {
  pilar: 'pilar',
  objetivo: 'objetivo',
  tema: 'tema',
  titulo: 'titulo',
  nota: 'nota',
  notas: 'nota',
  frase: 'frase',
  hashtags: 'hashtags',
  hashtag: 'hashtags',
  copy: 'copy',
  'pie de foto': 'copy',
  caption: 'copy',
  pregunta: 'pregunta',
  bajada: 'bajada',
  cuerpo: 'cuerpo',
  texto: 'cuerpo',
  fuente: 'fuente',
  fuentes: 'fuente',
  imagen: 'imagen',
  foto: 'imagen',
  icono: 'icono',
  emblema: 'emblema',
};

/** Encabezado de sección → tipo de slide. */
const SECCIONES: { patron: RegExp; tipo: Slide['tipo'] | 'copy' }[] = [
  { patron: /^portada$/, tipo: 'portada' },
  { patron: /^cierre$/, tipo: 'cierre' },
  { patron: /^lista(\s.*)?$/, tipo: 'lista' },
  { patron: /^copy$/, tipo: 'copy' },
  { patron: /^(slide|contenido)\s*\d*$/, tipo: 'contenido' },
];

type Bloque = { tipo: Slide['tipo'] | 'copy' | 'meta'; campos: Record<string, string>; puntos: string[] };

export type ResultadoBrief = { post: Post; avisos: string[] };

export function leerBrief(texto: string, slugSugerido?: string): ResultadoBrief {
  const bloques = partirEnBloques(texto);
  const meta = bloques.find((b) => b.tipo === 'meta')?.campos ?? {};
  const avisos: string[] = [];

  const slides: Slide[] = [];
  // Se recortan los renglones en blanco de los extremos, pero no los de dentro.
  const copy = (bloques.find((b) => b.tipo === 'copy')?.campos.cuerpo ?? meta.copy ?? '')
    .trim();

  for (const bloque of bloques) {
    if (bloque.tipo === 'meta' || bloque.tipo === 'copy') continue;
    const slide = aSlide(bloque, avisos);
    if (slide) slides.push(slide);
  }

  if (slides.length === 0) {
    avisos.push('No encontré ningún slide. ¿Están los encabezados Portada, Slide 1, Lista y Cierre?');
  }
  if (slides.length && slides[0].tipo !== 'portada') {
    avisos.push('El primer slide no es una portada: la numeración va a salir corrida.');
  }
  if (slides.length && slides[slides.length - 1].tipo !== 'cierre') {
    avisos.push('El último slide no es el cierre.');
  }
  if (!copy) avisos.push('No encontré el copy. Búscalo bajo un encabezado "Copy:".');

  const tema = meta.tema ?? meta.titulo ?? 'Sin tema';
  const hashtags = meta.hashtags
    ? meta.hashtags
        .split(/[\s,]+/)
        .map((h) => h.trim())
        .filter(Boolean)
    : undefined;

  if (hashtags && hashtags.length !== 5) {
    avisos.push(`El brief trae ${hashtags.length} hashtags; la fórmula del copy pide cinco.`);
  }

  const post: Post = {
    slug: slugSugerido ?? aSlug(tema),
    tema,
    creado: new Date().toISOString().slice(0, 10),
    estado: 'borrador',
    ...(copy ? { copy } : {}),
    ...(meta.pilar ? { pilar: meta.pilar } : {}),
    ...(meta.objetivo ? { objetivo: meta.objetivo } : {}),
    ...(meta.nota ? { nota: meta.nota } : {}),
    ...(meta.frase ? { frase: meta.frase } : {}),
    ...(hashtags ? { hashtags } : {}),
    slides: slides.length >= 2 ? slides : [...slides, { tipo: 'cierre' }],
  };

  return { post, avisos };
}

function partirEnBloques(texto: string): Bloque[] {
  const bloques: Bloque[] = [];
  let actual: Bloque = { tipo: 'meta', campos: {}, puntos: [] };
  let ultimoCampo: string | null = null;

  for (const crudo of texto.replace(/\r\n?/g, '\n').split('\n')) {
    const linea = crudo.trim();

    // ¿Es un encabezado de sección?
    const seccion = linea
      ? SECCIONES.find((s) => s.patron.test(sinAcentos(linea.replace(/:$/, ''))))
      : undefined;
    if (seccion) {
      bloques.push(actual);
      actual = { tipo: seccion.tipo, campos: {}, puntos: [] };
      ultimoCampo = null;
      continue;
    }

    // Dentro del copy manda el texto tal cual. Los renglones en blanco separan
    // bloques y son parte de la fórmula, así que no se comen; y un renglón que
    // empiece con un emoji o con un guion es contenido, no una etiqueta ni un
    // punto de lista.
    if (actual.tipo === 'copy') {
      const previo = actual.campos.cuerpo;
      actual.campos.cuerpo = previo === undefined ? crudo.trimEnd() : `${previo}\n${crudo.trimEnd()}`;
      continue;
    }

    if (!linea) {
      ultimoCampo = null;
      continue;
    }

    // ¿Un punto de lista?
    const punto = linea.match(/^[-•*·]\s+(.*)$/);
    if (punto) {
      actual.puntos.push(punto[1].trim());
      ultimoCampo = null;
      continue;
    }

    // ¿Una etiqueta?
    const etiqueta = linea.match(/^([A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]{2,20}):\s*(.*)$/);
    const campo = etiqueta ? ETIQUETAS[sinAcentos(etiqueta[1].trim())] : undefined;
    if (etiqueta && campo) {
      actual.campos[campo] = etiqueta[2].trim();
      ultimoCampo = campo;
      continue;
    }

    // Si no, es continuación del campo anterior.
    if (ultimoCampo) {
      actual.campos[ultimoCampo] = `${actual.campos[ultimoCampo] ?? ''}\n${linea}`.trim();
    }
  }

  bloques.push(actual);
  return bloques;
}

function aSlide(bloque: Bloque, avisos: string[]): Slide | null {
  const c = bloque.campos;
  const titulo = desescapar(c.titulo ?? '');

  switch (bloque.tipo) {
    case 'portada':
      if (!titulo) avisos.push('La portada no trae título.');
      return { tipo: 'portada', titulo, pregunta: c.pregunta ?? '' };

    case 'cierre':
      return { tipo: 'cierre' };

    case 'lista':
      if (bloque.puntos.length < 2) {
        avisos.push('La lista trae menos de dos puntos; ponlos con un guion al principio.');
        return null;
      }
      return {
        tipo: 'lista',
        titulo,
        puntos: bloque.puntos.slice(0, 5),
        ...(c.fuente ? { fuente: c.fuente } : {}),
      };

    case 'contenido':
      return {
        tipo: 'contenido',
        titulo,
        ...(c.bajada ? { bajada: c.bajada } : {}),
        cuerpo: c.cuerpo ?? '',
        ...(c.emblema ? { emblema: { slug: c.emblema } } : {}),
        // La idea de imagen y el ícono sugerido no se dibujan: son instrucciones
        // para el humano y, en la fase 5, para el buscador de íconos.
        visual: c.imagen
          ? { clase: 'foto', src: '/media/pendiente.jpg', ideaImagen: c.imagen }
          : c.icono
            ? { clase: 'icono', iconoSugerido: c.icono }
            : { clase: 'ninguno' },
        ...(c.fuente ? { fuente: c.fuente } : {}),
      };

    default:
      return null;
  }
}

/** En el brief los saltos de los títulos se escriben \n a mano. */
function desescapar(s: string) {
  return s.replace(/\\n/g, '\n');
}

function sinAcentos(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function aSlug(s: string) {
  return (
    sinAcentos(s)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'carrusel'
  );
}
