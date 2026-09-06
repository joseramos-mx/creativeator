import type { Banco, Candidato } from './tipos';

/**
 * lib/bancos/commons.ts — el archivo clínico de Wikimedia Commons.
 *
 * Aquí la licencia **sí** viene por imagen, al revés que en Pexels. Commons
 * aloja archivos bajo licencias muy distintas —dominio público, CC0, CC BY,
 * CC BY-SA, y también cosas que no se pueden usar— así que la constante que
 * vale para un banco de licencia uniforme aquí sería una mentira. Se lee la que
 * traiga cada archivo y se compara contra una lista blanca.
 *
 * ── Por qué DermNet no está ─────────────────────────────────────────────────
 * Sus imágenes son CC BY-NC-ND 3.0: **NC** prohíbe el uso comercial y la cuenta
 * de una consulta privada lo es, y **ND** prohíbe las obras derivadas, que es
 * exactamente lo que hace esta plantilla al recortar la foto dentro del slide.
 * Para uso comercial DermNet vende una licencia aparte. Dos de dos en contra,
 * así que queda fuera y no como opción configurable.
 *
 * ── Por qué CDC PHIL tampoco ────────────────────────────────────────────────
 * Sus imágenes sí sirven —la mayoría son de dominio público— pero **no tiene
 * API**, y su propio FAQ dice "la mayoría", no "todas": hay imágenes con
 * copyright de terceros mezcladas. Sin interfaz que devuelva el estado de cada
 * una, un adaptador automático tendría que suponer que todas son libres, que es
 * justo el fallo en abierto que este proyecto no hace. Va por la vía manual,
 * documentada en el README, igual que Unsplash.
 */

const API = 'https://commons.wikimedia.org/w/api.php';

export const FUENTE = 'Wikimedia Commons';

/**
 * Solo estas licencias pasan. Todo lo demás —NC, ND, "fair use", una licencia
 * que este adaptador no conozca, o ninguna— deja el candidato sin crédito y sin
 * crédito no se ofrece.
 *
 * CC BY-SA pasa, pero arrastra una obligación que el médico tiene que ver antes
 * de firmar: compartir igual. Por eso no se acepta en silencio, se acepta con
 * un aviso.
 */
const PERMITIDAS = [
  /^pd(-|$)/, // dominio público, en sus muchas variantes
  /^cc0(-|$)/,
  /^cc-by-\d/,
  /^cc-by-sa-\d/,
];

const CON_OBLIGACION: [RegExp, string][] = [
  [/^cc-by-sa-/, 'CC BY-SA obliga a compartir la obra derivada bajo la misma licencia.'],
  [/^cc-by-\d/, 'CC BY obliga a acreditar al autor allí donde se publique.'],
];

export const commons: Banco = {
  nombre: 'commons',
  clinico: true,

  disponible: () => true, // no lleva llave

  async buscar(query, cuantas) {
    const url = new URL(API);
    for (const [k, v] of Object.entries({
      action: 'query',
      format: 'json',
      formatversion: '2',
      generator: 'search',
      gsrsearch: query,
      gsrnamespace: '6', // solo archivos
      gsrlimit: String(Math.min(cuantas, 30)),
      prop: 'imageinfo',
      iiprop: 'url|extmetadata|size|mime',
      iiurlwidth: '320',
    })) {
      url.searchParams.set(k, v);
    }

    const r = await fetch(url, {
      // Commons pide identificarse. Un User-Agent genérico se bloquea.
      headers: { 'User-Agent': 'carruseles-alergo-derma/0.1 (proyecto local)' },
    });
    if (!r.ok) throw new Error(`Wikimedia Commons respondió ${r.status}.`);

    const cuerpo = await r.json();
    const paginas = cuerpo?.query?.pages;
    if (!Array.isArray(paginas)) return [];

    return paginas.map(aCandidato).filter((c) => c.descarga);
  },

  async bajar(candidato) {
    const r = await fetch(candidato.descarga, {
      headers: { 'User-Agent': 'carruseles-alergo-derma/0.1 (proyecto local)' },
    });
    if (!r.ok) throw new Error(`No se pudo bajar la imagen (${r.status}).`);
    return Buffer.from(await r.arrayBuffer());
  },
};

/**
 * De una página de Commons a un candidato.
 *
 * Se exporta por lo mismo que el de Pexels: es donde vive la decisión de si la
 * imagen se puede usar, así que es la que el banco de pruebas tiene que poder
 * maltratar con licencias inventadas sin salir a la red.
 */
export function aCandidato(pagina: unknown): Candidato {
  const p = (pagina ?? {}) as Record<string, unknown>;
  const ii = (Array.isArray(p.imageinfo) ? p.imageinfo[0] : {}) as Record<string, unknown>;
  const em = (ii.extmetadata ?? {}) as Record<string, { value?: unknown }>;

  const meta = (k: string) => limpiar(String(em[k]?.value ?? ''));
  const licencia = meta('License').toLowerCase();
  const restricciones = meta('Restrictions');
  const autor = meta('Artist');
  const pagWeb = String(ii.descriptionurl ?? '');
  const archivo = String(ii.url ?? '');

  const avisos: string[] = [];
  for (const [patron, texto] of CON_OBLIGACION) {
    if (patron.test(licencia)) avisos.push(texto);
  }
  if (meta('AttributionRequired').toLowerCase() === 'true' && !autor) {
    avisos.push('La licencia exige atribución y el archivo no dice quién es el autor.');
  }

  // Fallo en cerrado. Cualquiera de estos deja la imagen sin crédito, y sin
  // crédito no se ofrece.
  const permitida = PERMITIDAS.some((re) => re.test(licencia));
  const restringida = restricciones.length > 0;
  const sinAtribuir = meta('AttributionRequired').toLowerCase() === 'true' && !autor;
  const incompleto = !archivo || !pagWeb || !licencia;

  return {
    id: String(p.title ?? p.pageid ?? ''),
    proveedor: FUENTE,
    descripcion: meta('ImageDescription') || String(p.title ?? ''),
    ancho: Number(ii.width) || 0,
    alto: Number(ii.height) || 0,
    vista: String(ii.thumburl ?? archivo),
    descarga: archivo,
    avisos: restringida ? [...avisos, `Commons marca restricciones: ${restricciones}.`] : avisos,
    credito:
      !permitida || restringida || sinAtribuir || incompleto
        ? null
        : {
            fuente: FUENTE,
            licencia: meta('LicenseShortName') || licencia,
            ...(meta('LicenseUrl') ? { licenciaUrl: meta('LicenseUrl') } : {}),
            ...(autor ? { autor } : {}),
            url: pagWeb,
          },
  };
}

/** Commons devuelve HTML en varios campos. Al JSON del post va texto. */
function limpiar(s: string) {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
