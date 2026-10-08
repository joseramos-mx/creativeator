import 'server-only';

import { join } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { NOMBRES_PALETA } from '@/plantillas/clinica/tokens';
import { paletaDelPost, paletaPorDefectoDe, paletasDe } from '@/plantillas/paletas';
import { MODELO_REDACCION } from './modelo';
import { repartir } from './variedad';
import { CAJA_CONTENIDO, CAJA_PORTADA, bancoDe, cribar, porEncuadre } from './bancos';
import { descargarFoto } from './bancos/descargar';
import { SEPARACION_MINIMA, mejorCoincidencia, separacion, type Icono } from './iconos';
import { MODELO as MODELO_ICONOS, generar as generarIcono } from './iconos/gemini';
import { guardarIcono } from './iconos/guardar';
import { desescapar } from './brief';
import { FOTO_PENDIENTE } from './edicion';
import { almacen } from './almacen';
import { instruccionesDeRedaccion } from './instrucciones';
import { leerIdentidad } from './identidad';
import { asegurarEscrito, leerPieza, leerVoz } from './piezas';
import { leerProyecto, listarPosts } from './posts';
import type { TPost, TSlide } from './schema';

/**
 * lib/redactar.ts — el borrador que escribe el modelo.
 *
 * El modelo escribe **texto**, no diseño: devuelve los campos que la plantilla
 * espera y nada más. Todo lo que sea posición, tamaño o color se decide en
 * plantillas/clinica/tokens.ts. Lo único parecido a diseño que sí elige es la paleta, y
 * la elige por el tema, con las mismas reglas que están escritas en el token.
 *
 * Lo que sale de aquí es siempre un **borrador**: entre generar y publicar
 * hay una persona, que lo revisa en el editor y se lo manda a la cuenta.
 */


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
  /**
   * La consulta al banco de fotos, en inglés, y lo que descalifica una foto
   * aunque encaje con ella.
   *
   * Van aquí y no en una segunda llamada porque el modelo que escribió el slide
   * ya sabe qué debería enseñar la foto: pedírselo aparte sería volver a
   * explicarle el slide que acaba de escribir, y costaría una llamada por cada
   * foto del carrusel.
   */
  busqueda: z.string(),
  descartar: z.array(z.string()),
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
  slides: z.array(SlideRedactado).min(4).max(8),
  copy: z.string(),
  hashtags: z.array(z.string()),
});

export type TRedaccion = z.infer<typeof Redaccion>;

export type ResultadoRedaccion = {
  post: TPost;
  porQuePaleta: string;
  avisos: string[];
  /** Lo que costó la llamada. Sirve para sumar una tanda entera. */
  uso: { entrada: number; salida: number };
};

export type OpcionesRedaccion = {
  /**
   * Las fotos que no se pueden volver a usar, como `"proveedor:id"`.
   *
   * Existe para la tanda del mes. Cada carrusel por su cuenta elige el mejor
   * candidato del banco, y eso está bien; pero ocho carruseles seguidos sobre
   * temas vecinos —el regreso a clases, el uniforme, el recreo— le piden al
   * banco escenas parecidas y la mejor foto de aula suele ser la misma. En el
   * perfil eso se ve de inmediato: la cuadrícula repite imagen.
   *
   * **Se muta al elegir**, así que quien la pasa la ve crecer. Y sirve también
   * dentro de un mismo carrusel, donde dos slides podían caer en la misma foto.
   */
  usadas?: Set<string>;
  /**
   * La fila del calendario, cuando la hay.
   *
   * Sin esto el modelo **inventa** el pilar, el objetivo y la nota en cada
   * carrusel, y salen tres pilares distintos para lo que en la hoja es uno
   * solo. Cuando vienen dados se le dicen —para que escriba hacia ese objetivo,
   * que es lo que decide el cierre del copy— y además se le imponen encima de
   * lo que devuelva: lo que está en la hoja lo decidió una persona.
   */
  editorial?: {
    pilar?: string;
    objetivo?: 'guardar' | 'compartir' | 'comentar' | 'agendar';
    nota?: string;
    /** La fecha de publicación de la hoja. Va a `creado`. */
    fecha?: string;
  };
};

export async function redactar(
  proyecto: string,
  tema: string,
  slug: string,
  opciones: OpcionesRedaccion = {},
): Promise<ResultadoRedaccion> {
  const inicio = Date.now();
  // La identidad va detrás de la voz, en el mismo system prompt: la voz dice
  // cómo escribir, la identidad quién es la cuenta. Sin identidad.md el prompt
  // queda como estaba.
  const identidad = await leerIdentidad(proyecto);
  const voz = identidad
    ? `${await leerVoz(proyecto)}\n\n# La identidad de la cuenta\n\n${identidad}\n`
    : await leerVoz(proyecto);
  // La cuenta no está en voz.md, y el copy la necesita: el bloque 📲 nombra la
  // plataforma y el último hashtag lleva la ciudad.
  const marca = await leerProyecto(proyecto);
  asegurarEscrito(proyecto, marca);
  const [estructura, iconos, fotos] = await Promise.all([
    leerPieza(proyecto, 'estructura'),
    leerPieza(proyecto, 'iconos'),
    leerPieza(proyecto, 'fotos'),
  ]);
  const prompt = instruccionesDeRedaccion(
    tema,
    {
      marca,
      piezas: { estructura, iconos, fotos },
      paletas: Object.fromEntries(paletasDe(marca).map((p) => [p.clave, { cuando: p.cuando }])),
      paletaPorDefecto: paletaPorDefectoDe(marca),
    },
    opciones.editorial,
  );
  const cliente = new Anthropic();

  let respuesta;
  try {
    // En streaming aunque no se enseñe el avance: un carrusel entero con
    // pensamiento adaptativo tarda lo bastante como para que una petición sin
    // stream se acerque al tiempo límite. `finalMessage()` trae igual el
    // `parsed_output`, así que aquí abajo no cambia nada.
    respuesta = await cliente.messages
      .stream({
        model: MODELO_REDACCION,
        max_tokens: 16000,
        thinking: { type: 'adaptive' },
        system: voz,
        messages: [{ role: 'user', content: prompt }],
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

  /*
   * El reparto de color, solo donde no había razón.
   *
   * Si el modelo eligió turquesa porque el carrusel va de albercas, se queda
   * turquesa. Lo que cambia es el caso en que contestó `azul` porque el tema no
   * tiene color —que es la mayoría de los temas de esta cuenta—: ahí, en vez de
   * azul siempre, se mira qué se ha usado últimamente. Ver lib/variedad.ts.
   */
  let porQuePaleta = redaccion.porQuePaleta;
  // Una cuenta con diseño propio tiene menos colores que nombres conoce el
  // esquema: si el modelo contestó uno que la cuenta no tiene, va el suyo.
  const propias = paletasDe(marca);
  if (!propias.some((p) => p.clave === redaccion.paleta)) redaccion.paleta = paletaPorDefectoDe(marca);
  const reparto = repartir(
    redaccion.paleta,
    paletaPorDefectoDe(marca),
    await paletasRecientes(proyecto),
    propias.filter((p) => p.variedad).map((p) => p.clave),
  );
  if (reparto.paleta !== redaccion.paleta) {
    redaccion.paleta = reparto.paleta as typeof redaccion.paleta;
    porQuePaleta = `${reparto.porque}. Cámbiala en el editor si no encaja.`;
  }

  const post = aPost(redaccion, slug, await leerManifiesto());

  /*
   * Lo de la hoja gana, siempre.
   *
   * Al modelo ya se le dijo en el prompt y suele devolverlo igual, pero "suele"
   * no sirve aquí: si un día decide que el pilar es otro, el post entra en la
   * cuadrícula del mes con un eje que no es el que se planeó, y eso no lo caza
   * nadie leyendo el carrusel — solo se ve al mirar el mes entero. La
   * instrucción orienta, la asignación decide.
   */
  const ed = opciones.editorial;
  if (ed?.pilar) post.pilar = ed.pilar;
  if (ed?.objetivo) post.objetivo = ed.objetivo;
  if (ed?.nota) post.nota = ed.nota;
  // La fecha de la hoja es cuándo se publica; sin hoja, `creado` es hoy.
  if (ed?.fecha) post.creado = ed.fecha;

  const avisos = revisar(redaccion, post);
  if (ed?.pilar && redaccion.pilar && redaccion.pilar !== ed.pilar) {
    avisos.push(`El modelo propuso el pilar "${redaccion.pilar}"; se dejó el del calendario.`);
  }
  if (ed?.objetivo && redaccion.objetivo && redaccion.objetivo !== ed.objetivo) {
    avisos.push(
      `El modelo escribió para "${redaccion.objetivo}" y el calendario pide ` +
        `"${ed.objetivo}". El campo se corrigió, pero **revisa el cierre del copy**.`,
    );
  }
  // Las dos en paralelo: son redes distintas y ninguna depende de la otra.
  await Promise.all([
    rellenarFotos(proyecto, post, redaccion, slug, avisos, opciones.usadas ?? new Set()),
    rellenarIconos(post, avisos, marca, inicio + PLAZO_DE_ICONOS),
  ]);
  return {
    post,
    porQuePaleta,
    avisos,
    uso: {
      entrada: respuesta.usage?.input_tokens ?? 0,
      salida: respuesta.usage?.output_tokens ?? 0,
    },
  };
}

/**
 * Los íconos que la librería no tiene, generados.
 *
 * La librería local resuelve la mayoría de los slides **cuando la librería es
 * grande**. Con doce íconos no resuelve casi nada: de tres carruseles seguidos,
 * los conceptos que pidió el redactor —"water drop", "wind", "stethoscope"— no
 * estaba ninguno, y los slides salían sin ícono.
 *
 * Así que aquí se genera lo que falte. No es un complemento de la colección de
 * pago: es lo que la sustituye mientras no esté. Cada ícono generado se guarda
 * en la librería por la misma puerta que los descargados, así que el segundo
 * carrusel que pida "stethoscope" ya lo encuentra y no vuelve a generar nada:
 * la librería se llena sola con lo que la cuenta usa de verdad.
 *
 * Una variante y no tres. El flujo de tres es para cuando alguien elige; aquí
 * no elige nadie, así que pedir tres sería pagar por dos que se tiran.
 *
 * Y como con las fotos, ningún fallo interrumpe la redacción: el slide se queda
 * sin ícono, el editor lo marca, y se resuelve con un clic.
 */
/**
 * Hasta cuándo, desde que empezó la redacción, se generan íconos. La petición
 * entera tiene 300 s en Vercel y la redacción se lleva la mitad: si se pasa,
 * se pierde el carrusel completo, no solo un ícono. Lo que no alcance queda
 * para «Generar los íconos que faltan» en el editor.
 */
const PLAZO_DE_ICONOS = 240_000;
/** Lo que tarda un ícono, más o menos: no se empieza uno que no va a terminar. */
const UN_ICONO = 30_000;

async function rellenarIconos(
  post: TPost,
  avisos: string[],
  marca: Parameters<typeof paletaDelPost>[0],
  hasta: number,
): Promise<void> {
  if (!process.env.GEMINI_API_KEY) return;

  // En serie: cada ícono nuevo entra en el manifiesto, y el siguiente slide
  // podría estar pidiendo el mismo concepto. En paralelo se generaría dos veces
  // y una de las dos se sobrescribiría.
  for (const [i, slide] of post.slides.entries()) {
    if (slide.tipo !== 'contenido' || slide.visual.clase !== 'icono') continue;
    if (slide.visual.slug || !slide.visual.iconoSugerido) continue;

    const concepto = slide.visual.iconoSugerido;
    try {
      // Se vuelve a mirar la librería: puede haberlo puesto el slide anterior.
      const yaEsta = mejorCoincidencia(await leerManifiesto(), concepto);
      if (yaEsta) {
        slide.visual.slug = yaEsta.slug;
        continue;
      }

      if (Date.now() + UN_ICONO > hasta) {
        avisos.push(`Sin tiempo para generar el ícono "${concepto}": genéralo desde el editor.`);
        continue;
      }
      const [variante] = await generarIcono(concepto, 1, undefined, hasta - UN_ICONO);
      if (!variante) throw new Error('el modelo no devolvió imagen');
      if (variante.aviso) avisos.push(`Ícono "${concepto}": ${variante.aviso}`);

      const { slug: puesto, entrada } = await guardarIcono(
        variante.png,
        concepto,
        concepto,
        MODELO_ICONOS,
      );
      slide.visual.slug = puesto;

      // Lo que nadie miraba al ponerlo solo: un ícono generado puede salir del
      // color del fondo y desaparecer. Pasó con "fork with clock", que salió
      // azul grisáceo y sobre la paleta azul se separaba 25. El editor ya lo
      // marca cuando alguien abre el buscador, pero el relleno automático no
      // abre nada, así que aquí se dice.
      const fondo = paletaDelPost(marca, post.paleta).color;
      const delta = separacion({ color: entrada.color as string | null }, fondo);
      if (delta !== null && delta < SEPARACION_MINIMA) {
        avisos.push(
          `El ícono "${puesto}" se funde con la paleta ${post.paleta} (ΔE ${Math.round(delta)}). ` +
            'Cámbialo en el editor o regenéralo.',
        );
      }
    } catch (e) {
      avisos.push(
        `Sin ícono para el slide ${String(i).padStart(2, '0')} ("${concepto}"): ` +
          `${e instanceof Error ? e.message : 'no se pudo generar'}.`,
      );
    }
  }
}

/**
 * Pone las fotos de ambiente, sin preguntar.
 *
 * El carrusel sale con las imágenes puestas y no con el hueco. Elegir entre
 * veinticuatro fotos de aula es preferencia, no criterio, y cambiar una después
 * en el editor cuesta un clic; lo que no es preferencia —de dónde salió y bajo
 * qué licencia— se escribe igual, en el mismo movimiento.
 *
 * Cada slide va por su cuenta y **ningún fallo interrumpe la redacción**. Si el
 * banco no devuelve nada usable, ese slide se queda con la foto pendiente y la
 * banda del lienzo lo dice: es preferible un hueco señalado que un carrusel a
 * medio redactar, porque el texto es lo caro y la foto se pone en un clic.
 *
 * Solo el banco de ambiente. Lo clínico no se pone solo: se busca en el
 * archivo clínico desde el editor, o se sube la imagen que mande la cuenta.
 */
async function rellenarFotos(
  proyecto: string,
  post: TPost,
  r: TRedaccion,
  slug: string,
  avisos: string[],
  usadas: Set<string>,
): Promise<void> {
  const banco = bancoDe(slug);
  if (!banco.disponible()) {
    avisos.push(`El banco de fotos no está configurado, así que van sin imagen.`);
    return;
  }

  await Promise.all(
    post.slides.map(async (slide, i) => {
      // La portada lleva la foto suelta y a sangre; los de contenido, dentro
      // del visual. Son dos campos distintos y las dos hacen falta: sin la de
      // portada el carrusel abre con un fondo plano.
      const esPortada = slide.tipo === 'portada';
      const esContenido = slide.tipo === 'contenido' && slide.visual.clase === 'foto';
      if (!esPortada && !esContenido) return;

      const pedido = r.slides[i];
      const consulta = pedido?.busqueda?.trim() || pedido?.ideaImagen?.trim();
      const donde = esPortada ? 'la portada' : `el slide ${String(i).padStart(2, '0')}`;
      if (!consulta) {
        if (esPortada) avisos.push('La portada va sin foto: el modelo no propuso qué buscar.');
        return;
      }

      // La caja donde va a caer decide dos cosas: qué orientación se le pide al
      // banco y cuánto recorte se tolera. Ver lib/bancos/encuadre.ts.
      const caja = esPortada ? CAJA_PORTADA : CAJA_CONTENIDO;
      const orientacion = caja.ancho >= caja.alto ? 'landscape' : 'portrait';

      try {
        const candidatos = await banco.buscar(consulta, 24, orientacion);
        const { pasan, apartados } = cribar(candidatos, pedido?.descartar ?? []);
        const { encajan, recortadas } = porEncuadre(pasan, caja);

        // Las que ya están puestas en otro slide o en otro carrusel de la misma
        // tanda quedan fuera. Ver `OpcionesRedaccion.usadas`.
        const libres = encajan.filter((c) => !usadas.has(`${c.proveedor}:${c.id}`));
        const repetidas = encajan.length - libres.length;

        const mejor = libres[0];
        if (!mejor?.credito) {
          avisos.push(
            `Sin foto para ${donde}: el banco no devolvió nada usable ` +
              `para "${consulta}"` +
              `${apartados.length ? `, ${apartados.length} apartada(s) por el descarte` : ''}` +
              `${recortadas.length ? `, ${recortadas.length} descartada(s) porque el recorte se las comía` : ''}` +
              `${repetidas ? `, ${repetidas} ya usada(s) en esta tanda` : ''}.`,
          );
          return;
        }

        // Se aparta **antes** de bajarla, no después. Los slides van en
        // paralelo, y entre elegir y terminar la descarga hay tiempo de sobra
        // para que otro slide elija la misma. Apuntarla aquí es atómico.
        usadas.add(`${mejor.proveedor}:${mejor.id}`);

        const ruta = await descargarFoto(proyecto, banco, mejor, slug);
        if (slide.tipo === 'portada') {
          slide.foto = ruta;
          slide.fotoCredito = mejor.credito;
        } else if (slide.tipo === 'contenido' && slide.visual.clase === 'foto') {
          slide.visual.src = ruta;
          slide.visual.credito = mejor.credito;
        }
      } catch (e) {
        // Una foto que no se pudo bajar no tira el carrusel entero.
        avisos.push(
          `Sin foto para ${donde}: ${e instanceof Error ? e.message : 'no se pudo bajar'}.`,
        );
      }
    }),
  );
}

/**
 * Las paletas ya usadas, de la más nueva a la más vieja.
 *
 * Los de laboratorio quedan fuera: `laboratorio-paletas` existe justo para
 * enseñar las veinticinco a la vez, así que contarlo diría que todo se acaba de
 * usar y el reparto se quedaría sin candidatas frescas.
 */
async function paletasRecientes(proyecto: string): Promise<string[]> {
  const posts = await listarPosts(proyecto).catch(() => []);
  return posts.filter((p) => !p.slug.startsWith('laboratorio-')).map((p) => p.paleta);
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

/* ── de la redacción al post ──────────────────────────────────────────────── */

/** La librería de íconos, para casar `iconoSugerido` sin abrir el buscador. */
async function leerManifiesto(): Promise<Icono[]> {
  const crudo = await almacen.leerTexto(join(process.cwd(), 'public', 'iconos', 'manifest.json'));
  return crudo ? JSON.parse(crudo) : [];
}

function aPost(r: TRedaccion, slug: string, manifiesto: Icono[]): TPost {
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
            ? {
                clase: 'icono',
                ...(s.iconoSugerido ? { iconoSugerido: s.iconoSugerido } : {}),
                // El concepto sugerido se casa aquí contra el manifiesto: si la
                // librería ya lo tiene, el ícono queda puesto y no hay que abrir
                // el buscador para confirmar lo obvio. Con puntaje dudoso se
                // deja vacío y el editor marca "falta ícono", que es mejor que
                // poner uno equivocado y que nadie lo note.
                ...(s.iconoSugerido
                  ? (() => {
                      const encontrado = mejorCoincidencia(manifiesto, s.iconoSugerido);
                      return encontrado ? { slug: encontrado.slug } : {};
                    })()
                  : {}),
              }
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
    paleta: r.paleta,
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
  // El cierre no se redacta: la cuenta usa siempre el mismo, ya hecho, y se
  // añade después. Si el modelo escribe uno, se avisa para poder quitarlo.
  if (post.slides.some((s) => s.tipo === 'cierre')) {
    avisos.push('Escribió un slide de cierre; ese no se genera, quítalo.');
  }

  return avisos;
}
