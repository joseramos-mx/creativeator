/**
 * lib/clinicas.ts — qué le falta a una foto de lesión para poder publicarse.
 *
 * La cola clínica va aparte de la contextual porque lo que hay que juzgar es
 * distinto. En una foto de aula lo único que se revisa es de dónde salió; en
 * una de piel, además, si esa imagen es de verdad lo que el texto dice que es,
 * y eso no lo puede firmar quien maneja la cuenta.
 *
 * Tres cosas, y ninguna la comprueba el sistema:
 *
 *  · **aprobación del médico**, con su nombre y la fecha;
 *  · **la huella del archivo**, para que sustituir la imagen tire la firma;
 *  · **la referencia del consentimiento**, cuando la foto es del consultorio.
 *
 * ── Lo que este archivo NO hace ─────────────────────────────────────────────
 * No mira la imagen. No sabe si esa piel es impétigo, ni si el paciente firmó,
 * ni si el documento que dice la referencia existe. Lo único que garantiza es
 * que ninguna foto de lesión llegue a `aprobado` sin que el médico la haya
 * mirado, y que cambiar el archivo lo devuelva a mirarla.
 */

/** El nombre reservado para lo que se fotografió en la consulta. */
export const FUENTE_CONSULTORIO = 'Consultorio';

export type FotoClinica = {
  donde: string;
  src: string;
  clinica: boolean;
  fuente?: string;
  consentimiento?: { referencia: string } | undefined;
  aprobacion?: { aprobadaPor: string; huella: string } | undefined;
};

export type PostConClinicas = {
  slides: ReadonlyArray<{
    tipo: string;
    visual?: {
      clase: string;
      src?: string;
      clinica?: boolean;
      credito?: { fuente?: string; consentimiento?: { referencia: string } };
      aprobacion?: { aprobadaPor: string; huella: string };
    };
  }>;
};

export type FaltaClinica = { donde: string; src: string; que: string };

/** Las fotos de lesión del carrusel, con lo que se sabe de cada una. */
export function clinicasDe(post: PostConClinicas): FotoClinica[] {
  const fotos: FotoClinica[] = [];

  post.slides.forEach((slide, i) => {
    const v = slide.visual;
    if (v?.clase !== 'foto' || !v.src || !v.clinica) return;
    fotos.push({
      donde: `slide ${String(i).padStart(2, '0')}`,
      src: v.src,
      clinica: true,
      fuente: v.credito?.fuente,
      consentimiento: v.credito?.consentimiento,
      aprobacion: v.aprobacion,
    });
  });

  return fotos;
}

/**
 * Lo que impide aprobar el carrusel, en texto.
 *
 * `huellas` es lo que se leyó del disco: ruta → huella real del archivo. Se
 * pasa desde fuera porque calcularla es leer archivos, y esta función tiene que
 * poder correr también en el navegador, donde el editor apaga la opción de
 * "aprobado" antes de que nadie choque contra el guardado.
 */
export function faltaClinico(
  post: PostConClinicas,
  huellas?: Record<string, string | null>,
): FaltaClinica[] {
  const faltan: FaltaClinica[] = [];

  for (const foto of clinicasDe(post)) {
    if (!foto.aprobacion) {
      faltan.push({ donde: foto.donde, src: foto.src, que: 'sin aprobar por el médico' });
    } else if (huellas && huellas[foto.src] !== undefined) {
      const real = huellas[foto.src];
      if (real === null) {
        faltan.push({ donde: foto.donde, src: foto.src, que: 'el archivo no está en disco' });
      } else if (real !== foto.aprobacion.huella) {
        // Lo que sostiene la firma: la imagen cambió después de aprobarse.
        faltan.push({
          donde: foto.donde,
          src: foto.src,
          que: `la imagen cambió después de que ${foto.aprobacion.aprobadaPor} la aprobara`,
        });
      }
    }

    // Del consultorio sale de un paciente concreto. Las de archivo vienen con
    // su consentimiento resuelto aguas arriba, en la institución que las cedió.
    if (foto.fuente === FUENTE_CONSULTORIO && !foto.consentimiento?.referencia) {
      faltan.push({
        donde: foto.donde,
        src: foto.src,
        que: 'foto del consultorio sin la referencia del consentimiento',
      });
    }
  }

  return faltan;
}

/**
 * De qué va el carrusel, en una palabra buscable.
 *
 * El tema de un post está escrito para una persona —"Impétigo en el regreso a
 * clases"— y como consulta a un archivo médico no sirve: Commons indexa en
 * inglés y por título de archivo, así que la frase entera devuelve una imagen
 * suelta y nada más. Se comprobó con la primera llamada real.
 *
 * Se corta en la primera preposición y se quitan los acentos, que es lo que
 * separa el diagnóstico del contexto: "impétigo en el regreso a clases" →
 * "impetigo", "dermatitis atópica en invierno" → "dermatitis atopica".
 *
 * No traduce. Los nombres de las enfermedades de la piel son latinos casi
 * siempre y viajan solos; cuando no, el campo es editable y para eso está.
 */
const CORTES = /\s+(en|de|del|para|con|y|durante|tras|por|a)\s+/i;

export function consultaDeArchivo(tema: string): string {
  const cortado = tema.split(CORTES)[0] ?? tema;
  return cortado
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
