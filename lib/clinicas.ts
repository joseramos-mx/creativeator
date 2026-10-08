/**
 * lib/clinicas.ts — la búsqueda en el archivo clínico.
 *
 * El archivo clínico (Wikimedia Commons, ver lib/bancos/commons.ts) es una
 * fuente más de fotos, con su licencia registrada igual que Pexels. No lleva
 * firma ni aprobación dentro de la app: la validación con la cuenta pasa por
 * fuera —las imágenes se le mandan y dice si algo cambia—, y pedírsela aquí
 * también sería molestarla dos veces.
 */

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
