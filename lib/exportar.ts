import 'server-only';

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, type Browser } from 'playwright';
import { lienzo } from '@/plantillas/clinica/tokens';
import { remoto } from './almacen';
import { rutasDe } from './proyecto';

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
  proyecto: string;
  slug: string;
  /** Posiciones a exportar, empezando en 1. Por omisión, todas. */
  slides: number[];
  /** La URL donde está corriendo esta misma app. */
  base: string;
  /** 2 por omisión: 2160 × 2700. Con 1 sale al tamaño del lienzo. */
  escala?: number;
};

export type SlideExportado = { n: number; nombre: string; png: Buffer };

/**
 * El Chromium con el que se captura.
 *
 * En la computadora, el de Playwright. En Vercel no hay ninguno instalado y el
 * de Playwright no cabe en una función, así que se usa @sparticuz/chromium, que
 * está hecho para eso: viene comprimido y se descomprime en /tmp al arrancar.
 * Playwright lo maneja igual; solo cambia de dónde sale el ejecutable.
 */
async function abrirNavegador(): Promise<Browser> {
  if (process.env.VERCEL !== '1') return chromium.launch();
  const sparticuz = (await import('@sparticuz/chromium')).default;
  return chromium.launch({
    executablePath: await sparticuz.executablePath(),
    args: sparticuz.args,
    headless: true,
  });
}

/**
 * El despliegue va con la protección de Vercel, y el Chromium que captura
 * /render es un visitante más: sin esto, lo que fotografía es la pantalla de
 * iniciar sesión. «Protection Bypass for Automation» da un secreto que deja
 * pasar a quien lo manda; Vercel lo pone en `VERCEL_AUTOMATION_BYPASS_SECRET`.
 */
function cabecerasDeVercel(): Record<string, string> {
  const secreto = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  return secreto ? { 'x-vercel-protection-bypass': secreto } : {};
}

export async function exportarSlides({
  proyecto,
  slug,
  slides,
  base,
  escala = lienzo.escalaExport,
}: OpcionesExport): Promise<SlideExportado[]> {
  let navegador: Browser | undefined;

  try {
    navegador = await abrirNavegador();
    // deviceScaleFactor en el contexto, no `scale` en la captura: Instagram
    // recomprime, y entregarle el doble de píxeles conserva mucho mejor los
    // bordes de la tipografía.
    const ctx = await navegador.newContext({
      viewport: { width: lienzo.ancho, height: lienzo.alto },
      deviceScaleFactor: escala,
      extraHTTPHeaders: cabecerasDeVercel(),
    });
    const page = await ctx.newPage();
    const salidas: SlideExportado[] = [];

    // Se reutiliza la misma pestaña para todo el carrusel. Lanzar Chromium por
    // slide convierte siete segundos en cuarenta.
    for (const n of slides) {
      await page.goto(`${base}/${proyecto}/render/${slug}/${n}`, {
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
 * Deja también los PNG en salidas/<proyecto>/<slug>/. Es más cómodo abrir una carpeta que
 * descomprimir un ZIP, y sirve de respaldo si el navegador se come la descarga.
 */
export async function guardarEnDisco(
  proyecto: string,
  slug: string,
  archivos: SlideExportado[],
): Promise<string | null> {
  // En Vercel no hay disco donde dejarlos: el ZIP que se descarga es la copia.
  if (remoto) return null;
  const carpeta = join(rutasDe(proyecto).salidas, slug);
  await mkdir(carpeta, { recursive: true });
  await Promise.all(archivos.map((a) => writeFile(join(carpeta, a.nombre), a.png)));
  return carpeta;
}
