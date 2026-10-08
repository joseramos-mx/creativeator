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
  serverExternalPackages: ['playwright', '@sparticuz/chromium'],

  /**
   * `public/` no viaja en el paquete de las funciones: Vercel lo sirve como
   * estático, así que Next lo deja fuera a propósito. Los PNG de /descargas no
   * lo necesitan —se sirven así—, pero **el índice sí se lee desde el
   * servidor**, y sin él la página se queda con la lista vacía y dice que no
   * hay nada preparado aunque lo haya.
   *
   * Las rutas se arman en lib/proyecto.ts a partir del id del proyecto, así
   * que el rastreador no puede adivinarlas: aquí se dice qué hace falta.
   * Del índice, solo el JSON y no la carpeta: las imágenes pesan y no hacen
   * falta ahí. De proyectos/, la configuración y los posts, que son lo que
   * leen las páginas del despliegue —la lista, el editor en modo lectura y las
   * descargas—.
   */
  outputFileTracingIncludes: {
    '/': ['./proyectos/*/proyecto.json', './proyectos/*/posts/*.json'],
    '/[proyecto]': ['./proyectos/*/proyecto.json', './proyectos/*/posts/*.json'],
    '/[proyecto]/post/[slug]': ['./proyectos/*/proyecto.json', './proyectos/*/posts/*.json'],
    // El Chromium de Vercel viene comprimido en bin/ y se lee de ahí al
    // arrancar: el rastreador no lo ve porque nadie lo importa.
    '/api/[proyecto]/exportar': ['./node_modules/@sparticuz/chromium/bin/**'],
    '/api/[proyecto]/celular': ['./node_modules/@sparticuz/chromium/bin/**'],
    '/[proyecto]/descargas': [
      './public/proyectos/*/descargas/indice.json',
      './proyectos/*/proyecto.json',
      './proyectos/*/posts/*.json',
    ],
  },
};

export default config;
