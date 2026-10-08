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

import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { esIdValido, PROYECTO_DE_PRUEBAS, rutasDe } from './proyecto.ts';

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

/**
 * Con qué se lee y se escribe. Por omisión, el disco; la ruta de la API le
 * pasa lib/almacen.ts, que en Vercel escribe en el repositorio. Aquí no se
 * importa directamente porque este archivo también lo carga un script de node.
 */
export type Archivos = {
  existe(ruta: string): Promise<boolean>;
  leerTexto(ruta: string): Promise<string | null>;
  escribir(cambios: Array<{ ruta: string; datos: string }>, mensaje: string): Promise<void>;
};

const disco: Archivos = {
  existe: (ruta) => stat(ruta).then(() => true, () => false),
  leerTexto: (ruta) => readFile(ruta, 'utf8').catch(() => null),
  async escribir(cambios) {
    for (const { ruta, datos } of cambios) {
      await mkdir(dirname(ruta), { recursive: true });
      await writeFile(ruta, datos, 'utf8');
    }
  },
};

export async function darDeAlta(
  { id, nombre, desde = PROYECTO_DE_PRUEBAS }: Alta,
  raiz = process.cwd(),
  archivos: Archivos = disco,
): Promise<void> {
  if (!esIdValido(id)) {
    throw new Error(
      `"${id}" no sirve como id: solo minúsculas, números y guiones, y no un nombre de ruta de la app.`,
    );
  }
  const nuevo = rutasDe(id, raiz);
  if ((await archivos.existe(nuevo.config)) || (await archivos.existe(nuevo.carpeta))) {
    throw new Error(`proyectos/${id}/ ya existe. No se sobrescribe nada.`);
  }
  const origen = rutasDe(desde, raiz);
  const configOrigen = esIdValido(desde) ? await archivos.leerTexto(origen.config) : null;
  if (configOrigen === null) throw new Error(`No existe el proyecto "${desde}" para copiar sus textos.`);

  const base = JSON.parse(configOrigen);
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

  const cambios = [{ ruta: nuevo.config, datos: `${JSON.stringify(config, null, 2)}\n` }];

  for (const [archivo, que] of Object.entries(TEXTOS_DE_EJEMPLO)) {
    const texto = (await archivos.leerTexto(join(origen.carpeta, archivo))) ?? '';
    const aviso =
      `<!-- ${POR_ESCRIBIR}: este es el texto de ${desde}, como ejemplo. Es ${que}. ` +
      `Reescríbelo para esta cuenta y borra esta línea; mientras esté, la app no redacta. -->\n\n`;
    cambios.push({ ruta: join(nuevo.carpeta, archivo), datos: aviso + texto });
  }

  // Para que git guarde las carpetas aunque estén vacías.
  cambios.push({ ruta: join(nuevo.posts, '.gitkeep'), datos: '' });
  cambios.push({ ruta: join(nuevo.materiales, '.gitkeep'), datos: '' });
  cambios.push({ ruta: join(nuevo.marca, '.gitkeep'), datos: '' });

  await archivos.escribir(cambios, `Alta de la cuenta ${id}`);
}
