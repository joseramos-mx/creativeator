import { archivoDe, bancoDe } from '@/lib/bancos';
import { descargarFoto } from '@/lib/bancos/descargar';
import { proyectoDe, proyectoInexistente, type ConProyecto } from '@/lib/peticion';
import { Credito, validar } from '@/lib/schema';

/**
 * POST /api/<proyecto>/fotos/elegir — `{ slug, candidato, archivo? }` → la foto en disco y su crédito.
 *
 * **La descarga y el crédito son un solo movimiento.** Es lo que hace que esta
 * fase valga la pena: hoy el crédito se llena a mano y por eso está vacío en
 * todo el proyecto. Aquí no hay forma de acabar con el archivo puesto y la
 * procedencia sin escribir, porque si el candidato no trae crédito la petición
 * se rechaza antes de bajar un solo byte.
 *
 * Se guarda el archivo, no el enlace: los enlaces caducan y el PNG sale con un
 * hueco meses después de publicado.
 */


export async function POST(req: Request, ctx: ConProyecto) {
  const proyecto = await proyectoDe(ctx);
  if (!proyecto) return proyectoInexistente();
  try {
    const { slug, candidato, archivo } = await req.json();

    if (typeof slug !== 'string' || !/^[a-z0-9-]+$/.test(slug)) {
      return Response.json({ error: 'Slug inválido.' }, { status: 400 });
    }
    if (!candidato?.descarga || typeof candidato.descarga !== 'string') {
      return Response.json({ error: 'Ese candidato no dice de dónde bajarse.' }, { status: 400 });
    }

    // Antes de bajar nada. Una foto que no se puede acreditar no se usa, y
    // rechazarla aquí es más honesto que bajarla y dejar el campo vacío.
    if (!candidato.credito) {
      return Response.json(
        { error: 'Ese candidato no trae fuente ni licencia, así que no se puede usar.' },
        { status: 400 },
      );
    }
    const credito = validar(Credito, candidato.credito, 'el crédito del banco');

    const ruta = await descargarFoto(
      proyecto,
      // `archivo` es el archivo clínico (Commons); sin él, el banco de ambiente.
      archivo === true ? archivoDe(slug) : bancoDe(slug),
      candidato,
      slug,
    );
    return Response.json({ ruta, credito });
  } catch (e) {
    const error = e instanceof Error ? e.message : 'No se pudo traer la foto.';
    return Response.json({ error }, { status: 502 });
  }
}

