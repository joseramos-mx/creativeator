import { generar, MODELO } from '@/lib/iconos/gemini';

/**
 * POST /api/icono — `{ concepto, n }` → variantes de un ícono generado.
 *
 * **No guarda nada.** Devuelve los PNG en base64 para que el editor los enseñe
 * y alguien elija; guardar es otra petición. La primera salida rara vez es la
 * buena, y pedir tres de una vez cuesta lo mismo que pedir una tres veces pero
 * sin la espera entre intentos.
 *
 * Y nunca se genera al renderizar. El ícono se resuelve en el editor y queda en
 * disco: si /render dependiera de una llamada externa, la exportación del mes
 * tardaría minutos y fallaría a la mitad.
 */

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const { concepto, n } = await req.json();
    if (typeof concepto !== 'string' || concepto.trim().length < 3) {
      return Response.json({ error: 'Escribe el concepto del ícono.' }, { status: 400 });
    }

    const cuantos = Math.min(Math.max(Number(n) || 3, 1), 4);
    const variantes = await generar(concepto.trim(), cuantos);

    return Response.json({
      concepto: concepto.trim(),
      modelo: MODELO,
      variantes: variantes.map((v) => ({
        png: v.png.toString('base64'),
        fondo: Number(v.fondo.toFixed(3)),
        ...(v.aviso ? { aviso: v.aviso } : {}),
      })),
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : 'No se pudo generar el ícono.';
    return Response.json({ error }, { status: 502 });
  }
}
