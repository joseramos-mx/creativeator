import { readFile, writeFile } from 'node:fs/promises';
import { aSlug } from '@/lib/brief';
import { leerCalendario, type Fila } from '@/lib/calendario';
import { yaEscrito } from '@/lib/mes';
import { proyectoDe, proyectoInexistente, type ConProyecto } from '@/lib/peticion';
import { listarPosts } from '@/lib/posts';
import { rutasDe } from '@/lib/proyecto';
import { avisoDeSoloLectura, soloLectura } from '@/lib/soloLectura';

/**
 * /api/<proyecto>/calendario — la hoja editorial, leída y contrastada con lo ya escrito.
 *
 *  · `GET`  → lo que hay guardado en proyectos/<id>/calendario.tsv, si lo hay.
 *  · `POST` → `{ texto }` lo reemplaza y devuelve lo mismo.
 *
 * **No redacta nada.** Solo dice qué hay en la hoja y cuáles de esas filas
 * faltan por escribir. Redactar va fila por fila desde el navegador, contra
 * `/api/redactar`, por la misma razón por la que la tanda es un script: doce
 * carruseles son media hora y una ruta se corta a los cinco minutos.
 *
 * El calendario se guarda en el mismo archivo que lee `npm run mes`. Es a
 * propósito: subirlo por el panel y correr la tanda por la terminal tienen que
 * ser dos formas de usar **el mismo** calendario, no dos calendarios.
 */

export async function GET(_req: Request, ctx: ConProyecto) {
  const proyecto = await proyectoDe(ctx);
  if (!proyecto) return proyectoInexistente();
  const rutas = rutasDe(proyecto);

  // `calendario.csv` es el nombre viejo, por si alguien dejó ahí su
  // exportación. Solo se lee.
  const texto =
    (await readFile(rutas.calendario, 'utf8').catch(() => null)) ??
    (await readFile(rutas.calendarioAlterno, 'utf8').catch(() => null));

  if (texto === null) return Response.json({ hay: false, filas: [], saltadas: [] });

  try {
    return Response.json({ hay: true, ...(await contrastar(proyecto, texto)) });
  } catch (e) {
    // Un archivo guardado que ya no se entiende no debe dejar la página en
    // blanco: se dice el problema y se ofrece subir otro.
    return Response.json({
      hay: true,
      filas: [],
      saltadas: [],
      error: e instanceof Error ? e.message : 'No se pudo leer el calendario guardado.',
    });
  }
}

export async function POST(req: Request, ctx: ConProyecto) {
  if (soloLectura) return avisoDeSoloLectura();
  const proyecto = await proyectoDe(ctx);
  if (!proyecto) return proyectoInexistente();

  let texto: string;
  try {
    const cuerpo = await req.json();
    texto = typeof cuerpo.texto === 'string' ? cuerpo.texto : '';
  } catch {
    return Response.json({ error: 'No se entendió la petición.' }, { status: 400 });
  }
  if (!texto.trim()) {
    return Response.json({ error: 'El archivo está vacío.' }, { status: 400 });
  }

  let leido: Awaited<ReturnType<typeof contrastar>>;
  try {
    // Se lee **antes** de guardar. Si el archivo que suben no se entiende, el
    // calendario que ya había sigue en su sitio: perderlo por una exportación
    // mal hecha sería el peor resultado posible de subir un archivo.
    leido = await contrastar(proyecto, texto);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'No se pudo leer el calendario.' },
      { status: 400 },
    );
  }

  if (leido.filas.length === 0) {
    return Response.json(
      {
        error:
          'No hay ni un carrusel en ese archivo. ' +
          leido.saltadas.map((s) => `Línea ${s.linea}: ${s.porque}.`).slice(0, 4).join(' '),
      },
      { status: 400 },
    );
  }

  await writeFile(rutasDe(proyecto).calendario, texto.endsWith('\n') ? texto : `${texto}\n`, 'utf8');
  return Response.json({ hay: true, ...leido });
}

/** Una fila de la hoja, ya sabiendo si su carrusel existe. */
type FilaContrastada = Fila & { slug: string; hecho: string | null };

async function contrastar(proyecto: string, texto: string) {
  const { filas, saltadas } = leerCalendario(texto);

  // Los de laboratorio entran también. Excluirlos dejaría que un tema cuyo slug
  // cayera en `laboratorio-edicion` lo sobrescribiera, y sus temas —"Laboratorio
  // · paletas"— no pueden parecerse a uno de la hoja: entrar no cuesta nada.
  const escritos = (await listarPosts(proyecto)).map((p) => ({ slug: p.slug, tema: p.tema }));

  const contrastadas: FilaContrastada[] = filas.map((f) => {
    const slug = aSlug(f.tema);
    return { ...f, slug, hecho: yaEscrito(f.tema, slug, escritos) };
  });

  return { filas: contrastadas, saltadas };
}
