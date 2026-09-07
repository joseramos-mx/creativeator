/**
 * lib/iconos/clinico.ts — el concepto que no se genera.
 *
 * La regla está escrita en tres sitios —el SKILL, `references/iconos-generados.md`
 * y el propio `content/estilo-iconos.md`— y dice lo mismo en los tres: **si la
 * imagen es lo que el lector debe aprender a reconocer, tiene que ser real y
 * aprobada.** El criterio no es el estilo ni el realismo, es la función. Una
 * carita 3D como recurso emocional se puede; la misma carita con los signos de
 * la condición dibujados encima, no.
 *
 * Y aun así se coló. Con la generación automática enchufada, el redactor pidió
 * "grouped raised bumps on arm skin" y "hives welts", y salieron dos renders de
 * un antebrazo con ronchas — exactamente la imagen que un papá usaría para
 * decidir si lo que ve en su hijo es eso. Nadie mintió: la instrucción estaba
 * en el archivo de estilo, que va al modelo de imagen, y el modelo la siguió en
 * cuanto al estilo. Lo que faltaba era que alguien se negara a pedirlo.
 *
 * Así que el filtro va aquí, en el camino, y no solo en un prompt. Es la misma
 * forma que el resto del proyecto: la instrucción orienta, la comprobación
 * decide, y cuando dudan gana la comprobación.
 */

/** Lo que se dibuja sobre una piel enferma, no un objeto. */
const SIGNOS = [
  'rash', 'rashes', 'hive', 'hives', 'welt', 'welts', 'wheal', 'wheals',
  'lesion', 'lesions', 'blister', 'blisters', 'pustule', 'pustules',
  'papule', 'papules', 'bump', 'bumps', 'spot', 'spots', 'patch', 'patches',
  'scab', 'scabs', 'crust', 'crusts', 'sore', 'sores', 'ulcer', 'ulcers',
  'eczema', 'psoriasis', 'impetigo', 'urticaria', 'dermatitis', 'acne',
  'redness', 'inflamed', 'infected', 'swollen', 'swelling', 'itchy',
  'peeling', 'flaking', 'scaly', 'irritated', 'breakout', 'outbreak',
  // en español, por si el concepto llega sin traducir
  'roncha', 'ronchas', 'sarpullido', 'lesion', 'ampolla', 'ampollas',
  'costra', 'costras', 'llaga', 'llagas', 'erupcion', 'hinchado', 'hinchazon',
];

/** El cuerpo donde se dibujarían. Solo cuenta si además hay un signo. */
const CUERPO = [
  'skin', 'arm', 'leg', 'face', 'cheek', 'neck', 'back', 'hand', 'foot',
  'lip', 'lips', 'eyelid', 'scalp', 'torso', 'chest', 'belly', 'body',
  'piel', 'brazo', 'pierna', 'cara', 'mejilla', 'cuello', 'espalda', 'mano',
  'labio', 'labios', 'parpado', 'cuero',
];

/**
 * Si este concepto describe un signo clínico, dice por qué. Si no, `null`.
 *
 * Dos criterios, y el segundo es el que evita pasarse de frenada:
 *
 *  · un signo **sobre una parte del cuerpo** —"bumps on arm skin"— es la foto
 *    clínica dibujada, y no pasa;
 *  · un signo a solas —"hives", "rash"— tampoco, porque nombrar la condición ya
 *    es pedir su retrato.
 *
 * Lo que sí pasa es el objeto que la acompaña: "cream tube", "cold compress",
 * "mosquito", "antihistamine box". Ninguno enseña a reconocer nada.
 */
export function esSignoClinico(concepto: string): string | null {
  const palabras = new Set(
    concepto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .split(/[^a-z]+/)
      .filter(Boolean),
  );

  const signo = SIGNOS.find((s) => palabras.has(s));
  if (!signo) return null;

  const parte = CUERPO.find((c) => palabras.has(c));
  return parte
    ? `describe "${signo}" sobre "${parte}": eso es una foto clínica dibujada`
    : `nombra "${signo}", que es el signo que el lector debe reconocer`;
}
