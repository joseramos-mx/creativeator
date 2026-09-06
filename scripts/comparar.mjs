/**
 * scripts/comparar.mjs — `node scripts/comparar.mjs [puerto]`
 *
 * Captura los slides del banco de pruebas a tamaño real y los deja en
 * salidas/comparar/. Sirve para lo que la fase 1 tiene que resolver: ver si la
 * plantilla se parece a los posts publicados, sin depender de mirarlos al ojo
 * en una pantalla de 34 %.
 *
 * Después de correrlo, `python scripts/medir.py` compara cada render contra su
 * captura de public/referencia/ y dice en qué renglón se corrió el diseño y
 * cuántos píxeles.
 */

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const puerto = process.argv[2] ?? '3000';
const base = `http://localhost:${puerto}`;
const destino = join(process.cwd(), 'salidas', 'comparar');
mkdirSync(destino, { recursive: true });

const navegador = await chromium.launch();
const ctx = await navegador.newContext({
  viewport: { width: 1400, height: 1000 },
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();

console.log(`Abriendo ${base}/plantilla …`);
await page.goto(`${base}/plantilla`, { waitUntil: 'networkidle', timeout: 120_000 });

// El banco pinta a 34 % para que quepan; para comparar hace falta 1:1.
await page.getByRole('button', { name: '100%' }).click();

// La barra pegajosa y las etiquetas son cromo de la app: si se quedan, salen
// encima del slide y la comparación mide basura.
await page.addStyleTag({
  content: '.cromo,.etiqueta,nextjs-portal{display:none!important}'
    + '.marco{border-radius:0!important;box-shadow:none!important;background:none!important}',
});
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400);

const slides = page.locator('.mazo').first().locator('.slide');
const total = await slides.count();

for (let i = 0; i < total; i++) {
  const nombre = `${String(i).padStart(2, '0')}.png`;
  await slides.nth(i).screenshot({ path: join(destino, nombre) });
  console.log(`  ${nombre}`);
}

await navegador.close();
console.log(`\n${total} slides en salidas/comparar/`);
