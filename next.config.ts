import type { NextConfig } from 'next';

/**
 * El proyecto corre local (`npm run dev`). No hace falta más configuración:
 * el diseño vive en CSS y componentes, y el contenido en archivos.
 */
const config: NextConfig = {
  /**
   * El indicador de desarrollo de Next se pinta encima del slide, en la esquina
   * de abajo a la izquierda. Estorba para comparar contra la referencia y sale
   * en las capturas, así que va apagado.
   */
  devIndicators: false,

  /**
   * Playwright abre un navegador de verdad desde el route handler: es un
   * paquete de Node, no de bundle. Empaquetarlo rompe la ruta de exportación.
   */
  serverExternalPackages: ['playwright'],
};

export default config;
