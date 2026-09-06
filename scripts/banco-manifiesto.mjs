/**
 * scripts/banco-manifiesto.mjs — `npm run banco-manifiesto`
 *
 * Que la ingesta no borre lo que no calculó.
 *
 * El caso que importa es concreto: un ícono generado guarda `origen`,
 * `proveedor`, `prompt` y `fecha`, y de los cuatro el que duele perder es el
 * prompt — es lo único que permite regenerar la pieza si algún día cambia el
 * estilo de la cuenta. Antes de esto, volver a pasar el archivo por la ingesta
 * los borraba los cuatro, en silencio y sin que nada fallara.
 *
 * Se comprueba aquí y no mirando el JSON porque el borrado no se nota: la
 * entrada sigue existiendo, con su slug y su color, y solo le faltan los campos
 * que nadie va a echar de menos hasta que los necesite.
 */

import { CAMPOS_DE_LA_INGESTA, fusionar } from '../lib/manifiesto.ts';

let fallos = 0;
const ok = (bien, texto) => {
  console.log(`  ${bien ? 'OK  ' : 'FALLA'} ${texto}`);
  if (!bien) fallos++;
};

/** Lo que la ingesta calcula mirando el PNG. */
const calculada = {
  slug: 'lupa',
  nombre: 'lupa',
  etiquetas: ['lupa', 'magnifying', 'glass', 'buscar'],
  color: '#C9D4DE',
  w: 1024,
  h: 1024,
  bytes: 51234,
};

/** Lo que había en el manifiesto porque el ícono se generó. */
const generada = {
  ...calculada,
  bytes: 48000,
  origen: 'generado',
  proveedor: 'gemini-3.1-flash-image',
  prompt: 'Una lupa clásica, con mango y aro metálico…',
  fecha: '2026-09-06',
};

console.log('\nReingerir un ícono generado');

const fusionada = fusionar(generada, calculada);

for (const campo of ['origen', 'proveedor', 'prompt', 'fecha']) {
  ok(fusionada[campo] === generada[campo], `conserva "${campo}"`);
}
ok(fusionada.bytes === calculada.bytes, 'y actualiza lo que sí calculó: bytes');
ok(fusionada.color === calculada.color, 'y el color');
ok(
  JSON.stringify(fusionada.etiquetas) === JSON.stringify(calculada.etiquetas),
  'y las etiquetas, que dependen del diccionario de sinónimos',
);

console.log('\nLos casos de alrededor');

ok(
  JSON.stringify(fusionar(undefined, calculada)) === JSON.stringify(calculada),
  'un ícono nuevo entra tal cual, sin previa que conservar',
);

// El color puede ser null legítimamente —un ícono enteramente transparente—, y
// eso sí se escribe. `undefined` es "no lo pude calcular", que no es motivo
// para tirar lo que ya se sabía.
ok(
  fusionar({ ...calculada, color: '#AABBCC' }, { ...calculada, color: null }).color === null,
  'un color null sí pisa al anterior: es una respuesta, no una ausencia',
);
ok(
  fusionar({ ...calculada, color: '#AABBCC' }, { ...calculada, color: undefined }).color ===
    '#AABBCC',
  'un color undefined no lo pisa: es una ausencia, no una respuesta',
);

// Y lo que hace que esto valga para el futuro: no hay lista de campos a salvar.
// Se salva todo lo que la ingesta no calcula, incluido lo que no existe todavía.
const conCampoFuturo = fusionar({ ...generada, licencia: 'propia' }, calculada);
ok(
  conCampoFuturo.licencia === 'propia',
  'un campo que nadie previó también sobrevive: no hay lista de salvados',
);

ok(
  CAMPOS_DE_LA_INGESTA.every((c) => c in calculada),
  `los ${CAMPOS_DE_LA_INGESTA.length} campos declarados son los que la ingesta escribe`,
);

console.log(fallos === 0 ? '\nTodo en pie.' : `\n${fallos} comprobaciones fallaron.`);
if (fallos > 0) process.exitCode = 1;
