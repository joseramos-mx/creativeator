import type { Candidato } from './tipos';

/**
 * lib/bancos/encuadre.ts — cuánto de la foto sobrevive al recorte.
 *
 * La plantilla mete la foto en una caja con `background-size: cover`, así que
 * la imagen se escala hasta cubrirla y lo que sobra se corta. Si la foto y la
 * caja tienen proporciones muy distintas, lo que queda es una tira del centro
 * y la escena original desaparece.
 *
 * Esto pasaba de verdad y por una causa concreta: la caja de los slides de
 * contenido mide **745 × 341**, que es apaisada, y al banco se le pedían
 * **retratos**. Un retrato de 2:3 dentro de una caja de 2,18:1 conserva el
 * 31 % de la imagen — una franja horizontal por la mitad. De ahí las fotos que
 * se veían cortadas sin que nadie entendiera por qué: no estaban mal elegidas,
 * estaban mal recortadas antes de elegirlas.
 *
 * Se arregla en dos sitios y los dos hacen falta: pidiéndole al banco la
 * orientación de la caja, y midiendo aquí lo que sobrevive para preferir a
 * quien mejor encaje. Lo primero mejora el promedio; lo segundo caza a los que
 * se cuelan igual, porque "apaisado" cubre desde 4:3 hasta 21:9.
 */

export type Caja = { ancho: number; alto: number };

/** La caja de foto de un slide de contenido. Sale de `bloque` en tokens.ts. */
export const CAJA_CONTENIDO: Caja = { ancho: 745, alto: 341 };

/** La portada es la foto a sangre: el lienzo entero. */
export const CAJA_PORTADA: Caja = { ancho: 1080, alto: 1350 };

/**
 * Por debajo de esto la foto ya no es la foto: es un fragmento suyo.
 *
 * La mitad es generoso a propósito. Recortar es normal —casi nada encaja
 * exacto— y un umbral estricto dejaría sin fotos a los temas con poco
 * material. Lo que hay que impedir es la tira del centro.
 */
export const MINIMO_VISIBLE = 0.5;

/**
 * Qué fracción del área original sigue viéndose después del recorte, de 0 a 1.
 *
 * Con `cover`, el resultado solo depende de las dos proporciones: la menor
 * dividida entre la mayor. Un 1 es un encaje exacto; un 0,31 es la tira.
 */
export function visibleTrasRecorte(ancho: number, alto: number, caja: Caja): number {
  if (!ancho || !alto || !caja.ancho || !caja.alto) return 0;
  const foto = ancho / alto;
  const hueco = caja.ancho / caja.alto;
  return Math.min(foto / hueco, hueco / foto);
}

export type ConEncuadre = Candidato & { visible: number };

/**
 * Ordena por encaje y aparta lo que se recortaría demasiado.
 *
 * No reordena por "mejor foto" —eso ya lo trae el banco, que sabe de
 * relevancia y aquí no se sabe— sino que **conserva el orden del banco entre
 * las que encajan bien**. Solo se hunden las que perderían más de la mitad.
 */
export function porEncuadre(candidatos: Candidato[], caja: Caja) {
  const medidos: ConEncuadre[] = candidatos.map((c) => ({
    ...c,
    visible: visibleTrasRecorte(c.ancho, c.alto, caja),
  }));

  return {
    encajan: medidos.filter((c) => c.visible >= MINIMO_VISIBLE),
    recortadas: medidos.filter((c) => c.visible < MINIMO_VISIBLE),
  };
}
