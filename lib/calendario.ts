/**
 * lib/calendario.ts — el calendario editorial, leído de la hoja de cálculo.
 *
 * Hasta ahora la tanda del mes **proponía** temas. Con un calendario de verdad
 * eso sobra: los temas ya están decididos, con su fecha, su pilar, su objetivo
 * y su nota. Y no es un detalle de comodidad — el post de impétigo que ya está
 * publicado lleva exactamente "Diagnóstico que salva", "guardar" y "Regreso a
 * clases", copiados a mano de la hoja. El modelo los estaba **inventando** en
 * cada carrusel nuevo, así que dos posts del mismo pilar podían salir con dos
 * pilares distintos y nadie lo notaba hasta ver la cuadrícula del mes.
 *
 * Lo que se lee aquí manda sobre lo que escriba el modelo. Ver `lib/redactar.ts`.
 *
 * ── El formato ──────────────────────────────────────────────────────────────
 * Lo que sale de copiar la hoja y pegarla en un archivo: una tabla con
 * tabulaciones. También lee comas, con comillas, por si se exporta como CSV.
 * Las columnas se buscan **por su nombre**, así que sobra que estén en otro
 * orden y sobran las columnas de más.
 *
 * Sin `server-only`, sin alias `@/` y sin un solo import, como `lib/temas.ts`,
 * `lib/mes.ts` y `lib/slug.ts`: el script de la tanda y el banco lo cargan tal
 * cual desde node.
 */

export type Fila = {
  /** El número de la columna "No.", si la hay. Para poder decir `--desde 4`. */
  numero: number | null;
  /** La fecha en ISO, `YYYY-MM-DD`. Va a `creado` del post. */
  fecha: string;
  tema: string;
  pilar: string;
  /** Ya normalizado a lo que acepta el esquema. */
  objetivo: 'guardar' | 'compartir' | 'comentar' | 'agendar' | null;
  nota: string;
  /** La línea del archivo, para poder señalar dónde está el problema. */
  linea: number;
};

export type Lectura = {
  filas: Fila[];
  /**
   * Lo que se saltó y por qué. No es ruido: una fila que desaparece en
   * silencio es un carrusel que nunca se escribe y que nadie echa de menos
   * hasta que llega su fecha.
   */
  saltadas: { linea: number; tema: string; porque: string }[];
};

const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

const OBJETIVOS = new Set(['guardar', 'compartir', 'comentar', 'agendar']);

/** Para comparar encabezados y valores sin pelearse con acentos ni mayúsculas. */
function llano(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .trim();
}

/**
 * Parte una línea en celdas.
 *
 * Con tabulaciones es trivial y es lo que sale de copiar y pegar una hoja. Con
 * comas hay que respetar las comillas, porque un tema como "Alergia al níquel,
 * los aretes y la bisutería" partiría en tres.
 */
function celdas(linea: string, separador: '\t' | ','): string[] {
  if (separador === '\t') return linea.split('\t').map((c) => c.trim());

  const salida: string[] = [];
  let actual = '';
  let entreComillas = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (c === '"') {
      // Dos comillas seguidas dentro de un campo son una comilla literal.
      if (entreComillas && linea[i + 1] === '"') { actual += '"'; i++; }
      else entreComillas = !entreComillas;
    } else if (c === ',' && !entreComillas) {
      salida.push(actual.trim());
      actual = '';
    } else {
      actual += c;
    }
  }
  salida.push(actual.trim());
  return salida;
}

/**
 * La fecha de la hoja, en ISO.
 *
 * `24/08/2026` es 24 de agosto y no 8 de abril. Da igual lo obvio que parezca:
 * el mismo archivo abierto en una hoja configurada en inglés sale como
 * `08/24/2026`, y las dos formas se leen sin error y dan meses distintos. Por
 * eso el día de la semana de la hoja no es decoración — es lo que permite
 * **comprobar** la lectura en vez de suponerla. Ver `verificarDia`.
 */
export function aISO(fecha: string): string | null {
  const t = fecha.trim();

  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return t;

  const barras = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!barras) return null;

  const [, dia, mes, ano] = barras;
  if (+mes < 1 || +mes > 12 || +dia < 1 || +dia > 31) return null;
  return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
}

/**
 * Si la fecha parece estar en formato inglés, lo dice. Si no, `null`.
 *
 * Va junto a `verificarDia` y se reparten el trabajo, porque ninguna de las dos
 * sola cubre el problema:
 *
 *  · `08/24/2026` tiene un "mes" 24, imposible. Eso lo caza esto, y hace falta
 *    porque `aISO` ya la rechaza y sin este aviso el mensaje sería "no entiendo
 *    la fecha", que manda a mirar dónde no es.
 *  · `08/09/2026` es una fecha válida leída de las dos formas —8 de septiembre
 *    y 9 de agosto— y solo el día de la semana de la hoja las separa. Eso lo
 *    caza `verificarDia`.
 */
export function pareceInvertida(fecha: string): string | null {
  const m = fecha.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!m) return null;
  const [, primero, segundo] = m;
  return +segundo > 12 && +primero <= 12
    ? `la fecha "${fecha.trim()}" tiene el mes y el día al revés: aquí van dd/mm/aaaa`
    : null;
}

/**
 * Que la fecha leída caiga en el día de la semana que dice la hoja.
 *
 * Devuelve el problema o `null`. Es la comprobación que caza el mes y el día
 * intercambiados sin tener que adivinar la configuración regional de nadie:
 * si `24/08/2026` fuera el 8 de abril, no sería lunes.
 */
export function verificarDia(iso: string, dia: string): string | null {
  const esperado = llano(dia);
  if (!esperado || esperado === '' || !DIAS.includes(esperado)) return null;

  // Mediodía UTC para que ningún huso empuje la fecha al día anterior.
  const real = DIAS[new Date(`${iso}T12:00:00Z`).getUTCDay()];
  return real === esperado
    ? null
    : `la hoja dice ${esperado} pero ${iso} cae en ${real} — ¿está el día y el mes al revés?`;
}

/**
 * Lee el calendario.
 *
 * Se queda solo con los carruseles: los reels no se escriben aquí, y una fila
 * sin tema —"Por definir"— tampoco. Las dos cosas se cuentan en `saltadas`.
 */
export function leerCalendario(texto: string): Lectura {
  const lineas = texto.split(/\r?\n/);
  const iPrimera = lineas.findIndex((l) => /tema/i.test(l) && /fecha/i.test(l));
  if (iPrimera === -1) {
    throw new Error(
      'No encuentro el encabezado del calendario: hace falta una fila con las ' +
        'columnas "Fecha" y "Tema". Copia la tabla entera desde la hoja, con sus títulos.',
    );
  }

  const separador: '\t' | ',' =
    lineas[iPrimera].split('\t').length >= lineas[iPrimera].split(',').length ? '\t' : ',';

  // Las columnas por nombre y no por posición: así sobra el orden y sobran las
  // columnas de más, que en una hoja de trabajo siempre acaban apareciendo.
  const encabezado = celdas(lineas[iPrimera], separador).map(llano);
  const col = (...nombres: string[]) => {
    for (const n of nombres) {
      const i = encabezado.findIndex((e) => e === n || e.startsWith(`${n} `));
      if (i !== -1) return i;
    }
    return -1;
  };

  const iFecha = col('fecha');
  const iTema = col('tema');
  if (iFecha === -1 || iTema === -1) {
    throw new Error('El calendario necesita al menos las columnas "Fecha" y "Tema".');
  }
  const iNo = col('no', 'num', 'numero');
  const iDia = col('dia');
  const iTipo = col('tipo');
  const iPilar = col('pilar');
  const iObjetivo = col('objetivo');
  const iNota = col('nota', 'nota estrategica');

  const filas: Fila[] = [];
  const saltadas: Lectura['saltadas'] = [];
  const dame = (c: string[], i: number) => (i === -1 ? '' : (c[i] ?? '').trim());

  for (let i = iPrimera + 1; i < lineas.length; i++) {
    const linea = lineas[i];
    if (!linea.trim()) continue;

    const c = celdas(linea, separador);
    const tema = dame(c, iTema);
    const numero = Number.parseInt(dame(c, iNo), 10);
    const anotar = (porque: string) => saltadas.push({ linea: i + 1, tema: tema || '(sin tema)', porque });

    // El guion largo es lo que la hoja pone en las celdas vacías de los reels.
    const vacio = (v: string) => !v || v === '—' || v === '-' || llano(v) === 'por definir';

    const tipo = dame(c, iTipo);
    if (iTipo !== -1 && !vacio(tipo) && llano(tipo) !== 'carrusel') {
      anotar(`es un ${tipo.toLowerCase()}, no un carrusel`);
      continue;
    }
    if (vacio(tema)) {
      anotar('sin tema todavía');
      continue;
    }
    if (iTipo !== -1 && vacio(tipo)) {
      anotar('sin tipo: si es carrusel, ponlo en la hoja');
      continue;
    }

    const iso = aISO(dame(c, iFecha));
    if (!iso) {
      anotar(pareceInvertida(dame(c, iFecha)) ?? `no entiendo la fecha "${dame(c, iFecha)}"`);
      continue;
    }
    const malDia = verificarDia(iso, dame(c, iDia));
    if (malDia) {
      anotar(malDia);
      continue;
    }

    const objetivo = llano(dame(c, iObjetivo));
    if (objetivo && !vacio(objetivo) && !OBJETIVOS.has(objetivo)) {
      anotar(`"${dame(c, iObjetivo)}" no es un objetivo: van guardar, compartir, comentar o agendar`);
      continue;
    }

    const nota = dame(c, iNota);
    filas.push({
      numero: Number.isNaN(numero) ? null : numero,
      fecha: iso,
      tema,
      pilar: vacio(dame(c, iPilar)) ? '' : dame(c, iPilar),
      objetivo: OBJETIVOS.has(objetivo) ? (objetivo as Fila['objetivo']) : null,
      nota: vacio(nota) ? '' : nota,
      linea: i + 1,
    });
  }

  return { filas, saltadas };
}

/**
 * Desde dónde arrancar.
 *
 * `desde` puede ser el número de la columna "No." o un trozo del tema —
 * `--desde 4` o `--desde colageno`, que es como uno se acuerda de verdad de
 * cuál era. Devuelve las filas de ahí en adelante, o `null` si no encuentra
 * ninguna: **arrancar la tanda entera porque no se reconoció el `--desde` sería
 * escribir veinte carruseles que nadie pidió.**
 */
export function desde(filas: Fila[], marca: string): Fila[] | null {
  const buscado = llano(marca);
  if (!buscado) return filas;

  const i = filas.findIndex(
    (f) => String(f.numero) === buscado || llano(f.tema).includes(buscado),
  );
  return i === -1 ? null : filas.slice(i);
}
