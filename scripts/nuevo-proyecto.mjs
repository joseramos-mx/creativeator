/**
 * scripts/nuevo-proyecto.mjs — `npm run proyecto:nuevo -- <id> [--desde <id>]`
 *
 * Da de alta una cuenta desde la terminal. Lo mismo que /nuevo en la app; la
 * lógica está en lib/alta.ts.
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

import { darDeAlta, POR_ESCRIBIR, TEXTOS_DE_EJEMPLO } from '../lib/alta.ts';
import { listarProyectos, sinProyecto } from '../lib/proyecto.ts';

const args = process.argv.slice(2);
const iDesde = args.indexOf('--desde');
const desde = iDesde === -1 ? undefined : args[iDesde + 1];
const id = sinProyecto(args).filter((a, i) => !a.startsWith('--') && !(iDesde !== -1 && i === iDesde + 1))[0];

if (!id) {
  console.error('\nVa así:  npm run proyecto:nuevo -- <id> [--desde <id>]');
  console.error('El id es lo que va en la URL: minúsculas, números y guiones. Ej.: dra-mildreth\n');
  console.error(`Proyectos que hay: ${listarProyectos().join(', ') || 'ninguno'}\n`);
  process.exit(1);
}

try {
  await darDeAlta({ id, desde });
} catch (e) {
  console.error(`\nALTO: ${e.message}\n`);
  process.exit(1);
}

console.log(`\nListo: proyectos/${id}/\n`);
console.log('Lo más fácil es seguir en la app, que pregunta lo que necesita saber:');
console.log(`  http://localhost:3000/${id}/identidad\n`);
console.log('A mano, falta:');
console.log(`  1. proyectos/${id}/proyecto.json — todo lo que dice ${POR_ESCRIBIR}.`);
console.log(`  2. El logo en blanco: public/proyectos/${id}/marca/logo-blanco.png`);
console.log(`  3. Los seis textos, empezando por voz.md: ${Object.keys(TEXTOS_DE_EJEMPLO).join(', ')}.`);
console.log(`  4. Si tiene calendario editorial: proyectos/${id}/calendario.tsv\n`);
