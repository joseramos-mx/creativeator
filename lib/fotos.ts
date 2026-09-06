/**
 * lib/fotos.ts — qué fotos no se puede decir de dónde salieron.
 *
 * El problema que resuelve es de los que aparecen tarde: una foto clínica
 * publicada sin saber su procedencia no da guerra el día que se publica, sino
 * meses después, cuando ya está en el feed y nadie recuerda si era de banco,
 * del consultorio o de una búsqueda de imágenes.
 *
 * ── Lo que este archivo NO hace ─────────────────────────────────────────────
 * No comprueba la licencia. No abre Unsplash, no valida que ese enlace lleve a
 * esa foto, no verifica que quien la subió tuviera derecho a subirla. Lo único
 * que garantiza es que ninguna foto llegue al estado `aprobado` sin que alguien
 * haya escrito de dónde salió y bajo qué términos.
 *
 * Y por eso **"desconocida" no es una respuesta que pase la barrera**. Si no se
 * sabe la procedencia, el crédito se queda vacío y el carrusel se queda en
 * borrador. Rellenar el campo con "desconocida" satisfaría la validación sin
 * registrar nada, que es exactamente el problema que la barrera existe para
 * impedir: un campo que parece registrado y no lo está.
 */

/** Lo mínimo que hace falta de un post para mirarle las fotos. */
export type PostConFotos = {
  slides: ReadonlyArray<{
    tipo: string;
    /** La portada lleva la foto suelta: es fondo a sangre, no un bloque. */
    foto?: string;
    fotoCredito?: unknown;
    visual?: { clase: string; src?: string; credito?: unknown };
  }>;
};

export type FotoSinCredito = { donde: string; src: string };

/** Las fotos del carrusel a las que nadie les puso fuente ni licencia. */
export function fotosSinCredito(post: PostConFotos): FotoSinCredito[] {
  const faltan: FotoSinCredito[] = [];

  post.slides.forEach((slide, i) => {
    const etiqueta = `slide ${String(i).padStart(2, '0')}`;

    if (slide.tipo === 'portada' && slide.foto && !slide.fotoCredito) {
      faltan.push({ donde: `${etiqueta} · portada`, src: slide.foto });
      return;
    }

    if (slide.visual?.clase === 'foto' && slide.visual.src && !slide.visual.credito) {
      faltan.push({ donde: etiqueta, src: slide.visual.src });
    }
  });

  return faltan;
}
