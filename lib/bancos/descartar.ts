import type { Candidato } from './tipos';

/**
 * lib/bancos/descartar.ts — lo que no debe salir en la foto.
 *
 * Esta es la pieza que existe por un caso concreto: el slide 03 del carrusel de
 * impétigo, que habla de cómo se contagia en la escuela, se publicó con la foto
 * de un gimnasio. Nadie lo cazó porque la búsqueda decía "niños juntos" y un
 * gimnasio tiene niños juntos. Lo que faltaba no era una mejor consulta: era
 * decir en voz alta qué **no** puede aparecer.
 *
 * Por eso el descarte no borra candidatos: los aparta y dice por qué. Un
 * filtro que quita cosas en silencio no se distingue de una búsqueda con pocos
 * resultados, y entonces no se nota cuando está mal.
 */

export type Apartado = Candidato & { porque: string };
export type Cribado = { pasan: Candidato[]; apartados: Apartado[]; sinCredito: number };

/**
 * Separa los candidatos en los que pasan y los que no.
 *
 * Tres cribas, en este orden:
 *
 *  1. sin crédito → fuera y ni se cuentan como candidatos, solo como número.
 *     Lo que no se puede acreditar no se usa, así que ni se enseña.
 *  2. descartados por término → apartados, con el término que los apartó.
 *  3. el resto pasa.
 */
export function cribar(candidatos: Candidato[], descartar: readonly string[]): Cribado {
  const terminos = descartar.map(normalizar).filter((t) => t.length >= 3);

  const conCredito = candidatos.filter((c) => c.credito);
  const sinCredito = candidatos.length - conCredito.length;

  const pasan: Candidato[] = [];
  const apartados: Apartado[] = [];

  for (const candidato of conCredito) {
    const texto = normalizar(candidato.descripcion);
    const choca = terminos.find((t) => contiene(texto, t));
    if (choca) apartados.push({ ...candidato, porque: choca });
    else pasan.push(candidato);
  }

  return { pasan, apartados, sinCredito };
}

/**
 * Palabra entera, no subcadena.
 *
 * Sin esto, descartar "gym" apartaría cualquier foto cuya descripción incluya
 * "gymnastics" —que puede ser justo lo que se busca— y descartar "sport"
 * apartaría "transport". El descarte tiene que ser preciso o deja de usarse.
 */
function contiene(texto: string, termino: string) {
  // El término puede traer varias palabras ("equipo deportivo"): se busca la
  // secuencia entera, con plural opcional al final.
  return new RegExp(`(^| )${escapar(termino)}(s|es)?( |$)`).test(` ${texto} `);
}

/** Minúsculas y sin acentos: el banco escribe en inglés y el médico en español. */
function normalizar(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function escapar(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
