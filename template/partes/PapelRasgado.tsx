/**
 * El papel rasgado con la pregunta gancho encima.
 *
 * El dibujo no se hace aquí: es un SVG generado una sola vez por
 * scripts/graficos.mjs, con una semilla por post para que dos carruseles
 * seguidos no lleven el mismo rasgado. Así el navegador no tiene que dibujar
 * nada antes de la captura.
 */
export function PapelRasgado({ src, pregunta }: { src: string; pregunta: string }) {
  return (
    <div className="papel">
      <img src={src} alt="" />
      <span>{pregunta}</span>
    </div>
  );
}
