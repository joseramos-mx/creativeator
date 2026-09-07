import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { aSlug } from '@/lib/brief';
import { redactar, type OpcionesRedaccion } from '@/lib/redactar';
import { Post, validar } from '@/lib/schema';

/**
 * POST /api/redactar — `{ tema, slug?, usadas?, editorial? }` → el borrador.
 *
 * **No guarda nada**, igual que /api/importar y por la misma razón: lo que
 * devuelve el modelo se enseña antes de reemplazar el contenido del editor.
 * Aquí pesa más todavía, porque una llamada cuesta y porque el paso de edición
 * entre redactar y exportar no es opcional: sale como `borrador` y la cola de
 * afirmaciones decide si algún día puede ser otra cosa.
 *
 * Lo único que sí toca el disco es la descarga de las fotos de ambiente, que se
 * ponen solas en `public/media/<slug>/`. Son archivos nuevos en una carpeta
 * nueva: si el borrador se descarta, sobra una carpeta y nada más.
 */

export const maxDuration = 300;
export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: 'Falta ANTHROPIC_API_KEY en .env.local.' },
      { status: 500 },
    );
  }

  let tema: string;
  let slug: string;
  // Las fotos ya gastadas por la tanda del mes, para no repetir imagen entre
  // carruseles. El panel no la manda y entonces va vacía. Ver lib/redactar.ts.
  let usadas: Set<string>;
  let editorial: OpcionesRedaccion['editorial'];
  try {
    const cuerpo = await req.json();
    tema = typeof cuerpo.tema === 'string' ? cuerpo.tema.trim() : '';
    if (tema.length < 4) {
      return Response.json({ error: 'Escribe el tema del carrusel.' }, { status: 400 });
    }
    slug = typeof cuerpo.slug === 'string' && cuerpo.slug ? aSlug(cuerpo.slug) : aSlug(tema);
    usadas = new Set(Array.isArray(cuerpo.usadas) ? cuerpo.usadas.filter(esTexto) : []);
    // La fila del calendario, si la tanda la mandó. Se pasa tal cual: quien
    // decide si un campo vale es `lib/redactar.ts`, que es quien lo impone.
    editorial = cuerpo.editorial && typeof cuerpo.editorial === 'object' ? cuerpo.editorial : undefined;
  } catch {
    return Response.json({ error: 'No se entendió la petición.' }, { status: 400 });
  }

  try {
    const { post, porQuePaleta, avisos, uso } = await redactar(tema, slug, { usadas, editorial });
    // Se valida con el esquema de lectura, no con el del guardado: esto es un
    // borrador y todavía no ha pasado por la cola, así que exigirle la barrera
    // aquí sería rechazar exactamente lo que se acaba de pedir.
    const limpio = validar(Post, post, 'lo que redactó el modelo');

    // Avisar, no bloquear: el slug ya ocupado se resuelve cambiándolo en el
    // editor, y enterarse ahora es mejor que sobrescribir al guardar.
    const todos = [...avisos];
    if (await existe(limpio.slug)) {
      todos.push(`Ya hay un carrusel con el slug "${limpio.slug}". Cámbialo antes de guardar.`);
    }

    // `usadas` sale con las que acaba de gastar: quien encadena carruseles se
    // la vuelve a pasar en la siguiente petición y así la tanda no repite foto.
    return Response.json({ post: limpio, porQuePaleta, avisos: todos, uso, usadas: [...usadas] });
  } catch (e) {
    const error = e instanceof Error ? e.message : 'No se pudo redactar.';
    // 502 y no 400: lo que falló fue la llamada al modelo, no lo que se pidió.
    return Response.json({ error }, { status: 502 });
  }
}

const esTexto = (v: unknown): v is string => typeof v === 'string';

async function existe(slug: string) {
  try {
    await access(join(process.cwd(), 'content', 'posts', `${slug}.json`));
    return true;
  } catch {
    return false;
  }
}
