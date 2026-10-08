/**
 * lib/instrucciones.ts — los prompts de redactar y de buscar foto.
 *
 * Lo que es de la app vive aquí: la forma de los campos, cómo se busca una
 * foto, la regla de las cifras. Lo que es de la cuenta llega de fuera, de
 * proyectos/<id>/ —quién es, qué slides lleva un carrusel, qué imágenes no se
 * piden nunca, qué fuentes valen—, y se inserta en su sitio.
 *
 * Va aparte de lib/redactar.ts y lib/criterios.ts, que son quienes llaman al
 * modelo, por lo mismo que lib/temas.ts: esto se puede comprobar sin gastar
 * una llamada. `npm run banco-proyectos` arma los prompts de cada proyecto y
 * mira que lo de cada cuenta llegue, y que no se cuele lo de otra.
 *
 * Sin imports, para que un script de node lo cargue tal cual.
 */

/** Las piezas de proyectos/<id>/prompts/ que usa la redacción. */
export type PiezasDeRedaccion = {
  /** estructura.md — qué slides y en qué orden. */
  estructura: string;
  /** iconos.md — lo que nunca se pide como ícono. */
  iconos: string;
  /** fotos.md — qué foto de banco sí y cuál no. */
  fotos: string;
};

export type ContextoDeRedaccion = {
  marca: {
    nombre: string;
    usuario: string;
    especialidad: string;
    ciudad: string;
    plataforma: string;
    fuentes: string[];
  };
  piezas: PiezasDeRedaccion;
  /** Las paletas con su regla, de la plantilla. */
  paletas: Record<string, { cuando: string }>;
  paletaPorDefecto: string;
};

export type Editorial = { pilar?: string; objetivo?: string; nota?: string; fecha?: string };

export type SlideParaBuscar = {
  tema: string;
  titulo: string;
  bajada?: string;
  cuerpo: string;
  /** Lo que escribió el redactor sobre qué debe enseñar la foto. */
  ideaImagen?: string;
};

export type ContextoDeCriterios = {
  /** proyecto.json → `giro`: "un dermatólogo". */
  giro: string;
  /** prompts/fotos-banco.md — qué se busca y qué no, con su encabezado. */
  fotosBanco: string;
};

/**
 * Parte un renglón largo como están partidos los prompts, a 78 columnas.
 * Solo se usa con lo que se arma a partir de una lista —las fuentes—, que no
 * tiene renglones escritos a mano.
 */
function envolver(texto: string, ancho = 78): string {
  const renglones: string[] = [];
  let actual = '';
  for (const palabra of texto.split(' ')) {
    if (actual && actual.length + 1 + palabra.length > ancho) {
      renglones.push(actual);
      actual = palabra;
    } else {
      actual = actual ? `${actual} ${palabra}` : palabra;
    }
  }
  if (actual) renglones.push(actual);
  return renglones.join('\n');
}

export function instruccionesDeRedaccion(
  tema: string,
  { marca, piezas, paletas, paletaPorDefecto }: ContextoDeRedaccion,
  editorial?: Editorial,
) {
  const opciones = Object.entries(paletas)
    .map(([nombre, p]) => `  · ${nombre}: ${p.cuando}`)
    .join('\n');

  return `Escribe un carrusel de Instagram sobre: ${tema}

## La cuenta

${marca.nombre} · ${marca.usuario} · ${marca.especialidad} · ${marca.ciudad}.
Las citas se agendan en ${marca.plataforma}, con el enlace en la biografía.

## Estructura

${piezas.estructura}

**No escribas slide de cierre.** La cuenta usa siempre el mismo, ya hecho, y
se añade después. Si escribieras uno, habría que borrarlo cada vez.

En cada slide rellena solo lo que le toca y deja el resto vacío ("" o []).

## La paleta

Elige una por el tema:

${opciones}

Si el tema no tiene un color obvio —impétigo, dermatitis atópica— la respuesta
es "${paletaPorDefecto}". Es la respuesta, no un relleno: no fuerces una
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

${piezas.iconos}

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

${piezas.fotos}

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

${envolver(`Instituciones válidas: ${marca.fuentes.join(', ')}.`)}

${
    editorial?.pilar || editorial?.objetivo || editorial?.nota
      ? `## Esto ya está decidido en el calendario editorial

No lo propongas: escribe **hacia** esto. Va a ir en el post tal cual, y si
devuelves otra cosa se sobrescribe.
${editorial.pilar ? `\n  · pilar — ${editorial.pilar}. Es la línea editorial del post: el ángulo\n    del carrusel tiene que caer dentro de ella.` : ''}${
          editorial.objetivo
            ? `\n  · objetivo — **${editorial.objetivo}**. Es lo que se busca del lector, y\n    decide a cuál de los cierres del copy se le carga la mano. Escribe el copy\n    para que eso sea lo que pase.`
            : ''
        }${editorial.nota ? `\n  · nota — ${editorial.nota}. Es lo que hace que este tema toque ahora;\n    que se note en la portada y en el gancho del copy.` : ''}

Devuélvelos igual en su campo, con estos valores.`
      : `## Los tres campos que no se pintan en ningún slide

  · pilar — la línea editorial del post, en tres o cuatro palabras: "Cuidado
    diario de la piel", "Lo que no es alergia". Sirve para no repetir eje dos
    veces en el mismo mes.
  · objetivo — qué se busca del lector: guardar, compartir, comentar o agendar.
    Decide a cuál de los cierres del copy se le carga la mano.
  · nota — el gancho de calendario, corto: "Primeros calores", "Semana de
    frío". Qué hace que este tema toque publicarse ahora.`
  }

## El copy

Sigue la fórmula que está en tus instrucciones, con sus bloques y sus emojis, y
termina en exactamente cinco hashtags en MayúsculasPegadas, con su almohadilla
("#PielSensible"). El último cruza especialidad y ciudad.`;
}

export function instruccionesDeCriterios(slide: SlideParaBuscar, piezas: ContextoDeCriterios) {
  return `Este es un slide de un carrusel de Instagram de ${piezas.giro}, sobre
"${slide.tema}". Hay que buscarle una foto de banco.

## El slide

Título: ${sinMarcado(slide.titulo)}
${slide.bajada ? `Bajada: ${slide.bajada}\n` : ''}Cuerpo: ${slide.cuerpo}
${slide.ideaImagen ? `Idea de imagen ya escrita: ${slide.ideaImagen}` : ''}

${piezas.fotosBanco}

## Los tres campos

  · query — en inglés, de tres a seis palabras, del vocabulario con el que
    indexan los bancos de fotos. "children classroom backpacks school", no
    "impetigo contagion at school".

  · criterios — en español, en una frase: qué tiene que enseñar la foto para
    que sirva a ESTE slide. Lo lee una persona mientras elige.

  · descartar — de dos a seis términos, **en inglés**, que aparecerían en la
    descripción de una foto que encaja con la consulta y aun así está mal para
    este slide.

    **Una sola palabra siempre que sirva.** El descarte busca la secuencia
    entera, así que "gym equipment" no aparta una foto descrita como "a gym
    full of adults", y "gym" sí. Usa dos palabras solo cuando una sola apartaría
    fotos buenas.

Este último es el campo que importa y conviene explicar por qué. Un slide sobre
cómo se contagia una infección en la escuela se publicó una vez con la foto de
un gimnasio: encajaba con "niños juntos" y no enseñaba nada de lo que decía el
texto. Piensa qué buscaría alguien con la consulta de arriba y saldría mal.
Términos concretos y buscables —"gym", "sports equipment", "adults only"—, no
categorías abstractas.`;
}

/** El título viene con el marcado de la plantilla; al modelo le sobra. */
function sinMarcado(s: string) {
  return s.replace(/\*\*?/g, '').replace(/\\n|\n/g, ' ').replace(/\s+/g, ' ').trim();
}