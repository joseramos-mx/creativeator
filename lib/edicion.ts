import type { Credito, Overrides, Post, Slide } from '@/plantillas/clinica/tipos';

/**
 * lib/edicion.ts — las operaciones del editor, sin React.
 *
 * Todas devuelven un post nuevo en vez de mutar el que reciben: así el guardado
 * automático puede disparar con el post como dependencia y no hace falta pensar
 * en qué se copió y qué no.
 */

/**
 * La foto que todavía no está. No es un marcador de posición bonito: es lo que
 * hace que el editor pueda decir "falta la foto" en vez de enseñar un hueco.
 */
export const FOTO_PENDIENTE = '/media/pendiente.jpg';

export function cambiarSlide(post: Post, i: number, cambios: Partial<Slide>): Post {
  const slides = post.slides.map((s, j) => (j === i ? ({ ...s, ...cambios } as Slide) : s));
  return { ...post, slides };
}

export function moverSlide(post: Post, i: number, direccion: -1 | 1): Post {
  const j = i + direccion;
  if (j < 0 || j >= post.slides.length) return post;
  const slides = [...post.slides];
  [slides[i], slides[j]] = [slides[j], slides[i]];
  return { ...post, slides };
}

export function duplicarSlide(post: Post, i: number): Post {
  const slides = [...post.slides];
  slides.splice(i + 1, 0, structuredClone(slides[i]));
  return { ...post, slides };
}

export function borrarSlide(post: Post, i: number): Post {
  if (post.slides.length <= 2) return post; // el esquema pide al menos dos
  return { ...post, slides: post.slides.filter((_, j) => j !== i) };
}

export function nuevoSlide(post: Post, i: number): Post {
  const slides = [...post.slides];
  slides.splice(i + 1, 0, {
    tipo: 'contenido',
    titulo: '**Nuevo** slide.',
    cuerpo: '',
    visual: { clase: 'ninguno' },
  });
  return { ...post, slides };
}

/**
 * Empuja un override. Si el valor vuelve a su origen, el campo desaparece en
 * vez de quedarse escrito: un override que vale lo mismo que el token es ruido
 * en el JSON y hace mentir al contador.
 */
export function empujarOverride(
  post: Post,
  i: number,
  campo: keyof Overrides,
  delta: number,
  opciones: { base: number; min?: number; max?: number },
): Post {
  const slide = post.slides[i];
  if (slide.tipo === 'cierre') return post;

  const actuales: Overrides = slide.overrides ?? {};
  // Si el slide todavía no tiene override, se parte del valor del token: el
  // primer empujón mueve un píxel desde donde está, no desde cero.
  let valor = (actuales[campo] ?? opciones.base) + delta;
  if (opciones.min !== undefined) valor = Math.max(opciones.min, valor);
  if (opciones.max !== undefined) valor = Math.min(opciones.max, valor);

  const siguientes: Overrides = { ...actuales };
  // Un override que vale lo mismo que el token es ruido en el JSON y hace
  // mentir al contador, así que se borra en vez de escribirse.
  if (valor === opciones.base) delete siguientes[campo];
  else siguientes[campo] = valor;

  return cambiarSlide(post, i, {
    overrides: Object.keys(siguientes).length ? siguientes : undefined,
  } as Partial<Slide>);
}

/** El tamaño del ícono es contenido del slide, no una excepción de maquetación. */
export function cambiarTamIcono(post: Post, i: number, delta: number): Post {
  const slide = post.slides[i];
  if (slide.tipo !== 'contenido' || slide.visual.clase !== 'icono') return post;
  const tam = Math.max(60, Math.min(700, (slide.visual.tam ?? 260) + delta));
  return cambiarSlide(post, i, { visual: { ...slide.visual, tam } } as Partial<Slide>);
}

export function limpiarOverrides(post: Post, i: number): Post {
  return cambiarSlide(post, i, { overrides: undefined } as Partial<Slide>);
}

export function contarOverrides(slide: Slide): number {
  if (slide.tipo === 'cierre' || !slide.overrides) return 0;
  return Object.values(slide.overrides).filter((v) => v !== undefined).length;
}

/**
 * A partir de cuántos ajustes a mano conviene mirar la plantilla en vez de
 * seguir empujando este slide. Tres es donde deja de ser una excepción.
 */
export const OVERRIDES_DEMASIADOS = 3;

/** Los slides que aceptan una imagen soltada encima. */
export function aceptaImagen(slide: Slide): boolean {
  return slide.tipo === 'portada' || slide.tipo === 'contenido';
}

/**
 * El crédito de una imagen que subió quien edita: una foto del consultorio, una
 * de un libro o estudio que la cuenta puede usar, una que mandaron por
 * WhatsApp. Lo que se sabe es que la puso la cuenta, y eso dice. Basta para
 * que el carrusel pueda pasar a aprobado; si se quiere precisar, se edita.
 */
export const CREDITO_PROPIO: Credito = {
  fuente: 'Proporcionada por la cuenta',
  licencia: 'Uso autorizado por la cuenta',
};

/**
 * Dónde va la imagen que se subió, según el tipo de slide.
 *
 * Dos campos se comportan al revés al cambiar la foto, y el motivo es el mismo
 * en los dos casos:
 *
 *  · `ideaImagen` **se conserva**. Dice qué debería mostrar el slide, y soltar
 *    una foto es justamente el gesto de intentar cumplirlo. Borrarla ahí es
 *    perder el criterio en el momento exacto en que sirve para comprobarlo.
 *  · `credito` **se cambia**. El de la foto anterior describe otra foto. La
 *    nueva la subió quien edita, así que lleva `CREDITO_PROPIO`, que dice eso
 *    y nada más; si se sabe más —el libro, el estudio, quién la tomó— se
 *    escribe en la tarjeta del slide.
 */
export function ponerImagen(post: Post, i: number, ruta: string): Post {
  const slide = post.slides[i];

  if (slide.tipo === 'portada') {
    return cambiarSlide(post, i, { foto: ruta, fotoCredito: CREDITO_PROPIO } as Partial<Slide>);
  }

  if (slide.tipo === 'contenido') {
    const antes = slide.visual.clase === 'foto' ? slide.visual : undefined;
    return cambiarSlide(post, i, {
      visual: {
        clase: 'foto',
        src: ruta,
        credito: CREDITO_PROPIO,
        ...(antes?.alto ? { alto: antes.alto } : {}),
        ...(antes?.ideaImagen ? { ideaImagen: antes.ideaImagen } : {}),
      },
    } as Partial<Slide>);
  }

  return post;
}

/**
 * La foto que vino de un banco, con su procedencia, en un solo movimiento.
 *
 * Es la diferencia con `ponerImagen`, que borra el crédito a propósito porque
 * describía a la foto anterior. Aquí el crédito llega con la foto y de la misma
 * petición, así que no hay ventana en la que el archivo esté puesto y la
 * procedencia sin escribir. Eso es lo que esta fase vino a resolver: el campo
 * existía desde antes y estaba vacío en todo el proyecto por llenarse a mano.
 */
export function ponerFotoDeBanco(
  post: Post,
  i: number,
  ruta: string,
  credito: Credito,
): Post {
  const slide = post.slides[i];
  if (slide.tipo !== 'contenido') return post;

  const antes = slide.visual.clase === 'foto' ? slide.visual : undefined;
  return cambiarSlide(post, i, {
    visual: {
      clase: 'foto',
      src: ruta,
      credito,
      ...(antes?.alto ? { alto: antes.alto } : {}),
      ...(antes?.ideaImagen ? { ideaImagen: antes.ideaImagen } : {}),
    },
  } as Partial<Slide>);
}

/** Un resumen del slide para la cabecera de su tarjeta. */
export function tituloDeTarjeta(slide: Slide): string {
  switch (slide.tipo) {
    case 'cierre':
      return 'se arma con los datos de la marca';
    case 'portada':
    case 'contenido':
    case 'lista':
      return slide.titulo.replace(/\*\*?/g, '').replace(/\n/g, ' ').trim() || '(sin título)';
  }
}
