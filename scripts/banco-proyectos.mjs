/**
 * scripts/banco-proyectos.mjs — `npm run banco-proyectos`
 *
 * Que cada cuenta escriba con lo suyo y guarde en lo suyo.
 *
 * Con varios proyectos, el error caro no revienta: es un carrusel de la
 * pediatra redactado con el alcance del dermatólogo, o una foto de una cuenta
 * guardada en la carpeta de la otra. Todo sigue funcionando y el error sale
 * publicado. Por eso se mide aquí, sin servidor y sin red:
 *
 *   · las rutas de un proyecto no salen de su carpeta, y los ids peligrosos
 *     —`api`, `../x`— no pasan;
 *   · los scripts no adivinan el proyecto cuando hay más de uno;
 *   · cada pieza de proyectos/<id>/prompts/ llega a su prompt, y la de una
 *     cuenta no aparece en el de otra;
 *   · los posts de cada cuenta solo apuntan a fotos de su propia carpeta, y
 *     esas fotos existen.
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { instruccionesDeCriterios, instruccionesDeRedaccion } from '../lib/instrucciones.ts';
import {
  esIdValido,
  listarProyectos,
  PROYECTO_DE_PRUEBAS,
  proyectoDeArgumentos,
  rutasDe,
  sinProyecto,
} from '../lib/proyecto.ts';
import { darDeAlta, POR_ESCRIBIR } from '../lib/alta.ts';
import { instrucciones as instruccionesDeTemas } from '../lib/temas.ts';
import { NOMBRES_PLANTILLA } from '../plantillas/nombres.ts';
import { paletas, PALETA_POR_DEFECTO } from '../plantillas/clinica/tokens.ts';

let fallos = 0;
const ok = (bien, texto) => {
  console.log(`  ${bien ? 'OK  ' : 'FALLA'} ${texto}`);
  if (!bien) fallos++;
};
const lanza = (f) => {
  try {
    f();
    return null;
  } catch (e) {
    return e.message;
  }
};

const lanzaAsync = async (f) => {
  try {
    await f();
    return '';
  } catch (e) {
    return e.message;
  }
};

/** Lo que leen redactar, criterios y proponer, armado igual que ellos. */
function prompts(id, raiz = process.cwd()) {
  const r = rutasDe(id, raiz);
  const marca = JSON.parse(readFileSync(r.config, 'utf8'));
  const pieza = (n) => readFileSync(r.prompt(n), 'utf8').trimEnd();
  const piezas = {
    alcance: pieza('alcance'),
    estructura: pieza('estructura'),
    iconos: pieza('iconos'),
    fotos: pieza('fotos'),
    fotosBanco: pieza('fotos-banco'),
  };
  const redaccion = instruccionesDeRedaccion('Un tema cualquiera', {
    marca,
    piezas,
    paletas,
    paletaPorDefecto: PALETA_POR_DEFECTO,
  });
  const criterios = instruccionesDeCriterios(
    { tema: 'Un tema', titulo: 'Un **título**', cuerpo: 'Un cuerpo' },
    { giro: marca.giro, fotosBanco: piezas.fotosBanco },
  );
  const temas = instruccionesDeTemas({
    mes: 'octubre',
    publicados: [],
    especialidad: marca.especialidad,
    ciudad: marca.ciudad,
    alcance: piezas.alcance,
    paletas: [{ nombre: 'azul', cuando: 'sin color obvio' }],
  });
  return { marca, piezas, redaccion, criterios, temas };
}

/* ── las rutas ───────────────────────────────────────────────────────────── */
console.log('\nLas rutas de un proyecto no salen de su carpeta');

const r = rutasDe('una-cuenta');
const dentro = (ruta, carpeta) => !relative(carpeta, ruta).startsWith('..');
const carpetaPrivada = join(process.cwd(), 'proyectos', 'una-cuenta');
const carpetaPublica = join(process.cwd(), 'public', 'proyectos', 'una-cuenta');
ok(
  [r.config, r.voz, r.identidad, r.cuestionario, r.materiales, r.prompt('alcance'), r.calendario, r.posts, r.post('un-slug')].every((x) =>
    dentro(x, carpetaPrivada),
  ),
  'configuración, voz, identidad, materiales, prompts, calendario y posts, en proyectos/<id>/',
);
ok(
  [r.media('un-slug'), r.descargas, r.indiceDescargas, r.marca].every((x) => dentro(x, carpetaPublica)),
  'fotos, descargas y logos, en public/proyectos/<id>/',
);
ok(r.urlMedia('un-slug', 'a.jpg') === '/proyectos/una-cuenta/media/un-slug/a.jpg', 'y la URL de una foto lleva el proyecto');

for (const malo of ['api', 'plantilla', 'iconos', 'nuevo', '../dr-edwin', 'Dra-Mildreth', 'con espacio', '', '-x']) {
  ok(!esIdValido(malo), `"${malo}" no es un id de proyecto`);
}
ok(lanza(() => rutasDe('../otro')) !== null, 'y pedir sus rutas lanza, no devuelve una ruta fuera');
for (const bueno of ['dr-edwin', 'dra-mildreth', 'adimex', 'cuenta2']) {
  ok(esIdValido(bueno), `"${bueno}" sí`);
}

/* ── el proyecto de un script ────────────────────────────────────────────── */
console.log('\nLos scripts no adivinan cuando hay más de un proyecto');

const temporal = mkdtempSync(join(tmpdir(), 'banco-proyectos-'));
const alta = (id, alcance) => {
  const rr = rutasDe(id, temporal);
  mkdirSync(join(rr.carpeta, 'prompts'), { recursive: true });
  const marca = {
    nombre: `Nombre de ${id}`,
    usuario: `@${id}`,
    especialidad: `Especialidad de ${id}`,
    ciudad: `Ciudad de ${id}`,
    plataforma: `Plataforma de ${id}`,
    giro: `el giro de ${id}`,
    fuentes: [`Fuente de ${id}`],
  };
  writeFileSync(rr.config, JSON.stringify(marca));
  for (const n of ['alcance', 'estructura', 'iconos', 'fotos', 'fotos-banco']) {
    writeFileSync(rr.prompt(n), `${n === 'alcance' ? alcance : `${n} de ${id}`}\n`);
  }
};

try {
  ok(/ningún proyecto/.test(lanza(() => proyectoDeArgumentos(['node', 'x'], temporal)) ?? ''), 'sin proyectos, lo dice');

  alta('cuenta-a', 'Alcance exclusivo de A');
  ok(proyectoDeArgumentos(['node', 'x'], temporal) === 'cuenta-a', 'con uno solo, no hace falta decirlo');

  alta('cuenta-b', 'Alcance exclusivo de B');
  const sinDecir = lanza(() => proyectoDeArgumentos(['node', 'x', '3001'], temporal)) ?? '';
  ok(/cuenta-a/.test(sinDecir) && /cuenta-b/.test(sinDecir) && /--proyecto/.test(sinDecir), 'con dos, se niega y dice cuáles hay');
  ok(proyectoDeArgumentos(['node', 'x', '--proyecto', 'cuenta-b'], temporal) === 'cuenta-b', 'y con --proyecto, usa ese');
  ok(/No existe/.test(lanza(() => proyectoDeArgumentos(['node', 'x', '--proyecto', 'cuenta-c'], temporal)) ?? ''), 'uno que no existe, no');
  ok(
    JSON.stringify(sinProyecto(['3001', '--proyecto', 'cuenta-b', '--plan'])) === '["3001","--plan"]',
    'y el id no se confunde con un argumento suelto',
  );

  /* ── nada de una cuenta en el prompt de otra ───────────────────────────── */
  console.log('\nLo de cada cuenta llega a su prompt, y solo al suyo');

  const a = prompts('cuenta-a', temporal);
  const b = prompts('cuenta-b', temporal);
  ok(a.temas.includes('Alcance exclusivo de A') && !a.temas.includes('de B'), 'el alcance de A en la propuesta de A, sin nada de B');
  ok(b.temas.includes('Alcance exclusivo de B') && !b.temas.includes('de A'), 'y al revés');
  ok(
    ['estructura de cuenta-a', 'iconos de cuenta-a', 'fotos de cuenta-a', 'Fuente de cuenta-a', 'Nombre de cuenta-a'].every((t) =>
      a.redaccion.includes(t),
    ),
    'estructura, íconos, fotos, fuentes y nombre de A en la redacción de A',
  );
  ok(!/cuenta-b/.test(a.redaccion), 'sin una sola mención de B');
  ok(a.criterios.includes('el giro de cuenta-a') && a.criterios.includes('fotos-banco de cuenta-a'), 'y el giro y las fotos de banco de A en sus criterios');
  ok(!/cuenta-b/.test(a.criterios), 'tampoco ahí');

  /* ── el alta ─────────────────────────────────────────────────────────── */
  console.log('\nEl alta de una cuenta');

  // Hace falta una cuenta de donde copiar los ejemplos: la de pruebas.
  const ejemplo = rutasDe(PROYECTO_DE_PRUEBAS, temporal);
  mkdirSync(join(ejemplo.carpeta, 'prompts'), { recursive: true });
  writeFileSync(ejemplo.config, JSON.stringify({ cierre: { lugar: 'L', invitacion: 'I' }, plantilla: 'clinica', fuentes: ['F'] }));
  writeFileSync(ejemplo.voz, 'La voz de ejemplo.\n');
  for (const n of ['alcance', 'estructura', 'iconos', 'fotos', 'fotos-banco']) writeFileSync(ejemplo.prompt(n), `${n}\n`);

  await darDeAlta({ id: 'dra-nueva', nombre: 'Dra. Nueva' }, temporal);
  const nueva = rutasDe('dra-nueva', temporal);
  const config = JSON.parse(readFileSync(nueva.config, 'utf8'));
  ok(config.nombre === 'Dra. Nueva', 'el nombre que se dio queda escrito');
  ok(config.ciudad === POR_ESCRIBIR && config.giro === POR_ESCRIBIR, `lo que no se sabe dice ${POR_ESCRIBIR}`);
  ok(config.logo === '', 'nace sin logo: no hereda el de la otra cuenta, y se sube en la identidad');
  ok(config.plantilla === 'plana', 'nace con la plantilla plana, no con el diseño de la otra cuenta');
  ok(
    [nueva.voz, nueva.prompt('alcance'), nueva.prompt('fotos-banco')].every((f) => readFileSync(f, 'utf8').startsWith(`<!-- ${POR_ESCRIBIR}`)),
    'los textos de ejemplo llegan marcados, para que no se redacte con ellos',
  );
  ok(existsSync(nueva.materiales) && existsSync(nueva.posts), 'con carpeta de materiales y de posts');
  ok(!existsSync(nueva.identidad), 'y sin identidad: esa no se copia de otra cuenta');
  ok(/ya existe/.test(await lanzaAsync(() => darDeAlta({ id: 'dra-nueva' }, temporal))), 'dar de alta dos veces la misma no pisa nada');
  ok(/no sirve como id/.test(await lanzaAsync(() => darDeAlta({ id: 'nuevo' }, temporal))), 'y un id que es ruta de la app no pasa');
} finally {
  rmSync(temporal, { recursive: true, force: true });
}

/* ── los proyectos de verdad ─────────────────────────────────────────────── */

const FOTO_PENDIENTE = '/media/pendiente.jpg';

for (const id of listarProyectos()) {
  console.log(`\nproyectos/${id}`);
  const rr = rutasDe(id);
  const config = JSON.parse(readFileSync(rr.config, 'utf8'));

  ok(NOMBRES_PLANTILLA.includes(config.plantilla), `usa una plantilla que existe (${config.plantilla})`);
  const propias = [config.logo, config.plataformaLogo, config.retrato].filter(Boolean);
  ok(
    propias.every((src) => src.startsWith(`/proyectos/${id}/`)),
    'su logo y su retrato son de su carpeta, no de otra cuenta',
  );

  const piezas = ['alcance', 'estructura', 'iconos', 'fotos', 'fotos-banco'];
  const faltan = [rr.voz, ...piezas.map((n) => rr.prompt(n))].filter((f) => !existsSync(f));
  ok(faltan.length === 0, faltan.length ? `faltan: ${faltan.map((f) => relative(process.cwd(), f)).join(', ')}` : 'tiene su voz y sus cinco piezas');
  if (faltan.length) continue;

  const pendiente = [rr.voz, ...piezas.map((n) => rr.prompt(n)), rr.config].some((f) =>
    readFileSync(f, 'utf8').includes('POR ESCRIBIR'),
  );
  if (pendiente) {
    console.log('  —    todavía tiene textos POR ESCRIBIR: la app no redacta con él, y aquí no se arma el prompt');
  } else {
    const p = prompts(id);
    ok(
      Object.values(p.piezas).every((t) => p.redaccion.includes(t) || p.criterios.includes(t) || p.temas.includes(t)),
      'cada pieza llega a su prompt',
    );
    ok(p.marca.fuentes.every((f) => p.redaccion.includes(f)), `las fuentes válidas están en la redacción (${p.marca.fuentes.length})`);
    ok(p.redaccion.includes(p.marca.ciudad) && p.redaccion.includes(p.marca.usuario), 'y la cuenta, con su ciudad');
    for (const otro of listarProyectos().filter((o) => o !== id)) {
      const ajeno = readFileSync(rutasDe(otro).prompt('alcance'), 'utf8').trimEnd();
      if (ajeno.includes('POR ESCRIBIR')) continue;
      ok(!p.temas.includes(ajeno), `el alcance de ${otro} no está en su propuesta de temas`);
    }
  }

  // Las fotos de sus posts: en su carpeta, y que existan.
  const posts = existsSync(rr.posts) ? readdirSync(rr.posts).filter((f) => f.endsWith('.json')) : [];
  const ajenas = [];
  const perdidas = [];
  for (const archivo of posts) {
    if (archivo.startsWith('laboratorio-')) continue; // sus fotos no se versionan
    const post = JSON.parse(readFileSync(join(rr.posts, archivo), 'utf8'));
    const fotos = post.slides.flatMap((s) => [s.foto, s.visual?.clase === 'foto' ? s.visual.src : undefined]);
    for (const src of fotos.filter((f) => f && f !== FOTO_PENDIENTE)) {
      if (!src.startsWith(`/proyectos/${id}/media/`)) ajenas.push(`${archivo}: ${src}`);
      else if (!existsSync(join(process.cwd(), 'public', src))) perdidas.push(`${archivo}: ${src}`);
    }
  }
  ok(ajenas.length === 0, ajenas.length ? `fotos fuera de su carpeta: ${ajenas.join('; ')}` : `las fotos de sus ${posts.length} posts son de su carpeta`);
  ok(perdidas.length === 0, perdidas.length ? `fotos que no están en disco: ${perdidas.join('; ')}` : 'y todas están en disco');
}

console.log(fallos === 0 ? '\nTodo en pie.' : `\n${fallos} comprobaciones fallaron.`);
if (fallos > 0) process.exitCode = 1;
