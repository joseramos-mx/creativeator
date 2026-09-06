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

/**
 * Guarda el manifiesto y, al lado, las excepciones de `.gitignore`.
 *
 * ── Por qué el .gitignore se genera ─────────────────────────────────────────
 * `public/iconos/*` está ignorado por una razón concreta: la colección de
 * Thiings es de pago y su licencia prohíbe redistribuirla, así que el
 * repositorio versiona el manifiesto y no los archivos.
 *
 * Esa razón **no alcanza a los íconos propios**. Los generados son nuestros, y
 * ahora mismo existirían en un solo disco. El prompt guardado permite
 * regenerarlos, pero eso cuesta una llamada y no devuelve el mismo archivo.
 *
 * Y la excepción se deriva del campo `origen`, no de una lista escrita a mano,
 * porque una lista hay que acordarse de actualizarla y el que se olvide es
 * justo el que se pierde. Así el siguiente ícono generado se versiona solo, sin
 * que nadie toque nada.
 *
 * El `.gitignore` anidado funciona porque el patrón de arriba ignora los
 * archivos de la carpeta (`public/iconos/*`) y no la carpeta misma: cuando un
 * directorio padre está excluido, git ya no puede volver a incluir nada de
 * dentro. Aquí sí puede, y es lo mismo que ya hacía `!public/iconos/manifest.json`.
 *
 * La miniatura va también, y no por simetría: el buscador del editor pinta
 * `thumbs/<slug>.png`, así que sin ella un clon recién bajado enseñaría el
 * ícono roto en la rejilla. Se puede regenerar, pero solo volviendo a pasar el
 * PNG por la ingesta, que es un paso que nadie va a adivinar.
 */
export function gitignoreDeIconos(lista: Entrada[]): string {
  const generados = lista
    .filter((e) => e.origen === 'generado')
    .map((e) => String(e.slug))
    .sort();

  return [
    '# Generado por lib/manifiesto.ts. No se edita a mano.',
    '#',
    '# public/iconos/* está ignorado porque la colección de Thiings no se puede',
    '# redistribuir. Los íconos propios sí se versionan: la restricción es de',
    '# ellos, no nuestra. La lista sale del campo `origen` del manifiesto, así',
    '# que el siguiente generado aparece aquí solo.',
    '!.gitignore',
    ...generados.map((slug) => `!${slug}.png`),
    // La miniatura va también, y no por simetría: el buscador del editor pinta
    // `thumbs/<slug>.png`, así que sin ella un clon recién bajado enseñaría el
    // ícono roto en la rejilla. Se regenera, pero solo volviendo a pasar el PNG
    // por la ingesta, que es un paso que nadie va a adivinar.
    //
    // Las tres líneas hacen falta y en este orden: el patrón de arriba ignora
    // `thumbs` como directorio, y git no puede volver a incluir nada dentro de
    // un directorio excluido. Primero se rescata la carpeta, luego se vuelve a
    // ignorar su contenido, y al final se salvan las miniaturas propias.
    ...(generados.length
      ? ['!thumbs/', 'thumbs/*', ...generados.map((slug) => `!thumbs/${slug}.png`)]
      : []),
    '',
  ].join('\n');
}
