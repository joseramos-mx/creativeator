/**
 * lib/alta.ts — dar de alta una cuenta.
 *
 * Crea proyectos/<id>/ y public/proyectos/<id>/ con todo lo que la app
 * necesita para abrirla. Lo usan la página /nuevo y `npm run proyecto:nuevo`,
 * así que va sin `server-only` ni alias `@/`, igual que lib/proyecto.ts.
 *
 * Los textos salen de otro proyecto —el Dr. Edwin si no se dice otro— como
 * **ejemplo**, porque adaptar un prompt que ya funciona es más fácil que
 * escribirlo en blanco. Cada uno lleva arriba la línea «POR ESCRIBIR», y
 * mientras siga ahí la app no redacta con él: lib/piezas.ts se niega y dice qué
 * archivo falta. Lo normal es que no haga falta tocarlos a mano: la página de
 * identidad los reescribe a partir del cuestionario y los materiales.
 *
 * Lo que no copia: posts, calendario, fotos, descargas e identidad, que son de
 * la otra cuenta.
 */

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { esIdValido, existeProyecto, PROYECTO_DE_PRUEBAS, rutasDe } from './proyecto.ts';

export const POR_ESCRIBIR = 'POR ESCRIBIR';

/** Los textos que se copian como ejemplo, y qué es cada uno. */
export const TEXTOS_DE_EJEMPLO: Record<string, string> = {
  'voz.md': 'el system prompt de la redacción: a quién le habla la cuenta, cómo suena, sus límites y la fórmula del copy',
  'prompts/alcance.md': 'qué temas son de esta cuenta y cuáles no (va después de la especialidad, en «Quién firma»)',
  'prompts/estructura.md': 'cuántos slides lleva un carrusel y qué va en cada uno',
  'prompts/iconos.md': 'lo que nunca se pide como ícono',
  'prompts/fotos.md': 'qué foto de banco sí y cuál no, para el redactor',
  'prompts/fotos-banco.md': 'lo mismo para quien busca la foto, con su encabezado',
};

export type Alta = {
  id: string;
  /** Si se sabe ya, en vez de «POR ESCRIBIR». */
  nombre?: string;
  /** De qué proyecto salen los textos de ejemplo. */
  desde?: string;
};

export async function darDeAlta({ id, nombre, desde = PROYECTO_DE_PRUEBAS }: Alta, raiz = process.cwd()): Promise<void> {
  if (!esIdValido(id)) {
    throw new Error(
      `"${id}" no sirve como id: solo minúsculas, números y guiones, y no un nombre de ruta de la app.`,
    );
  }
  const nuevo = rutasDe(id, raiz);
  if (existsSync(nuevo.carpeta)) throw new Error(`proyectos/${id}/ ya existe. No se sobrescribe nada.`);
  if (!existeProyecto(desde, raiz)) throw new Error(`No existe el proyecto "${desde}" para copiar sus textos.`);
  const origen = rutasDe(desde, raiz);

  const base = JSON.parse(await readFile(origen.config, 'utf8'));
  const config = {
    nombre: nombre?.trim() || POR_ESCRIBIR,
    usuario: `@${POR_ESCRIBIR}`,
    especialidad: POR_ESCRIBIR,
    ciudad: POR_ESCRIBIR,
    plataforma: POR_ESCRIBIR,
    logo: `/proyectos/${id}/marca/logo-blanco.png`,
    retrato: '',
    cierre: base.cierre,
    plantilla: base.plantilla,
    giro: POR_ESCRIBIR,
    fuentes: base.fuentes,
    iconosRecientes: [],
  };

  await mkdir(nuevo.posts, { recursive: true });
  await mkdir(join(nuevo.carpeta, 'prompts'), { recursive: true });
  await mkdir(nuevo.materiales, { recursive: true });
  await mkdir(nuevo.marca, { recursive: true });

  await writeFile(nuevo.config, `${JSON.stringify(config, null, 2)}\n`, 'utf8');

  for (const [archivo, que] of Object.entries(TEXTOS_DE_EJEMPLO)) {
    const texto = await readFile(join(origen.carpeta, archivo), 'utf8');
    const aviso =
      `<!-- ${POR_ESCRIBIR}: este es el texto de ${desde}, como ejemplo. Es ${que}. ` +
      `Reescríbelo para esta cuenta y borra esta línea; mientras esté, la app no redacta. -->\n\n`;
    await writeFile(join(nuevo.carpeta, archivo), aviso + texto, 'utf8');
  }

  // Para que git guarde las carpetas aunque estén vacías.
  await writeFile(join(nuevo.posts, '.gitkeep'), '', 'utf8');
  await writeFile(join(nuevo.materiales, '.gitkeep'), '', 'utf8');
}
