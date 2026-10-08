/**
 * scripts/consentimiento.mjs — `npm run consentimiento [referencia]`
 *
 * Dónde salió una foto de paciente.
 *
 * Esta es la razón de que el campo guarde la referencia de un documento y no un
 * sí/no. Un booleano contesta "¿firmó?", que es la pregunta fácil y la que solo
 * hace falta una vez. La pregunta difícil llega meses después y es al revés:
 * **un paciente retira su consentimiento y hay que encontrar todo lo que hay
 * suyo publicado.** Un sí/no no se puede buscar; una referencia sí.
 *
 *   npm run consentimiento                 → todo lo que lleva consentimiento
 *   npm run consentimiento "expediente 218" → solo ese
 *
 * Busca en todos los proyectos; `-- --proyecto <id>` lo limita a uno.
 *
 * No borra nada. Dice qué archivos y qué carruseles hay que tocar, que es lo
 * que hace falta para poder tocarlos con criterio.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { existeProyecto, listarProyectos, rutasDe, sinProyecto } from '../lib/proyecto.ts';

/*
 * Todos los proyectos, salvo que se pida uno con --proyecto. Quien pregunta
 * por un consentimiento quiere saber dónde está esa foto, y la respuesta no
 * debe depender de acordarse de en qué cuenta se usó.
 */
const iProyecto = process.argv.indexOf('--proyecto');
const pedido = iProyecto === -1 ? undefined : process.argv[iProyecto + 1];
if (pedido && !existeProyecto(pedido)) {
  console.error(`No existe el proyecto "${pedido}". Hay: ${listarProyectos().join(', ')}.`);
  process.exit(1);
}
const proyectos = pedido ? [pedido] : listarProyectos();

const argumento = sinProyecto(process.argv.slice(2))[0] ?? '';
const buscado = argumento.toLowerCase();

const hallazgos = [];

for (const proyecto of proyectos) {
  const POSTS = rutasDe(proyecto).posts;
  for (const archivo of readdirSync(POSTS).filter((f) => f.endsWith('.json'))) {
    const post = JSON.parse(readFileSync(join(POSTS, archivo), 'utf8'));

    post.slides.forEach((slide, i) => {
      // La portada lleva su foto suelta; los de contenido, dentro del visual.
      const fotos = [
        slide.tipo === 'portada' && slide.foto
          ? { src: slide.foto, credito: slide.fotoCredito }
          : null,
        slide.visual?.clase === 'foto'
          ? { src: slide.visual.src, credito: slide.visual.credito }
          : null,
      ].filter(Boolean);

      for (const foto of fotos) {
        const referencia = foto.credito?.consentimiento?.referencia;
        const interesa = buscado
          ? (referencia ?? '').toLowerCase().includes(buscado)
          : Boolean(referencia);
        if (!interesa) continue;

        hallazgos.push({
          proyecto,
          post: post.slug,
          estado: post.estado,
          donde: `slide ${String(i).padStart(2, '0')}`,
          src: foto.src,
          referencia,
          fecha: foto.credito?.consentimiento?.fecha,
          fuente: foto.credito?.fuente,
        });
      }
    });
  }
}

if (hallazgos.length === 0) {
  console.log(
    buscado
      ? `Ninguna foto lleva el consentimiento "${argumento}".`
      : 'Ninguna foto tiene referencia de consentimiento registrada.',
  );
  process.exit(0);
}

const titulo = buscado
  ? `Fotos con el consentimiento "${argumento}"`
  : 'Fotos con consentimiento registrado';
console.log(`\n${titulo}: ${hallazgos.length}\n`);

for (const h of hallazgos) {
  console.log(`  ${h.proyecto} · ${h.post} · ${h.donde}  [${h.estado}]`);
  console.log(`    archivo:  public${h.src}`);
  if (h.fuente) console.log(`    fuente:   ${h.fuente}`);
  if (h.referencia) {
    console.log(`    consent.: ${h.referencia}${h.fecha ? ` (${h.fecha})` : ''}`);
  }
  console.log();
}

const publicados = hallazgos.filter((h) => h.estado === 'publicado');
if (publicados.length) {
  console.log(
    `${publicados.length} ${publicados.length === 1 ? 'está publicada' : 'están publicadas'}: ` +
      'retirar el consentimiento no basta con cambiar el JSON, hay que bajar el post de Instagram.',
  );
}
