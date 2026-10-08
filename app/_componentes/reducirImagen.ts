'use client';

/**
 * Bajar una imagen en el navegador antes de subirla.
 *
 * Una foto del teléfono pesa de 3 a 8 MB, y en Vercel una petición no puede
 * pasar de 4.5 MB: sin esto, subir la foto que mandó el doctor fallaría justo
 * desde donde más se usa. Del otro lado se baja igual a 1600 px, así que
 * mandarla a 2000 no pierde nada.
 *
 * Lo que ya es chico, o no se puede decodificar aquí (HEIC en un navegador que
 * no lo lee), se manda tal cual.
 */
const LADO = 2000;
const YA_CHICA = 1.5 * 1024 * 1024;

export async function reducirImagen(archivo: File): Promise<File> {
  if (!archivo.type.startsWith('image/') || archivo.type === 'image/gif' || archivo.size <= YA_CHICA) {
    return archivo;
  }
  try {
    const mapa = await createImageBitmap(archivo);
    const escala = Math.min(1, LADO / Math.max(mapa.width, mapa.height));
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.round(mapa.width * escala);
    lienzo.height = Math.round(mapa.height * escala);
    lienzo.getContext('2d')?.drawImage(mapa, 0, 0, lienzo.width, lienzo.height);
    // PNG si puede traer transparencia; JPEG para lo demás, que es lo que pesa.
    const tipo = archivo.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const blob = await new Promise<Blob | null>((r) => lienzo.toBlob(r, tipo, 0.9));
    if (!blob || blob.size >= archivo.size) return archivo;
    const nombre = tipo === 'image/jpeg' ? archivo.name.replace(/\.[^.]+$/, '.jpg') : archivo.name;
    return new File([blob], nombre, { type: tipo });
  } catch {
    return archivo;
  }
}

/** El tope de Vercel por petición, con aire para el resto del formulario. */
export const TOPE_SUBIDA = 4 * 1024 * 1024;
