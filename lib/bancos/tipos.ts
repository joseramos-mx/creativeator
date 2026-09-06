import type { TCredito } from '../schema';

/**
 * lib/bancos/tipos.ts — la interfaz de un banco de imágenes.
 *
 * El proveedor va detrás de esto por la misma razón que los íconos: para poder
 * cambiarlo sin tocar el editor, y para que las pruebas tengan un banco de
 * laboratorio que no sale a la red.
 *
 * ── Por qué Unsplash no está aquí ───────────────────────────────────────────
 * Sus Términos de la API obligan a *hotlinkear* las URLs que devuelve
 * («All API uses must use the hotlinked image URLs returned by the API») y a
 * enlazar el perfil del fotógrafo cada vez que se muestra la imagen. Este
 * proyecto hornea la foto dentro de un PNG que se sube a Instagram: ni hay
 * enlace posible ni hay hotlink. La restricción es del canal, no de la foto —
 * bajarla a mano del sitio sí da uso comercial libre—, así que Unsplash entra
 * por el editor como cualquier archivo, con el crédito escrito a mano. Está
 * documentado en el README.
 */

/** Una foto ofrecida por un banco. Todavía no se ha descargado nada. */
export type Candidato = {
  /** El id dentro del proveedor. Con `proveedor`, identifica la foto. */
  id: string;
  proveedor: string;
  /** El texto alternativo del banco. Es sobre lo que corre el descarte. */
  descripcion: string;
  ancho: number;
  alto: number;
  /** Miniatura, solo para la rejilla del editor. Nunca se guarda. */
  vista: string;
  /** De dónde se baja el archivo cuando se elige. */
  descarga: string;
  /**
   * El crédito, ya armado.
   *
   * `null` quiere decir que el adaptador **no pudo** armarlo: le faltaba el
   * autor, el enlace, o la respuesta traía una señal que no reconoce. Un
   * candidato sin crédito no se ofrece. No se rellena con nada: si no se puede
   * decir de dónde salió, no se usa.
   */
  credito: TCredito | null;
};

/** Lo que decide qué se busca y qué no puede salir. Ver lib/criterios.ts. */
export type Criterios = { query: string; criterios: string; descartar: string[] };

export type Banco = {
  nombre: string;
  /** Si falta la llave, el editor lo dice en vez de fallar al buscar. */
  disponible: () => boolean;
  /**
   * Criterios fijos, sin pasar por el modelo.
   *
   * Solo lo trae el banco de laboratorio, y es lo que permite que las pruebas
   * recorran las dos etapas —la que lee el slide y la que consulta el banco—
   * sin gastar una llamada. En el banco de verdad no existe: ahí los criterios
   * los escribe Claude leyendo el slide.
   */
  criterios?: () => Criterios;
  buscar: (query: string, cuantas: number) => Promise<Candidato[]>;
  /** Los bytes de la foto elegida. Se separa de `buscar` para poder fingirla. */
  bajar: (candidato: Candidato) => Promise<Buffer>;
};
