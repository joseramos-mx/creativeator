/**
 * scripts/nuevo-proyecto.mjs — `npm run proyecto:nuevo -- <id> [--desde <id>]`
 *
 * Da de alta una cuenta: crea proyectos/<id>/ y public/proyectos/<id>/ con
 * todo lo que la app necesita para abrirla.
 *
 * Los textos salen de otro proyecto —el Dr. Edwin si no se dice otro— como
 * **ejemplo**, porque adaptar un prompt que ya funciona es mucho más fácil que
 * escribirlo en blanco. Cada uno lleva arriba la línea «POR ESCRIBIR», y
 * mientras siga ahí la app no redacta con él: lib/piezas.ts se niega y dice
 * qué archivo falta. Así no hay forma de que la cuenta nueva escriba con la voz
 * de la otra sin que nadie lo note.
 *
 * Lo que no copia: los posts, el calendario, las fotos y las descargas, que
 * son de la otra cuenta. Y el logo, que hay que poner a mano en
 * public/proyectos/<id>/marca/.
 */

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { esIdValido, existeProyecto, listarProyectos, rutasDe, sinProyecto } from '../lib/proyecto.ts';

const POR_ESCRIBIR = 'POR ESCRIBIR';

const args = process.argv.slice(2);
const iDesde = args.indexOf('--desde');
const desde = iDesde === -1 ? 'dr-edwin' : args[iDesde + 1];
const id = sinProyecto(args).filter((a, i) => !a.startsWith('--') && !(iDesde !== -1 && i === iDesde + 1))[0];

if (!id) {
  console.error('\nVa así:  npm run proyecto:nuevo -- <id> [--desde <id>]');
  console.error('El id es lo que va en la URL: minúsculas, números y guiones. Ej.: dra-mildreth\n');
  console.error(`Proyectos que hay: ${listarProyectos().join(', ') || 'ninguno'}\n`);
  process.exit(1);
}
if (!esIdValido(id)) {
  console.error(`\nALTO: "${id}" no sirve como id: solo minúsculas, números y guiones, y no un nombre de ruta de la app.\n`);
  process.exit(1);
}
if (existsSync(rutasDe(id).carpeta)) {
  console.error(`\nALTO: proyectos/${id}/ ya existe. No se sobrescribe nada.\n`);
  process.exit(1);
}
if (!existeProyecto(desde)) {
  console.error(`\nALTO: no existe el proyecto "${desde}" para copiar sus textos.\n`);
  process.exit(1);
}

const origen = rutasDe(desde);
const nuevo = rutasDe(id);

/* ── proyecto.json ───────────────────────────────────────────────────────── */

const base = JSON.parse(await readFile(origen.config, 'utf8'));
const config = {
  nombre: POR_ESCRIBIR,
  usuario: `@${POR_ESCRIBIR}`,
  especialidad: POR_ESCRIBIR,
  ciudad: POR_ESCRIBIR,
  plataforma: POR_ESCRIBIR,
  logo: `/proyectos/${id}/marca/logo-blanco.png`,
  retrato: '',
  // La llamada a la acción del ejemplo sirve igual a cualquier consulta; si la
  // cuenta no da citas, se cambia aquí.
  cierre: base.cierre,
  plantilla: base.plantilla,
  giro: POR_ESCRIBIR,
  fuentes: base.fuentes,
  iconosRecientes: [],
};

/* ── los textos ──────────────────────────────────────────────────────────── */

const QUE_ES = {
  'voz.md': 'el system prompt de la redacción: a quién le habla la cuenta, cómo suena, sus límites y la fórmula del copy',
  'prompts/alcance.md': 'qué temas son de esta cuenta y cuáles no (va después de la especialidad, en «Quién firma»)',
  'prompts/estructura.md': 'cuántos slides lleva un carrusel y qué va en cada uno',
  'prompts/iconos.md': 'lo que nunca se pide como ícono',
  'prompts/fotos.md': 'qué foto de banco sí y cuál no, para el redactor',
  'prompts/fotos-banco.md': 'lo mismo para quien busca la foto, con su encabezado',
};

await mkdir(nuevo.posts, { recursive: true });
await mkdir(join(nuevo.carpeta, 'prompts'), { recursive: true });
await mkdir(nuevo.marca, { recursive: true });

await writeFile(nuevo.config, `${JSON.stringify(config, null, 2)}\n`, 'utf8');

for (const [archivo, que] of Object.entries(QUE_ES)) {
  const texto = await readFile(join(origen.carpeta, archivo), 'utf8');
  const aviso =
    `<!-- ${POR_ESCRIBIR}: este es el texto de ${desde}, como ejemplo. Es ${que}. ` +
    `Reescríbelo para esta cuenta y borra esta línea; mientras esté, la app no redacta. -->\n\n`;
  await writeFile(join(nuevo.carpeta, archivo), aviso + texto, 'utf8');
}

// Un .gitkeep para que git guarde la carpeta de posts aunque esté vacía.
await writeFile(join(nuevo.posts, '.gitkeep'), '', 'utf8');

console.log(`\nListo: proyectos/${id}/\n`);
console.log('Falta, en este orden:');
console.log(`  1. proyectos/${id}/proyecto.json — todo lo que dice ${POR_ESCRIBIR}.`);
console.log(`  2. El logo en blanco: public/proyectos/${id}/marca/logo-blanco.png`);
console.log(`  3. Los seis textos, empezando por voz.md: ${Object.keys(QUE_ES).join(', ')}.`);
console.log(`  4. Si tiene calendario editorial: proyectos/${id}/calendario.tsv`);
console.log(`\nY se abre en http://localhost:3000/${id}\n`);
