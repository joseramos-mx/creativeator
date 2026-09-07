import 'server-only';

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { NOMBRES_PALETA, PALETA_POR_DEFECTO, paletas } from '@/template/tokens';
import { afirmacionesDe } from './afirmaciones';
import { CAJA_CONTENIDO, CAJA_PORTADA, bancoDe, cribar, porEncuadre } from './bancos';
import { descargarFoto } from './bancos/descargar';
import { SEPARACION_MINIMA, mejorCoincidencia, separacion, type Icono } from './iconos';
import { MODELO as MODELO_ICONOS, generar as generarIcono } from './iconos/gemini';
import { guardarIcono } from './iconos/guardar';
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

  const post = aPost(redaccion, slug, await leerManifiesto());
  const avisos = revisar(redaccion, post);
  // Las dos en paralelo: son redes distintas y ninguna depende de la otra.
  await Promise.all([
    rellenarFotos(post, redaccion, slug, avisos),
    rellenarIconos(post, avisos),
  ]);
  return { post, porQuePaleta: redaccion.porQuePaleta, avisos };
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
async function rellenarIconos(post: TPost, avisos: string[]): Promise<void> {
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

      const [variante] = await generarIcono(concepto, 1);
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
      const fondo = paletas[post.paleta].fondo;
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
 * Solo el banco de ambiente. Lo clínico no pasa por aquí ni puede: va por la
 * cola que firma el médico.
 */
async function rellenarFotos(
  post: TPost,
  r: TRedaccion,
  slug: string,
  avisos: string[],
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
        const mejor = encajan[0];
        if (!mejor?.credito) {
          avisos.push(
            `Sin foto para ${donde}: el banco no devolvió nada usable ` +
              `para "${consulta}"` +
              `${apartados.length ? `, ${apartados.length} apartada(s) por el descarte` : ''}` +
              `${recortadas.length ? `, ${recortadas.length} descartada(s) porque el recorte se las comía` : ''}.`,
          );
          return;
        }

        const ruta = await descargarFoto(banco, mejor, slug);
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

Seis slides, en este orden, que es el de la cuenta:

  1. portada    — titulo con marcado, pregunta de cinco palabras o menos, y
                  su búsqueda de foto: la portada siempre lleva fondo
  2. contenido  — qué es
  3. contenido  — cómo se reconoce
  4. contenido  — por qué importa ahora, o cómo se contagia
  5. lista      — cuatro puntos accionables
  6. contenido  — cuándo acudir a consulta

**No escribas slide de cierre.** La cuenta usa siempre el mismo, ya hecho, y
se añade después. Si escribieras uno, habría que borrarlo cada vez.

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
  · iconoSugerido — el concepto en inglés, corto y **del tema**.

    Esto es lo que más se descuida. El ícono tiene que nombrar la cosa de la
    que habla el slide, no el hecho de que sea un carrusel médico. En un
    carrusel de alergia alimentaria van cacahuates, un camarón, un vaso de
    leche, una etiqueta de ingredientes; en uno de dermatitis del pañal, un
    pañal o un bote de crema; en uno de polen, una flor o una rama.

    **No propongas "warning triangle", "magnifying glass" ni "stethoscope"**
    salvo que el slide trate literalmente de eso. Son los tres a los que se
    cae por defecto cualquier tema de salud, y un carrusel donde todos los
    íconos son la lupa y el triángulo de alerta no dice nada de su tema.

    Y no te limites a lo que creas que existe: si el concepto no está en la
    librería se fabrica, así que pide lo que de verdad ilustra el slide.

Nunca pidas una foto que muestre una lesión inventada o generada: las fotos
clínicas vienen de banco con licencia o del consultorio.

## La búsqueda de la foto

**La portada siempre lleva foto**, a sangre y de fondo, y los slides con
"foto" llevan la suya. En los dos casos la foto se busca y se pone sola con lo
que escribas en estos dos campos. Nadie los va a revisar antes, así que valen
lo que valgan:

  · busqueda — en inglés, de tres a seis palabras, del vocabulario con el que
    indexan los bancos de fotos de ambiente. "children classroom backpacks
    school", no "impetigo contagion at school".

  · descartar — de dos a seis términos, en inglés, **de una sola palabra
    siempre que sirva**, que aparecerían en la descripción de una foto que
    encaja con la consulta y aun así está mal para este slide. El descarte
    busca la secuencia entera, así que "gym equipment" no aparta una foto
    descrita como "a gym full of adults", y "gym" sí.

Este segundo campo es el que importa. Un slide sobre cómo se contagia una
infección en la escuela se publicó una vez con la foto de un gimnasio: encajaba
con "niños juntos" y no enseñaba nada de lo que decía el texto. Piensa qué
buscaría alguien con tu consulta y saldría mal.

**La de la portada es distinta.** Va a sangre, con un velo encima que la
oscurece arriba y termina fundida en el color plano abajo, y el título grande
cae a media altura.

Un primer plano de una persona funciona y es lo que la cuenta publica: su
portada de impétigo es una cara ocupando el encuadre entero. Lo que importa no
es evitar caras, es **que lo que se quiere ver quede en los dos tercios de
arriba**, porque el tercio inferior se lo come el fundido. Y que la escena
tenga aire: una foto llena de detalle fino compite con el título.

Busca la escena donde ocurre el tema —la recámara de noche, el patio de la
escuela, el parque en otoño—, no el síntoma.

**Solo ambiente, nunca clínica.** Un aula, mochilas, el recreo, una toalla
colgada, una rutina de casa. Nada de piel enferma: esas fotos salen de un
archivo con licencia y las aprueba el médico una por una. Si un slide de
contenido pide una lesión, pon "ninguno" en visual y no lo fuerces.

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

/** La librería de íconos, para casar `iconoSugerido` sin abrir el buscador. */
async function leerManifiesto(): Promise<Icono[]> {
  return readFile(join(process.cwd(), 'public', 'iconos', 'manifest.json'), 'utf8')
    .then(JSON.parse)
    .catch(() => []);
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
  // El cierre no se redacta: la cuenta usa siempre el mismo, ya hecho, y se
  // añade después. Si el modelo escribe uno, se avisa para poder quitarlo.
  if (post.slides.some((s) => s.tipo === 'cierre')) {
    avisos.push('Escribió un slide de cierre; ese no se genera, quítalo.');
  }

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
