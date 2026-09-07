import type { Banco, Candidato } from './tipos';

/**
 * lib/bancos/pexels.ts — el adaptador de Pexels.
 *
 * La Licencia de Pexels permite descargar, modificar y usar comercialmente, y
 * no exige atribución. Sus directrices de API sí piden un enlace visible a
 * Pexels y crédito al fotógrafo «cuando se pueda»: las dos cosas viven en el
 * editor, que es donde la app enseña las fotos, y no dentro del PNG.
 *
 * ── El campo que la API no devuelve ─────────────────────────────────────────
 * Pexels no manda licencia por imagen. No es un descuido suyo: todo lo que
 * sirve está bajo la misma licencia, así que no la repite en cada objeto. Por
 * eso `licencia` sale de aquí como constante, y eso **no** es el valor de
 * relleno que el proyecto prohíbe: es un hecho sobre de dónde vino el archivo,
 * tan comprobable como el nombre del autor, y va con el enlace al texto de la
 * licencia para que no haya que creérselo.
 *
 * Lo que convierte esa constante en una afirmación honesta es que se falla en
 * cerrado: en cuanto la respuesta trae algo que este adaptador no reconoce
 * —una foto sin autor, sin enlace, o con un campo que huele a otro nivel de
 * licencia— no se arma crédito y la foto no se ofrece. Si algún día Pexels
 * añade un nivel de pago, esto deja de ofrecer esas fotos en vez de mentir
 * sobre ellas.
 */

const API = 'https://api.pexels.com/v1/search';

export const FUENTE = 'Pexels';
export const LICENCIA = 'Pexels License';
export const LICENCIA_URL = 'https://www.pexels.com/license/';

/**
 * Campos que, de aparecer, significan que esta foto puede no estar bajo la
 * licencia general. Hoy Pexels no manda ninguno; si algún día manda alguno,
 * esto lo trata como desconocido y no como gratuito.
 */
const SEÑALES_DE_OTRO_NIVEL = ['license', 'premium', 'plus', 'sponsored', 'paid', 'pro'];

/** Lo que este adaptador sabe leer. Cualquier otra cosa se ignora sin peligro. */
const CONOCIDOS = new Set([
  'id', 'width', 'height', 'url', 'photographer', 'photographer_url',
  'photographer_id', 'avg_color', 'src', 'alt', 'liked',
]);

export const pexels: Banco = {
  nombre: 'pexels',

  disponible: () => Boolean(process.env.PEXELS_API_KEY),

  async buscar(query, cuantas, orientacion = 'landscape') {
    const llave = process.env.PEXELS_API_KEY;
    if (!llave) throw new Error('Falta PEXELS_API_KEY en .env.local.');

    const url = new URL(API);
    url.searchParams.set('query', query);
    url.searchParams.set('per_page', String(Math.min(cuantas, 40)));
    // La forma del hueco donde va a caer. Estaba fija en vertical, y como la
    // caja de los slides de contenido es apaisada, cada foto perdía dos tercios
    // en el recorte. Ver lib/bancos/encuadre.ts.
    url.searchParams.set('orientation', orientacion);

    const r = await fetch(url, { headers: { Authorization: llave } });
    if (r.status === 429) {
      throw new Error('Pexels está limitando las llamadas (200 por hora). Espera un rato.');
    }
    if (!r.ok) throw new Error(`Pexels respondió ${r.status}.`);

    const cuerpo = await r.json();
    if (!Array.isArray(cuerpo?.photos)) throw new Error('Pexels devolvió algo que no se entiende.');

    return cuerpo.photos.map(aCandidato);
  },

  async bajar(candidato) {
    const r = await fetch(candidato.descarga);
    if (!r.ok) throw new Error(`No se pudo bajar la foto (${r.status}).`);
    return Buffer.from(await r.arrayBuffer());
  },
};

/**
 * De un objeto de Pexels a un candidato.
 *
 * Se exporta para que el banco de pruebas lo corra contra las muestras
 * guardadas y contra copias mutadas a mano, sin gastar llamadas. Es la función
 * donde vive la decisión de si una foto se puede acreditar o no, así que es la
 * que hay que poder maltratar.
 */
export function aCandidato(foto: unknown): Candidato {
  const f = (foto ?? {}) as Record<string, unknown>;
  const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const src = (f.src ?? {}) as Record<string, unknown>;

  const id = f.id === undefined || f.id === null ? '' : String(f.id);
  const autor = texto(f.photographer);
  const pagina = texto(f.url);
  const grande = texto(src.large2x) || texto(src.original) || texto(src.large);
  const vista = texto(src.medium) || texto(src.small) || texto(src.tiny) || grande;

  // Fallo en cerrado, tres motivos. Cualquiera deja la foto sin crédito, y sin
  // crédito no se ofrece: lo que no se puede acreditar no se usa.
  const desconocido = Object.keys(f).some(
    (k) => !CONOCIDOS.has(k) && SEÑALES_DE_OTRO_NIVEL.some((s) => k.toLowerCase().includes(s)),
  );
  const incompleto = !autor || !pagina || !grande || !id;

  return {
    id,
    proveedor: FUENTE,
    descripcion: texto(f.alt),
    ancho: Number(f.width) || 0,
    alto: Number(f.height) || 0,
    vista,
    descarga: grande,
    credito:
      desconocido || incompleto
        ? null
        : {
            fuente: FUENTE,
            licencia: LICENCIA,
            licenciaUrl: LICENCIA_URL,
            autor,
            url: pagina,
          },
  };
}
