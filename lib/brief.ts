import { PALETA_POR_DEFECTO } from '@/plantillas/clinica/tokens';
import type { Post, Slide } from '@/plantillas/clinica/tipos';
import { FOTO_PENDIENTE } from './edicion';
// El slug vive aparte para que la tanda del mes pueda calcularlo sin cargar
// este archivo, que importa con el alias `@/`. Ver lib/slug.ts.
import { aSlug, sinAcentos } from './slug';

export { aSlug };

/**
 * lib/brief.ts — de un brief pegado a mano al JSON del carrusel.
 *
 * El brief se escribe en un documento, no en un formulario, así que el lector
 * está hecho para aguantar cómo se escribe de verdad: encabezados de Markdown,
 * etiquetas con paréntesis (`Fuente (al pie):`), varias etiquetas en un mismo
 * renglón, valores entre comillas y renglones sueltos que son notas para el
 * diseñador y no campos.
 *
 * El ejemplo vivo está en `proyectos/dr-edwin/ejemplos/impetigo-brief.md`. En resumen:
 *
 *     # Publicación 2 · Impétigo: la infección del regreso a clases
 *
 *     Pilar: Diagnóstico que salva. Objetivo: guardar. Nota: Regreso a clases.
 *
 *     ## Portada
 *     Foto: la cara de un niño con costras…
 *     Título: "Costras color miel en la cara de tu hijo…"
 *     Recorte de papel: "El impétigo se dispara en el regreso a clases."
 *
 *     ## Diapositiva 01 · Qué es
 *     Título: "¿Qué es el impétigo?"
 *     Texto: "Esas llaguitas con costra amarilla…"
 *     Fuente (al pie): Cleveland Clinic.
 *     Ícono: una lupa en 3D 🔍.
 *
 *     ## Diapositiva 04 · Qué hacer
 *     - "Necesita antibiótico…"
 *     - "Que no se rasque…"
 *
 *     ## Copy de la publicación
 *     …
 *
 * Un aviso que vale más que el lector: **lo que trae el brief no es el arte
 * final**. En el ejemplo, el título de la portada acabó siendo otro, los íconos
 * publicados no son los que proponía y la sección de cierre describe una
 * plantilla anterior. El brief es el punto de partida del texto, no una
 * especificación del diseño; por eso el importador enseña qué entendió y no
 * reemplaza nada hasta que alguien lo mira.
 *
 * Para adaptarlo a otro formato de brief se tocan los dos diccionarios de abajo.
 */

/** Etiqueta del brief → campo. Se comparan sin acentos y en minúsculas. */
const ETIQUETAS: Record<string, string> = {
  pilar: 'pilar',
  objetivo: 'objetivo',
  nota: 'nota',
  notas: 'nota',
  tema: 'tema',
  hashtags: 'hashtags',
  hashtag: 'hashtags',
  copy: 'copy',
  caption: 'copy',

  titulo: 'titulo',
  texto: 'cuerpo',
  cuerpo: 'cuerpo',
  bajada: 'bajada',
  pregunta: 'pregunta',
  'recorte de papel': 'pregunta',
  papel: 'pregunta',
  fuente: 'fuente',
  fuentes: 'fuente',
  foto: 'imagen',
  imagen: 'imagen',
  icono: 'icono',
  emblema: 'emblema',
  frase: 'frase',
  'linea grande': 'frase',
  'linea grande personalizada': 'frase',
};

/** Etiquetas que pueden venir varias en un mismo renglón, separadas por punto. */
const EN_LINEA = ['pilar', 'objetivo', 'nota', 'notas', 'tema'];

type TipoBloque = Slide['tipo'] | 'copy' | 'meta';
type Bloque = { tipo: TipoBloque; campos: Record<string, string>; puntos: string[] };

export type ResultadoBrief = { post: Post; avisos: string[] };

export function leerBrief(texto: string, slugSugerido?: string): ResultadoBrief {
  const { bloques, titulo } = partirEnBloques(texto);
  const meta = bloques.find((b) => b.tipo === 'meta')?.campos ?? {};
  const avisos: string[] = [];

  const copy = (bloques.find((b) => b.tipo === 'copy')?.campos.cuerpo ?? meta.copy ?? '').trim();

  const slides: Slide[] = [];
  for (const bloque of bloques) {
    if (bloque.tipo === 'meta' || bloque.tipo === 'copy') continue;
    const slide = aSlide(bloque, avisos);
    if (slide) slides.push(slide);
  }

  if (slides.length === 0) {
    avisos.push('No encontré ningún slide. ¿Están los encabezados de Portada, Diapositiva y Cierre?');
  }
  if (slides.length && slides[0].tipo !== 'portada') {
    avisos.push('El primer slide no es una portada: la numeración va a salir corrida.');
  }
  if (slides.length && slides[slides.length - 1].tipo !== 'cierre') {
    avisos.push('El último slide no es el cierre.');
  }
  if (!copy) avisos.push('No encontré el copy. Búscalo bajo un encabezado "Copy de la publicación".');

  // Los hashtags casi nunca vienen etiquetados: son el último renglón del copy.
  const hashtags = sacarHashtags(meta.hashtags ?? ultimoRenglon(copy));
  if (hashtags && hashtags.length !== 5) {
    avisos.push(`Encontré ${hashtags.length} hashtags; la fórmula del copy pide cinco.`);
  }

  const tema = meta.tema ?? titulo ?? 'Sin tema';

  const post: Post = {
    slug: slugSugerido ?? aSlug(tema),
    tema,
    creado: new Date().toISOString().slice(0, 10),
    estado: 'borrador',
    // El brief no dice de qué color va el post. Azul es la respuesta por
    // defecto; el redactor de la fase 6 o el editor la cambian si el tema
    // tiene color obvio.
    paleta: PALETA_POR_DEFECTO,
    ...(copy ? { copy } : {}),
    ...(meta.pilar ? { pilar: meta.pilar } : {}),
    ...(meta.objetivo ? { objetivo: meta.objetivo } : {}),
    ...(meta.nota ? { nota: meta.nota } : {}),
    ...(hashtags ? { hashtags } : {}),
    slides: slides.length >= 2 ? slides : [...slides, { tipo: 'cierre' }],
  };

  return { post, avisos };
}

/* ── partir el documento ──────────────────────────────────────────────────── */

function partirEnBloques(texto: string) {
  const bloques: Bloque[] = [];
  let actual: Bloque = { tipo: 'meta', campos: {}, puntos: [] };
  let ultimoCampo: string | null = null;
  let titulo: string | undefined;

  for (const crudo of texto.replace(/\r\n?/g, '\n').split('\n')) {
    const linea = crudo.trim();
    const encabezado = linea.match(/^(#{1,6})\s*(.+)$/);

    // El título del documento: "# Publicación 2 · Impétigo: …" → lo de después
    // del separador, que es el tema de verdad.
    if (encabezado && encabezado[1].length === 1 && !titulo) {
      const partes = encabezado[2].split(/\s*[·|–—]\s*/);
      titulo = (partes.length > 1 ? partes.slice(1).join(' · ') : partes[0]).trim();
      continue;
    }

    const tipoSeccion = linea
      ? seccionDe(encabezado ? encabezado[2] : linea, Boolean(encabezado))
      : undefined;
    if (tipoSeccion) {
      bloques.push(actual);
      actual = { tipo: tipoSeccion, campos: {}, puntos: [] };
      ultimoCampo = null;
      continue;
    }

    // Dentro del copy manda el texto tal cual: los renglones en blanco separan
    // bloques y son parte de la fórmula, y un renglón que abre con emoji es
    // contenido, no una etiqueta.
    if (actual.tipo === 'copy') {
      const previo = actual.campos.cuerpo;
      actual.campos.cuerpo = previo === undefined ? crudo.trimEnd() : `${previo}\n${crudo.trimEnd()}`;
      continue;
    }

    if (!linea) {
      ultimoCampo = null;
      continue;
    }

    const punto = linea.match(/^[-•*·]\s+(.*)$/);
    if (punto) {
      actual.puntos.push(sinComillas(punto[1]));
      ultimoCampo = null;
      continue;
    }

    const etiquetas = etiquetasDe(linea);
    if (etiquetas.length) {
      for (const { campo, valor } of etiquetas) actual.campos[campo] = sinComillas(valor);
      ultimoCampo = etiquetas[etiquetas.length - 1].campo;
      continue;
    }

    // Un renglón suelto solo continúa el campo anterior si ese campo quedó a
    // medias. "Logo abajo al centro." después de un valor ya cerrado es una
    // nota para el diseñador, no la segunda mitad del valor.
    if (ultimoCampo && quedoAMedias(actual.campos[ultimoCampo])) {
      actual.campos[ultimoCampo] = sinComillas(`${actual.campos[ultimoCampo]} ${linea}`);
    } else {
      ultimoCampo = null;
    }
  }

  bloques.push(actual);
  return { bloques, titulo };
}

/**
 * Un encabezado de Markdown puede traer subtítulo: "Diapositiva 06 · Cierre".
 * Un renglón suelto, en cambio, solo cuenta como sección si es exactamente el
 * nombre de una. Si no, "Lista, con tu marcador de logo:" parte en dos el slide
 * 04, que fue justo lo que pasó la primera vez que se leyó el brief de verdad.
 */
function seccionDe(cabecera: string, esEncabezado: boolean): TipoBloque | undefined {
  const n = sinAcentos(cabecera.replace(/:$/, '').trim());
  const exacta = /^(portada|cierre|copy|lista|(?:slide|contenido|diapositiva)\s*\d*)$/;
  if (!esEncabezado && !exacta.test(n)) return undefined;

  if (/\bcierre\b/.test(n)) return 'cierre';
  if (/^copy\b/.test(n)) return 'copy';
  if (/^portada\b/.test(n)) return 'portada';
  if (/^lista\b/.test(n)) return 'lista';
  if (/^(diapositiva|slide|contenido)\b/.test(n)) return 'contenido';
  return undefined;
}

/**
 * Saca las etiquetas de un renglón. Puede haber varias:
 * "Pilar: Diagnóstico que salva. Objetivo: guardar. Nota: Regreso a clases."
 */
function etiquetasDe(linea: string): { campo: string; valor: string }[] {
  // Una sola etiqueta, quizá con un paréntesis: "Fuente (al pie): Mayo Clinic."
  const sola = linea.match(
    /^([A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]{2,32}?)(\s*\([^)]*\))?(\s*,[^:]{0,30})?\s*:\s*(.*)$/,
  );
  const campoSolo = sola ? ETIQUETAS[sinAcentos(sola[1].trim())] : undefined;

  if (campoSolo && !EN_LINEA.includes(sinAcentos(sola![1].trim()))) {
    return [{ campo: campoSolo, valor: sola![4] }];
  }

  // Varias en el mismo renglón, separadas por punto.
  const patron = new RegExp(`(?:^|[.;·]\\s+)(${EN_LINEA.join('|')})\\s*:\\s*`, 'gi');
  const cortes: { campo: string; desde: number; hasta: number }[] = [];
  for (const m of linea.matchAll(patron)) {
    const campo = ETIQUETAS[sinAcentos(m[1])];
    if (!campo) continue;
    if (cortes.length) cortes[cortes.length - 1].hasta = m.index!;
    cortes.push({ campo, desde: m.index! + m[0].length, hasta: linea.length });
  }
  if (cortes.length) {
    return cortes.map((c) => ({ campo: c.campo, valor: linea.slice(c.desde, c.hasta).replace(/\.\s*$/, '') }));
  }

  return campoSolo ? [{ campo: campoSolo, valor: sola![4] }] : [];
}

/* ── de bloque a slide ────────────────────────────────────────────────────── */

function aSlide(bloque: Bloque, avisos: string[]): Slide | null {
  const c = bloque.campos;
  const titulo = desescapar(c.titulo ?? '');

  // Un bloque con viñetas es una lista, se llame como se llame el encabezado.
  const tipo = bloque.tipo === 'contenido' && bloque.puntos.length >= 2 ? 'lista' : bloque.tipo;

  switch (tipo) {
    case 'portada':
      if (!titulo) avisos.push('La portada no trae título.');
      return { tipo: 'portada', titulo, pregunta: c.pregunta ?? '' };

    case 'cierre':
      return { tipo: 'cierre', ...(c.frase ? { frase: c.frase } : {}) };

    case 'lista':
      if (bloque.puntos.length < 2) {
        avisos.push('La lista trae menos de dos puntos; ponlos con un guion al principio.');
        return null;
      }
      if (bloque.puntos.length > 5) {
        avisos.push(`La lista trae ${bloque.puntos.length} puntos; caben cinco. Me quedé con los primeros.`);
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
        // Ni la idea de imagen ni el ícono sugerido se dibujan: son
        // instrucciones para el humano y para el buscador de íconos.
        visual: c.imagen
          ? { clase: 'foto', src: FOTO_PENDIENTE, ideaImagen: c.imagen }
          : c.icono
            ? { clase: 'icono', iconoSugerido: c.icono }
            : { clase: 'ninguno' },
        ...(c.fuente ? { fuente: c.fuente } : {}),
      };

    default:
      return null;
  }
}

/* ── utilidades ───────────────────────────────────────────────────────────── */

/** ¿El valor quedó cortado a media frase? */
function quedoAMedias(valor?: string) {
  if (!valor) return false;
  const abiertas = (valor.match(/[“"]/g) ?? []).length;
  if (abiertas % 2 === 1) return true; // comilla sin cerrar
  return !/[.!?:”"…]$/.test(valor.trim());
}

function sinComillas(s: string) {
  return s.trim().replace(/^[“"«]\s*/, '').replace(/\s*[”"»]$/, '').trim();
}

function ultimoRenglon(texto: string) {
  const renglones = texto.trim().split('\n').filter((l) => l.trim());
  return renglones[renglones.length - 1] ?? '';
}

function sacarHashtags(linea: string) {
  const encontrados = linea.match(/#[^\s#]+/g);
  return encontrados?.length ? encontrados : undefined;
}

/**
 * Los saltos de los títulos se escriben `\n` a mano: en el brief porque se
 * teclea, y en lo que devuelve el modelo porque así lo describe voz.md. En los
 * dos casos llegan como dos caracteres y hay que convertirlos, o el slide
 * acaba con un "\n" impreso en medio del título.
 */
export function desescapar(s: string) {
  return s.replace(/\\n/g, '\n');
}

