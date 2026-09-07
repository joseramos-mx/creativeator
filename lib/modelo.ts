/**
 * lib/modelo.ts — qué modelo escribe cada cosa.
 *
 * Estaba repetido en tres archivos como una constante suelta, así que cambiarlo
 * eran tres ediciones y una de ellas se olvidaba. Ahora es un sitio y una
 * variable de entorno, y probar otro modelo no es tocar código.
 *
 * ── No todas las llamadas valen lo mismo ────────────────────────────────────
 * Por eso son tres constantes y no una. Las tres llamadas del sistema tienen
 * apuestas muy distintas:
 *
 *  · **Redactar** escribe el texto médico, con sus cifras y sus indicaciones de
 *    seguridad. Es la cara y es la larga: unos 7.400 tokens de entrada y 7.800
 *    de salida por carrusel, medidos.
 *  · **Proponer temas** elige entre reglas que ya están escritas en el prompt.
 *    Es corta y no inventa contenido: elige.
 *  · **Los criterios de búsqueda** convierten un slide en términos para el
 *    banco de fotos. Si se equivoca, sale otra foto de aula.
 *
 * Bajar de nivel las dos últimas no se nota. Bajar la primera sí, y **no por
 * donde parece**: la barrera de afirmaciones no deja publicar una cifra sin
 * revisar, venga del modelo que venga, así que lo que se arriesga no es que
 * salga una mentira publicada. Lo que se arriesga es que salgan **más
 * afirmaciones que revisar**, y revisar ya es el cuello de botella de todo esto
 * —once por carrusel, cinco de ellas para el médico—. Un modelo más barato que
 * escriba dos cifras de más por carrusel se paga solo en tiempo de revisión.
 *
 * Así que si se cambia el de redactar, la forma de saber si salió a cuenta no
 * es leer el carrusel: es mirar cuántas afirmaciones dejó en la cola. Está en
 * el resumen de `npm run mes` y en el panel del calendario.
 *
 * ── Sobre "uno más barato" ──────────────────────────────────────────────────
 * Cambiar de **versión** dentro de Opus no cambia de precio: Opus es el nivel
 * alto y 4.7 sigue siendo Opus. Lo que baja el costo de verdad es cambiar de
 * **nivel** — Opus → Sonnet, y Sonnet → Haiku para lo trivial.
 */

/** El nivel alto. Escribe el carrusel. */
const OPUS = 'claude-opus-5';
/** El nivel medio. Suficiente para elegir entre opciones ya escritas. */
const SONNET = 'claude-sonnet-5';

/**
 * El que escribe los carruseles.
 *
 * Se cambia sin tocar código, poniendo `CLAUDE_MODELO` en `.env.local`. Vuelve
 * a Opus quitando la línea.
 */
export const MODELO_REDACCION = process.env.CLAUDE_MODELO?.trim() || OPUS;

/** El que propone temas cuando no hay calendario. */
export const MODELO_PROPUESTA = process.env.CLAUDE_MODELO_AUXILIAR?.trim() || SONNET;

/** El que traduce un slide a términos de búsqueda en el banco de fotos. */
export const MODELO_CRITERIOS = process.env.CLAUDE_MODELO_AUXILIAR?.trim() || SONNET;
