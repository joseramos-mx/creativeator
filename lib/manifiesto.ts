/**
 * lib/manifiesto.ts — quién es dueño de cada campo del manifiesto de íconos.
 *
 * El problema que resuelve: la ingesta reconstruía cada entrada desde cero a
 * partir del PNG, así que cualquier campo que no supiera calcular se perdía al
 * reingerir. En cuanto un ícono generado guarda `origen`, `proveedor`, `prompt`
 * y `fecha`, volver a pasar el archivo por la ingesta los borraba — y con el
 * prompt se pierde lo único que permite regenerar la pieza si cambia el estilo
 * de la cuenta.
 *
 * ── Por qué aquí y no en un archivo acompañante ─────────────────────────────
 * La otra salida evidente es dejar un `icono.json` al lado del PNG y fusionarlo
 * al ingerir. Funciona, pero **`public/iconos/*` está en `.gitignore`** —los
 * íconos de Thiings no se pueden redistribuir— y lo único versionado es
 * `manifest.json`. Un archivo acompañante quedaría ignorado también, así que
 * sería menos durable que el manifiesto al que pretende proteger. Y añade un
 * modo de fallo propio: mover el PNG sin su JSON pierde la metadata en
 * silencio, que es justo lo que se quería evitar.
 *
 * Así que la regla se dice aquí, en una frase: **la ingesta es dueña de los
 * campos que deriva del PNG y de ninguno más.** Eso arregla los cuatro campos
 * de la generación y también cualquiera que se añada mañana sin que nadie se
 * acuerde de este archivo.
 *
 * Su límite: si se borra la entrada del manifiesto a mano, la siguiente ingesta
 * la reconstruye sin la metadata de generación. Es correcto — borrar la entrada
 * es pedir que se reconstruya.
 */

/**
 * Lo que la ingesta calcula mirando el archivo. Todo lo demás es de quien lo
 * haya escrito, y se conserva.
 */
export const CAMPOS_DE_LA_INGESTA = [
  'slug',
  'nombre',
  'etiquetas',
  'color',
  'w',
  'h',
  'bytes',
] as const;

export type Entrada = Record<string, unknown>;

/**
 * La entrada que se guarda: lo que había, con lo que la ingesta acaba de
 * calcular encima.
 *
 * `undefined` en un campo calculado no borra el anterior. `color` devuelve
 * `null` cuando el ícono es enteramente transparente, y esa es una respuesta
 * legítima que sí debe escribirse; `undefined` es "no lo pude calcular", que no
 * es motivo para tirar lo que ya se sabía.
 */
export function fusionar(previa: Entrada | undefined, calculada: Entrada): Entrada {
  const salida: Entrada = { ...previa };
  for (const campo of CAMPOS_DE_LA_INGESTA) {
    if (calculada[campo] !== undefined) salida[campo] = calculada[campo];
  }
  return salida;
}
