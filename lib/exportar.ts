import 'server-only';

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, type Browser } from 'playwright';
import { lienzo } from '@/template/tokens';

/**
 * lib/exportar.ts — de la ruta /render a los PNG.
 *
 * Playwright abre un Chromium de verdad y toma una captura de verdad. Las
 * librerías del lado del cliente (html2canvas y compañía) reimplementan el
 * motor de render en JavaScript y se rompen con clip-path, con degradados, con
 * background-size: cover y con las fuentes que todavía no cargaron. Sirven para
 * una vista previa rápida; no para el entregable.
 *
 * El costo es que hace falta un proceso de Node, así que la app corre local.
 * Para el flujo de una persona eso no es una limitación, es una simplificación.
 */

export type OpcionesExport = {
  slug: string;
  /** Posiciones a exportar, empezando en 1. Por omisión, todas. */
  slides: number[];
  /** La URL donde está corriendo esta misma app. */
  base: string;
  /** 2 por omisión: 2160 × 2700. Con 1 sale al tamaño del lienzo. */
  escala?: number;
};

export type SlideExportado = { n: number; nombre: string; png: Buffer };

export async function exportarSlides({
  slug,
  slides,
  base,
  escala = lienzo.escalaExport,
}: OpcionesExport): Promise<SlideExportado[]> {
  let navegador: Browser | undefined;

  try {
    navegador = await chromium.launch();
    // deviceScaleFactor en el contexto, no `scale` en la captura: Instagram
    // recomprime, y entregarle el doble de píxeles conserva mucho mejor los
    // bordes de la tipografía.
    const ctx = await navegador.newContext({
      viewport: { width: lienzo.ancho, height: lienzo.alto },
      deviceScaleFactor: escala,
    });
    const page = await ctx.newPage();
    const salidas: SlideExportado[] = [];

    // Se reutiliza la misma pestaña para todo el carrusel. Lanzar Chromium por
    // slide convierte siete segundos en cuarenta.
    for (const n of slides) {
      await page.goto(`${base}/render/${slug}/${n}`, {
        waitUntil: 'networkidle',
        timeout: 120_000,
      });
      // networkidle cubre las imágenes; data-listo cubre las fuentes y el
      // ajuste de texto. Hacen falta los dos.
      await page.waitForSelector('body[data-listo="1"]', { timeout: 60_000 });

      // Se captura el elemento y no la página, para que el resultado mida
      // exactamente el lienzo aunque algo desborde por un píxel.
      const png = await page.locator('#slide').screenshot({ type: 'png' });
      salidas.push({ n, nombre: `${String(n).padStart(2, '0')}.png`, png });
    }

    await ctx.close();
    return salidas;
  } finally {
    await navegador?.close();
  }
}

/**
 * Deja también los PNG en salidas/<slug>/. Es más cómodo abrir una carpeta que
 * descomprimir un ZIP, y sirve de respaldo si el navegador se come la descarga.
 */
export async function guardarEnDisco(slug: string, archivos: SlideExportado[]) {
  const carpeta = join(process.cwd(), 'salidas', slug);
  await mkdir(carpeta, { recursive: true });
  await Promise.all(archivos.map((a) => writeFile(join(carpeta, a.nombre), a.png)));
  return carpeta;
}
