/**
 * La palomita verde de las listas.
 *
 * Se dibuja por código en vez de usar el emoji ✅ porque el emoji cambia según
 * el sistema y en la captura sale distinto en cada máquina.
 */
export function Palomita({ src }: { src: string }) {
  return <img src={src} alt="" />;
}
