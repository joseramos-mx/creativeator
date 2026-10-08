import { almacen, guardar } from '@/lib/almacen';
import { proyectoDe, proyectoInexistente, type ConProyecto } from '@/lib/peticion';
import { rutasDe } from '@/lib/proyecto';
import { Proyecto, validar } from '@/lib/schema';
import { avisoDeSoloLectura, soloLectura } from '@/lib/soloLectura';

/**
 * POST /api/<proyecto>/recientes — `{ slug }` apunta un ícono como recién usado.
 *
 * En la práctica una cuenta médica rota sobre el mismo puñado: lupa,
 * estetoscopio, termómetro, jabón, sol, gota. Tenerlos a la mano ahorra la
 * búsqueda la mayoría de las veces.
 */
const CUANTOS = 12;

export async function POST(req: Request, ctx: ConProyecto) {
  if (soloLectura) return avisoDeSoloLectura();
  const proyecto = await proyectoDe(ctx);
  if (!proyecto) return proyectoInexistente();

  try {
    const { slug } = await req.json();
    if (typeof slug !== 'string' || !slug) {
      return Response.json({ error: 'Falta el slug.' }, { status: 400 });
    }

    const ruta = rutasDe(proyecto).config;
    const crudo = JSON.parse((await almacen.leerTexto(ruta)) ?? '{}');
    const marca = validar(Proyecto, crudo, `proyectos/${proyecto}/proyecto.json`);
    const recientes = [slug, ...marca.iconosRecientes.filter((s) => s !== slug)].slice(0, CUANTOS);

    // Se escribe sobre lo que había en el archivo, no sobre lo validado: así un
    // valor por omisión del esquema no aparece escrito en proyecto.json por
    // haber usado un ícono.
    await guardar(
      ruta,
      `${JSON.stringify({ ...crudo, iconosRecientes: recientes }, null, 2)}\n`,
      `${proyecto}: ícono reciente`,
    );
    return Response.json({ recientes });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 400 });
  }
}
