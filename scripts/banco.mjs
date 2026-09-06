/**
 * scripts/banco.mjs — `npm run banco`
 *
 * El banco del disparador de seguridad: quince frases, ocho que tienen que
 * saltar y siete que no.
 *
 * Es el único disparador que no se puede comprobar mirando el texto. Una cifra
 * se ve, una fuente citada se ve; "necesita antibiótico" y "suele picar de
 * noche" tienen las dos un verbo y solo una manda hacer algo. Cada vez que se
 * toque MODAL, ACCION o NEGACION en lib/afirmaciones.ts hay que correr esto:
 * acotar el ruido es fácil, y tumbar sin darse cuenta una de las siete que
 * pesan también.
 *
 * Se corre sin navegador y sin servidor: es una prueba de una expresión
 * regular, no del editor.
 */

import { afirmacionesDe } from '../lib/afirmaciones.ts';

/**
 * Las que deben saltar son indicaciones: mandan hacer algo, o dejar de hacerlo,
 * en tratamiento, contagio, vuelta a clases o consulta.
 *
 * Las siete que no son descripción. Tres de ellas —las marcadas— son falsos
 * positivos reales, sacados del primer carrusel que redactó el modelo: en las
 * tres hay una negación a dos palabras de "crema", y ninguna manda nada.
 *
 * La octava que salta llegó después, y por el camino contrario: al acotar la
 * negación se cayó el slide de "cuándo acudir a consulta", que empieza por
 * "Agenda valoración si…" y no llevaba ningún modal de la lista. Es el bloque
 * donde la firma del médico más pesa, así que entró al banco para que no se
 * vuelva a caer sin que nadie se entere.
 */
const BANCO = [
  // ── las que tienen que saltar ──
  { salta: true, texto: 'Necesita antibiótico recetado por un médico.' },
  { salta: true, texto: 'Puede volver a clases 24 horas después de empezar el tratamiento.' },
  { salta: true, texto: 'No lo trates a ciegas con remedios caseros.' },
  { salta: true, texto: 'Hay que separar sus toallas y sábanas del resto de la familia.' },
  { salta: true, texto: 'Acude a valoración si le duele al tocarla o si hay fiebre.' },
  { salta: true, texto: 'No debe compartir toalla mientras tenga llagas abiertas.' },
  { salta: true, texto: 'Conviene suspender la crema si la piel arde al aplicarla.' },
  {
    salta: true,
    porque: 'la del slide de consulta',
    texto: 'Agenda valoración si la comezón no lo deja dormir o si la piel no mejora con los cuidados en casa.',
  },

  // ── las que no ──
  {
    salta: false,
    porque: 'falso positivo real',
    texto: 'La resequedad normal de invierno mejora sola con crema y no despierta al niño de noche.',
  },
  {
    salta: false,
    porque: 'falso positivo real',
    texto: 'Vas a querer la lista de cuidados a la mano y no buscándola a las tres de la mañana.',
  },
  {
    salta: false,
    porque: 'falso positivo real',
    texto: '¿Tu hijo lleva semanas rascándose y la crema ya no alcanza?',
  },
  {
    salta: false,
    texto: 'Esas llaguitas con costra color miel casi siempre salen alrededor de la nariz y la boca.',
  },
  { salta: false, texto: 'Suele picar más de noche, cuando el niño se calienta en la cama.' },
  { salta: false, texto: 'En pieles morenas se ven cafés, moradas o grisáceas más que rojas.' },
  { salta: false, texto: 'El impétigo es una infección bacteriana de la piel, muy común en niños.' },
];

/** Una frase sola, sin fuente: así el único disparador posible es seguridad. */
function salta(texto) {
  const [afirmacion] = afirmacionesDe({ slides: [{ tipo: 'contenido', cuerpo: texto }] });
  return {
    salta: Boolean(afirmacion?.disparadores.includes('seguridad')),
    marca: afirmacion?.marcas.find((m) => !/^\d/.test(m)) ?? '',
  };
}

let fallos = 0;
console.log('El disparador de seguridad, contra el banco\n');

for (const caso of BANCO) {
  const r = salta(caso.texto);
  const bien = r.salta === caso.salta;
  if (!bien) fallos++;

  const signo = bien ? 'OK  ' : 'FALLA';
  const esperado = caso.salta ? 'salta' : 'no salta';
  const nota = caso.porque ? ` (${caso.porque})` : '';
  console.log(`  ${signo} ${esperado}${nota}: ${caso.texto}`);
  if (r.salta) console.log(`        marcó "${r.marca}"`);
  if (!bien) {
    console.log(`        pero ${r.salta ? 'saltó' : 'no saltó'} — esto es lo que hay que arreglar`);
  }
}

const aciertos = BANCO.length - fallos;
console.log(
  fallos === 0
    ? `\nLas ${BANCO.length}, bien.`
    : `\n${aciertos} de ${BANCO.length}. Con ${fallos} mal, el acotamiento no vale: es preferible el ruido.`,
);
if (fallos > 0) process.exitCode = 1;
