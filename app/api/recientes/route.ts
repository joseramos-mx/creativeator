import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Marca, validar } from '@/lib/schema';
import { avisoDeSoloLectura, soloLectura } from '@/lib/soloLectura';

/**
 * POST /api/recientes — `{ slug }` apunta un ícono como recién usado.
 *
 * En la práctica una cuenta médica rota sobre el mismo puñado: lupa,
 * estetoscopio, termómetro, jabón, sol, gota. Tenerlos a la mano ahorra la
 * búsqueda la mayoría de las veces.
 */
const CUANTOS = 12;

export async function POST(req: Request) {
  if (soloLectura) return avisoDeSoloLectura();

  try {
    const { slug } = await req.json();
    if (typeof slug !== 'string' || !slug) {
      return Response.json({ error: 'Falta el slug.' }, { status: 400 });
    }

    const ruta = join(process.cwd(), 'content', 'marca.json');
    const marca = validar(Marca, JSON.parse(await readFile(ruta, 'utf8')), 'content/marca.json');
    const recientes = [slug, ...marca.iconosRecientes.filter((s) => s !== slug)].slice(0, CUANTOS);

    await writeFile(ruta, `${JSON.stringify({ ...marca, iconosRecientes: recientes }, null, 2)}\n`, 'utf8');
    return Response.json({ recientes });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 400 });
  }
}
