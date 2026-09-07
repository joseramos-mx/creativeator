/**
 * lib/temas.ts — el contexto y el prompt de la propuesta de temas.
 *
 * Va aparte de `lib/proponer.ts`, que es quien llama al modelo, por una razón
 * de verificación: esto se puede comprobar sin gastar una llamada y aquello no.
 * El banco importa este archivo y comprueba que los temas ya publicados y el
 * mes correcto llegan de verdad al prompt, que es justo lo que se rompe sin
 * avisar — con la lista vacía el modelo sigue contestando tres temas
 * razonables, y uno es el que la cuenta publicó el mes pasado.
 *
 * Por eso aquí no hay `server-only`, ni alias `@/`, ni un solo import: un
 * script de node tiene que poder cargarlo tal cual. Las paletas entran como
 * dato en el contexto en vez de importarse, y así el banco puede pasar las de
 * verdad —las de template/tokens.ts— y comprobar que llegan.
 */

export type ContextoDeTemas = {
  /** El mes en curso, en español y en minúsculas. */
  mes: string;
  /** Los temas que la cuenta ya publicó o tiene en borrador. */
  publicados: string[];
  especialidad: string;
  ciudad: string;
  /** Las paletas con su regla, de template/tokens.ts. */
  paletas: { nombre: string; cuando: string }[];
};

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** El mes de una fecha, en español. Se pasa la fecha para poder probarlo. */
export function mesDe(fecha: Date): string {
  return MESES[fecha.getMonth()];
}

/** Para escribir la cantidad en el prompt como se escribe en el resto. */
const NUMEROS = [
  'cero', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho',
  'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis',
  'diecisiete', 'dieciocho', 'diecinueve', 'veinte',
];
const enPalabras = (n: number) => NUMEROS[n] ?? String(n);

/**
 * El prompt de la propuesta.
 *
 * `cuantos` cambia más que un número. Con tres, el modelo propone los tres
 * temas más obvios del mes y está bien: alguien los va a leer. Con la tanda
 * entera de un mes hay que pedirle además dos cosas que con tres no hacían
 * falta —repartir el calendario dentro del mes y no gastar el mes entero en una
 * sola condición—, porque nadie va a comparar doce títulos entre sí.
 */
export function instrucciones(contexto: ContextoDeTemas, cuantos = 3): string {
  const opciones = contexto.paletas.map((p) => `  · ${p.nombre}: ${p.cuando}`).join('\n');
  const tanda = cuantos > 3;

  const yaHechos = contexto.publicados.length
    ? contexto.publicados.map((t) => `  · ${t}`).join('\n')
    : '  (todavía ninguno)';

  return `Propón ${enPalabras(cuantos)} tema${cuantos === 1 ? '' : 's'} para los próximos carruseles de esta cuenta.

## Estamos en ${contexto.mes}

La mitad del valor de un carrusel es llegar cuando el problema está pasando. En
${contexto.ciudad} eso quiere decir pensar en qué trae este mes: el calendario
escolar, el clima, la temporada de alergias, las vacaciones. Un tema que sirve
igual en cualquier mes del año casi siempre es un tema flojo.

## Quién firma

${contexto.especialidad}. **Alergología y dermatología**, no dermatología
general, y la diferencia importa para elegir tema:

  · Sí son suyos: dermatitis atópica, urticaria, alergias alimentarias y
    ambientales con expresión en la piel, dermatitis de contacto, reacciones a
    medicamentos, asma y rinitis en lo que tocan a la piel, infecciones
    cutáneas comunes de la infancia, prueba de parche.
  · No son suyos, aunque sean de piel: cirugía dermatológica, estética y
    rellenos, láser, tratamiento del melanoma, tricología quirúrgica. Si el
    tema termina en "eso lo ve otro especialista", no es un buen carrusel para
    esta cuenta.

## Lo que ya se publicó — no lo repitas

${yaHechos}

No propongas ninguno de esos ni una variante que diga lo mismo con otro título.
Sí puedes proponer un ángulo distinto de la misma condición si el ángulo cambia
lo que se aprende: "cómo se contagia" y "cómo distinguirlo de un fuego" son dos
carruseles, "qué es el impétigo" y "todo sobre el impétigo" son uno.

${tanda ? `## Son ${enPalabras(cuantos)} para el mismo mes

No son ${enPalabras(cuantos)} temas sueltos: es el mes entero de la cuenta, y se
va a ver como una cuadrícula.

  · **Repártelos dentro del mes.** Unos que toquen la primera semana y otros la
    última. El "porQueAhora" de cada uno debería poder decir *cuándo* de
    ${contexto.mes}, no solo que es de ${contexto.mes}.
  · **No gastes el mes en una sola condición.** Dos ángulos de la dermatitis
    atópica caben; ${enPalabras(cuantos)} carruseles de dermatitis atópica son un
    mes desperdiciado. Cubre cosas distintas de lo que esta cuenta atiende.
  · **Que las paletas no salgan todas iguales.** No fuerces el color: la regla
    manda y azul sigue siendo la respuesta cuando el tema no tiene color. Pero
    si dos temas admiten honestamente colores distintos, dales distintos — la
    cuadrícula del perfil se ve de un vistazo.

` : ''}${tanda ? `## Son ${enPalabras(cuantos)} para el mismo mes

No son ${enPalabras(cuantos)} temas sueltos: es el mes entero de la cuenta, y se
va a ver como una cuadrícula.

  · **Repártelos dentro del mes.** Unos que toquen la primera semana y otros la
    última. El "porQueAhora" de cada uno debería poder decir *cuándo* de
    ${contexto.mes}, no solo que es de ${contexto.mes}.
  · **No gastes el mes en una sola condición.** Dos ángulos de la dermatitis
    atópica caben; ${enPalabras(cuantos)} carruseles de dermatitis atópica son un
    mes desperdiciado. Cubre cosas distintas de lo que esta cuenta atiende.
  · **Que las paletas no salgan todas iguales.** No fuerces el color: la regla
    manda y azul sigue siendo la respuesta cuando el tema no tiene uno. Pero si
    dos temas admiten honestamente colores distintos, dales distintos — la
    cuadrícula del perfil se ve de un vistazo.

` : ''}## La paleta

A cada propuesta le toca una:

${opciones}

Si el tema no tiene un color obvio, la respuesta es azul. Es la respuesta, no
un relleno.

## Los cuatro campos de cada propuesta

  · tema — como se lo dirías a alguien, no un titular. "Dermatitis del pañal en
    la temporada de calor", no "Guía completa de dermatitis del pañal".
  · porQueAhora — una línea. Qué hace que este tema toque en ${contexto.mes} y
    no en marzo. Si no hay una razón de calendario de verdad, dilo: es
    información para decidir, no un argumento de venta.
  · paleta y porQuePaleta — la que le toca y por qué, en una línea.

${enPalabras(cuantos)} propuestas distintas entre sí, no ${enPalabras(cuantos)} ángulos del mismo tema.`;
}
