'use client';

/**
 * Generar un ícono desde el editor y meterlo en la librería compartida.
 *
 * Son las mismas dos peticiones que ya existían —/api/icono genera, sin
 * guardar; /api/icono/guardar lo mete en la librería— y van separadas a
 * propósito: en Vercel cada petición tiene su propio límite de tiempo, así que
 * diez íconos seguidos no se cortan a la mitad como dentro de la redacción.
 */

export type Variante = { png: string; fondo: number; aviso?: string };

async function pedir(ruta: string, cuerpo: unknown) {
  const r = await fetch(ruta, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(json.error ?? `La app respondió ${r.status}.`);
  return json;
}

/** Variantes para elegir. No guarda nada. */
export async function variantesDe(concepto: string, n: number): Promise<{ modelo: string; variantes: Variante[] }> {
  return pedir('/api/icono', { concepto, n });
}

/** La variante elegida entra en la librería. Devuelve su slug. */
export async function guardarVariante(png: string, concepto: string, modelo: string): Promise<string> {
  const guardado = await pedir('/api/icono/guardar', { png, nombre: concepto, concepto, modelo });
  return guardado.slug;
}

/** Sin elegir: una variante, directo a la librería. */
export async function generarYGuardar(concepto: string): Promise<string> {
  const { modelo, variantes } = await variantesDe(concepto, 1);
  if (!variantes[0]) throw new Error('Gemini no devolvió imagen.');
  return guardarVariante(variantes[0].png, concepto, modelo);
}
