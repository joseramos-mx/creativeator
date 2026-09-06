/**
 * template/tokens.ts
 *
 * Único lugar donde viven los valores de diseño. Si vas a cambiar cómo se ve
 * algo, empieza aquí. Los componentes no deben tener números escritos a mano.
 *
 * Todo está en píxeles sobre un lienzo de 1080 × 1350.
 *
 * ── De dónde salen estos números ────────────────────────────────────────────
 * No están estimados a ojo: se midieron sobre las siete capturas de
 * `referencia/` (el carrusel de impétigo ya publicado), que son artboards de
 * 4501 × 5626 px, es decir el mismo 4:5 a escala 4.167×.
 *
 *   · Los colores son el modo del histograma de cada zona de texto.
 *   · Los tamaños de letra y el tracking se resolvieron comparando la caja de
 *     tinta de cada línea real contra la misma cadena compuesta en Albert Sans:
 *     la altura da el tamaño, y el ancho sobrante repartido entre los huecos da
 *     el tracking. Cuatro líneas de cuerpo independientes coinciden en 34 px y
 *     −0.012em, que es lo que confirma que la familia es Albert Sans.
 *
 * Donde la referencia se contradice a sí misma (el diseño está hecho a mano en
 * Illustrator y no todos los slides usan el mismo crema), el comentario lo dice.
 */

export const lienzo = {
  ancho: 1080,
  alto: 1350,
  escalaExport: 2, // 2160 × 2700
  /** Cabecera, número, pie y fuente citada. Medido: 40.6–40.8 px. */
  margenBorde: 41,
  /** Área de contenido. */
  margenLateral: 78,
  /**
   * La caja donde vive el contenido. `areaTop` sale de la portada de bloque más
   * alto (slide 01, título a 173 px de tinta) y `areaBottom` de la foto de ese
   * mismo slide, que termina exactamente en 1176.
   */
  areaTop: 150,
  areaBottom: 174,
} as const;

/**
 * Los íconos de Thiings traen color fijo y no se recolorean, así que sobre un
 * fondo de su mismo tono se funden: `silencio` cae a ΔE 27 sobre naranja y
 * `palomita-verde` a 21 sobre verde. La sombra los despega por su silueta, que
 * es lo único que se puede hacer sin tocar el archivo.
 */
const SOMBRA_ICONO =
  'drop-shadow(0 1px 1px rgba(28,20,12,.45)) drop-shadow(0 10px 22px rgba(28,20,12,.32))';

/**
 * Los colores que no dependen de la paleta.
 *
 * El slide de cierre va sobre el retrato del médico, no sobre el fondo de
 * color, así que su tinta y su teal son los mismos en todos los carruseles.
 */
export const color = {
  /** Cabecera y número del cierre, que van sobre la parte clara del retrato. */
  tintaSobreFoto: '#322018',
  /** Fondo del cierre mientras no haya retrato, y detrás de él si no cubre. */
  fondoCierre: '#D2BB9C',
  tealCta: '#079980',
} as const;

/**
 * La tinta compartida por todas las paletas.
 *
 * El crema de los títulos es de la marca, no del tema: se ve igual sobre azul
 * que sobre naranja. Vive aquí y no dentro de cada paleta justamente para que
 * ajustarlo una vez lo arregle en las tres.
 */
const tinta = {
  /** Parte ligera del título, y el cromo del pie. */
  titulo: '#FAF7F2',
  /** Énfasis: negrita y serif itálica. */
  crema: '#F3EDE1',
  chrome: '#FAF7F2',
  papel: '#F3F1EC',
} as const;

/**
 * Las paletas.
 *
 * El fondo dejó de ser identidad de marca: lo decide el tema. Sol y calor van
 * en naranja, plantas y polen en verde, y lo que no tiene color obvio se queda
 * en azul.
 *
 * ── Por qué paletas cerradas y no un hex por post ───────────────────────────
 * Porque el fondo es lo de menos: lo difícil es lo que va encima. Los tres
 * fondos tienen la misma luminancia (0.348, la del azul publicado), y por eso
 * el contraste del título es 2.47:1 en las tres, idéntico. Un hex libre por
 * post rompería esa relación sin avisar, y el error aparecería en el PNG ya
 * exportado.
 *
 * Lo que sí cambia con el tono es la separación cromática, y ahí cada paleta
 * trae su propia respuesta: el cuerpo y la bajada son tintes del mismo tono
 * que el fondo, la tinta del papel es su versión oscura, y la palomita cambia
 * en la paleta verde, donde el verde sobre verde desaparecería (ΔE 11).
 *
 * Agregar una paleta es agregar una entrada aquí. Lo único que hay que
 * respetar es la luminancia del fondo; `/plantilla` pinta el mismo carrusel en
 * todas, una al lado de otra, para verlo antes de usarla.
 */
export const paletas = {
  azul: {
    nombre: 'Azul',
    cuando: 'Lo que no tiene color obvio: impétigo, dermatitis. Es la respuesta por defecto.',
    fondo: '#51A2FF',
    cuerpo: '#DBEAFE',
    bajada: '#EFF6FF',
    tintaPapel: '#162456',
    check: '#22B04B',
    velo:
      'linear-gradient(180deg, rgba(24,60,120,.10) 0%, rgba(48,120,225,.42) 46%, rgba(81,162,255,.92) 78%, #51A2FF 100%)',
    /**
     * Sin sombra: es el fondo de todo el archivo publicado y así se ve. Los
     * íconos que se funden sobre azul —hoy, `informacion`— los caza el aviso
     * del editor, que es donde se arreglan: cambiando de ícono.
     */
    sombraIcono: 'none',
    ...tinta,
  },

  naranja: {
    nombre: 'Naranja',
    cuando: 'Sol, calor, verano, quemaduras, sudor.',
    fondo: '#ED842F',
    cuerpo: '#FBEBDE',
    bajada: '#FEF6F0',
    tintaPapel: '#51331B',
    check: '#22B04B',
    velo:
      'linear-gradient(180deg, rgba(95,57,27,.10) 0%, rgba(189,108,42,.42) 46%, rgba(237,132,47,.92) 78%, #ED842F 100%)',
    sombraIcono: SOMBRA_ICONO,
    ...tinta,
  },

  verde: {
    nombre: 'Verde',
    cuando: 'Plantas, polen, alergia estacional, primavera.',
    fondo: '#48B45D',
    cuerpo: '#E5F4E8',
    bajada: '#F4FAF5',
    tintaPapel: '#28442E',
    /** Verde oscuro: el de siempre sobre este fondo tendría ΔE 21, invisible. */
    check: '#0C4B19',
    velo:
      'linear-gradient(180deg, rgba(39,69,45,.10) 0%, rgba(69,136,82,.42) 46%, rgba(72,180,93,.92) 78%, #48B45D 100%)',
    sombraIcono: SOMBRA_ICONO,
    ...tinta,
  },
} as const;

export type NombrePaleta = keyof typeof paletas;

/** Para que Zod valide contra las llaves que existen de verdad. */
export const NOMBRES_PALETA = Object.keys(paletas) as [NombrePaleta, ...NombrePaleta[]];

export const PALETA_POR_DEFECTO: NombrePaleta = 'azul';

export function paletaDe(nombre: NombrePaleta | undefined) {
  return paletas[nombre ?? PALETA_POR_DEFECTO] ?? paletas[PALETA_POR_DEFECTO];
}

/**
 * Dos regímenes de tracking, y nada más. La medición los separa limpiamente:
 * todo lo que se lee de corrido va casi neutro; todo lo que es display o cromo
 * va apretado alrededor de −0.06em. Ahí está el aire de la marca.
 */
export const track = {
  titulo: '-0.062em',
  /** La serif itálica va mucho más suelta que la sans. */
  serif: '-0.025em',
  display: '-0.058em',
  lectura: '-0.012em',
} as const;

/**
 * Tipografías reales del kit de marca, auto-alojadas en public/fonts.
 * Albert Sans es variable (100–900), así que un solo archivo cubre los cuatro
 * pesos que usa la plantilla.
 */
export const fuente = {
  sans: "'Albert Sans', system-ui, sans-serif",
  serif: "'Fraunces', Georgia, serif",
} as const;

export const tipo = {
  titulo: { px: 92, lh: 1.095, ls: track.titulo, peso: 300, pesoFuerte: 700, anchoMax: 800 },
  tituloPortada: { px: 110, lh: 1.06, ls: track.titulo, peso: 300, pesoFuerte: 700, anchoMax: 820 },
  bajada: { px: 34, lh: 1.25, ls: '-0.057em', peso: 700, anchoMax: 820 },
  cuerpo: { px: 34, lh: 1.25, ls: track.lectura, peso: 400, anchoMax: 810 },
  punto: { px: 34, lh: 1.25, ls: track.lectura, peso: 400, anchoMax: 790 },
  nombre: { px: 21, lh: 1.26, ls: '-0.056em', peso: 700 },
  especialidad: { px: 21, lh: 1.26, ls: '-0.056em', peso: 400 },
  numero: { px: 38, ls: '-0.055em', peso: 800 },
  usuario: { px: 49, ls: '-0.064em', peso: 400 },
  /** En la portada el usuario va más chico y más abajo que en el resto. */
  usuarioPortada: { px: 29, ls: '-0.053em', peso: 400 },
  fuente: { px: 22, ls: '-0.059em', peso: 400 },
  desliza: { px: 21, ls: '0em', peso: 400 },
  pregunta: { px: 28, ls: '-0.020em', peso: 500 },
  /**
   * La línea grande del cierre. No aparece en el carrusel publicado que se
   * midió, así que este tamaño es una decisión, no una medición.
   */
  ctaFrase: { px: 52, lh: 1.15, ls: track.titulo, peso: 300, pesoFuerte: 700 },
  ctaL1: { px: 91, lh: 1.05, ls: track.titulo, peso: 300, pesoFuerte: 700 },
  ctaL2: { px: 51, ls: '-0.061em', peso: 400 },
  ctaL3: { px: 66, ls: '-0.020em', peso: 600 },
} as const;

/**
 * Mínimos del ajuste automático. Si un bloque llega aquí, el problema es que el
 * texto es largo: hay que recortarlo, no seguir encogiéndolo.
 */
export const ajuste = {
  tituloMin: 44,
  cuerpoMin: 26,
  paso: 2,
} as const;

export const bloque = {
  /** Separaciones verticales dentro del área, medidas de línea base a línea base. */
  gapTituloBajada: 45,
  gapBajadaCuerpo: 80,
  gapTituloCuerpo: 66,
  gapTituloLista: 94,
  gapCuerpoIcono: 95,
  gapCuerpoFoto: 96,

  /** Lista. La palomita se alinea con la primera línea base del punto. */
  gapLista: 45,
  palomita: 31,
  palomitaGap: 13,
  palomitaOffsetY: 3,

  /**
   * Emblema: un ícono chico encima del título, como el triángulo de alerta
   * del slide 03 publicado. Es distinto del visual: no reemplaza a la foto,
   * la acompaña, y sirve para marcar el tono del slide de un vistazo.
   */
  emblemaTam: 160,
  /**
   * Chico a propósito: el ícono ya viene con su aire. La ingesta los recentra
   * sobre un lienzo cuadrado, así que un ícono ancho trae margen arriba y
   * abajo dentro de su propia caja.
   */
  gapEmblemaTitulo: 8,

  /** Visual del slide de contenido. */
  mediaAncho: 745,
  mediaAlto: 341,
  mediaRadio: 27,
  iconoTam: 260,

  /** Portada. */
  areaPortadaBottom: 510,
  papelAncho: 424,
  papelAlto: 108,
  papelGap: 45,
  logoAncho: 338,
  logoBottom: 109,
  usuarioPortadaBottom: 20,

  /** Cierre. */
  ctaBottom: 236,
  gapFraseCta: 34,
  gapCtaL1L2: 57,
  gapCtaL2L3: 16,
  ctaLogoAncho: 482,

  /** Cromo del pie. */
  usuarioBottom: 32,
  fuenteBottom: 37,
  deslizaRight: 62,
  deslizaBottom: 39,
  /** En la referencia la palabra y la flecha se encabalgan un poco. */
  gapDesliza: -6,
  flechaAncho: 113,
  flechaAlto: 39,
  numeroLeft: 1007,
  numeroTop: 19,
  cabeceraTop: 30,
} as const;

/**
 * El velo del cierre. El de la portada vive en cada paleta, porque termina
 * fundido en su fondo para empalmar con el slide 01: si se quedara quemado en
 * azul, cambiar de paleta rompería la portada sin que nada avisara.
 */
export const velo = {
  cierre: 'linear-gradient(180deg, rgba(0,0,0,0) 34%, rgba(28,20,12,.72) 62%, #150F0A 92%)',
} as const;
