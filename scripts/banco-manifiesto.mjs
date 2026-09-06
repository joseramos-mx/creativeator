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

import { CAMPOS_DE_LA_INGESTA, fusionar, gitignoreDeIconos } from '../lib/manifiesto.ts';

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

/* ── qué se versiona y qué no ────────────────────────────────────────────── */
console.log('\nLas excepciones de git salen del campo, no de una lista');

const conGenerado = gitignoreDeIconos([
  { slug: 'termometro' },
  { slug: 'lupa', origen: 'generado' },
]);

ok(conGenerado.includes('!lupa.png'), 'el generado se versiona');
ok(!conGenerado.includes('!termometro.png'), 'y el de Thiings no: su licencia lo prohíbe');
ok(conGenerado.includes('!.gitignore'), 'el propio archivo se versiona, o no serviría de nada');

// El buscador del editor pinta thumbs/<slug>.png. Sin la miniatura, un clon
// recién bajado enseñaría el ícono roto en la rejilla.
ok(conGenerado.includes('!thumbs/lupa.png'), 'la miniatura del generado también');
ok(!conGenerado.includes('!thumbs/termometro.png'), 'y la del de Thiings no');

// Las tres líneas, y en este orden: git no puede volver a incluir nada dentro
// de un directorio excluido, así que primero hay que rescatar la carpeta.
const orden = ['!thumbs/', 'thumbs/*', '!thumbs/lupa.png'].map((l) =>
  conGenerado.split('\n').indexOf(l),
);
ok(
  orden.every((i) => i >= 0) && orden[0] < orden[1] && orden[1] < orden[2],
  'rescatar la carpeta va antes de volver a ignorar su contenido',
);

// Y el que se añada mañana entra solo, sin tocar nada.
const conDos = gitignoreDeIconos([
  { slug: 'lupa', origen: 'generado' },
  { slug: 'gotero', origen: 'generado' },
]);
ok(
  conDos.includes('!gotero.png') && conDos.includes('!thumbs/gotero.png'),
  'un segundo generado aparece sin que nadie escriba una línea',
);

// Sin ninguno propio, no se estorba con las tres líneas de thumbs.
const soloThiings = gitignoreDeIconos([{ slug: 'termometro' }, { slug: 'curitas' }]);
ok(!soloThiings.includes('thumbs/'), 'sin íconos propios no se escribe nada de thumbs');

console.log(fallos === 0 ? '\nTodo en pie.' : `\n${fallos} comprobaciones fallaron.`);
if (fallos > 0) process.exitCode = 1;
