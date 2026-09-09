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

  /**
   * `public/` no viaja en el paquete de las funciones: Vercel lo sirve como
   * estático, así que Next lo deja fuera a propósito. Los PNG de /descargas no
   * lo necesitan —se sirven así—, pero **el índice sí se lee desde el
   * servidor**, y sin él la página se queda con la lista vacía y dice que no
   * hay nada preparado aunque lo haya.
   *
   * Hoy el rastreador lo encuentra solo porque la ruta está escrita literal.
   * Esto lo hace explícito: si mañana esa ruta se arma de otra forma, el
   * despliegue no se rompe en silencio. Solo el JSON, no la carpeta: las
   * imágenes pesan y no hacen falta ahí.
   */
  outputFileTracingIncludes: {
    '/descargas': ['./public/descargas/indice.json'],
  },
};

export default config;
