/**
 * lib/cuestionario.ts — lo que hay que saber de una cuenta antes de escribir
 * por ella.
 *
 * Es la misma idea que cuando Claude pregunta antes de empezar un proyecto:
 * ¿a qué se dedican?, ¿cómo llegaron ahí?, ¿a quién le hablan?, ¿cómo suenan?
 * Las respuestas, junto con los materiales —el manual de identidad, posts
 * pasados, el documento del negocio—, son lo que lee Claude para escribir
 * `identidad.md` y adaptar de ahí la voz y los prompts. Ver lib/identidad.ts.
 *
 * Ninguna es obligatoria. Lo que no se contesta y no está en los materiales,
 * Claude lo devuelve como pregunta pendiente en vez de inventarlo.
 *
 * Sin imports: lo usan la página (en el navegador) y el servidor.
 */

export type Pregunta = {
  id: string;
  pregunta: string;
  /** Un ejemplo de respuesta, para que se entienda qué se busca. */
  ejemplo?: string;
  /** Una línea en vez de un párrafo. */
  corta?: boolean;
};

export type Seccion = { titulo: string; preguntas: Pregunta[] };

export const CUESTIONARIO: Seccion[] = [
  {
    titulo: 'La cuenta',
    preguntas: [
      { id: 'nombre', pregunta: 'Nombre del negocio o de la persona', ejemplo: 'Dra. Mildreth …', corta: true },
      { id: 'usuario', pregunta: 'Usuario de Instagram', ejemplo: '@pediatra_mildreth', corta: true },
      { id: 'giro', pregunta: '¿A qué se dedican, en una frase?', ejemplo: 'Pediatra con consulta privada; ve niños de 0 a 12 años' },
      { id: 'ciudad', pregunta: '¿En qué ciudad o zona atienden?', corta: true },
      { id: 'contacto', pregunta: '¿Cómo los contacta o agenda la gente?', ejemplo: 'WhatsApp, Doctoralia, sitio web, teléfono…' },
    ],
  },
  {
    titulo: 'Su historia',
    preguntas: [
      { id: 'historia', pregunta: '¿Cómo llegaron a esto? ¿Desde cuándo?', ejemplo: 'Por qué eligió la especialidad, cómo empezó el negocio' },
      { id: 'distinto', pregunta: '¿Qué los hace distintos de la competencia?' },
      { id: 'servicios', pregunta: '¿Qué servicios o productos ofrecen? ¿Cuál quieren empujar más?' },
    ],
  },
  {
    titulo: 'A quién le hablan',
    preguntas: [
      { id: 'publico', pregunta: '¿Quién es su cliente ideal?', ejemplo: 'Mamás primerizas de 25 a 40, que buscan en Google antes de llamar' },
      { id: 'dudas', pregunta: '¿Qué les preguntan siempre? ¿Qué les preocupa?' },
    ],
  },
  {
    titulo: 'Cómo suenan',
    preguntas: [
      { id: 'tono', pregunta: '¿Cómo deben sonar? Tres adjetivos', ejemplo: 'cercana, clara, tranquila', corta: true },
      { id: 'trato', pregunta: '¿De tú o de usted?', corta: true },
      { id: 'frasesSi', pregunta: 'Frases o palabras que usan siempre' },
      { id: 'frasesNo', pregunta: 'Palabras, temas o promesas que nunca deben salir' },
      { id: 'emojis', pregunta: '¿Emojis en el texto de la publicación? ¿Cuáles?', corta: true },
    ],
  },
  {
    titulo: 'El contenido',
    preguntas: [
      { id: 'temasSi', pregunta: '¿De qué temas sí hablan?' },
      { id: 'temasNo', pregunta: '¿De qué no hablan, aunque se parezca a lo suyo?', ejemplo: 'Eso lo ve otro especialista; eso no lo vendemos' },
      { id: 'objetivo', pregunta: '¿Qué quieren que haga quien ve el post?', ejemplo: 'Agendar, cotizar, guardar, compartir', corta: true },
      { id: 'estructura', pregunta: '¿Cómo es un buen carrusel suyo? ¿Cuántos slides y qué va en cada uno?' },
      { id: 'fuentes', pregunta: '¿Qué fuentes pueden citar?', ejemplo: 'AAP, OMS, NOM-…, fichas técnicas del fabricante' },
    ],
  },
  {
    titulo: 'Lo visual',
    preguntas: [
      { id: 'visual', pregunta: 'Colores, tipografías y estilo de fotos', ejemplo: 'Si está en el manual de identidad, basta con subirlo abajo' },
      { id: 'imagenesNo', pregunta: '¿Qué imágenes no deben salir nunca?' },
    ],
  },
  {
    titulo: 'Algo más',
    preguntas: [{ id: 'otros', pregunta: '¿Algo más que deba saber quien escriba por esta cuenta?' }],
  },
];

export type Respuestas = Record<string, string>;

/** Las respuestas como texto para el prompt, en el orden del cuestionario. */
export function respuestasComoTexto(respuestas: Respuestas): string {
  return CUESTIONARIO.map((s) => {
    const contestadas = s.preguntas.filter((p) => respuestas[p.id]?.trim());
    if (!contestadas.length) return '';
    return `## ${s.titulo}\n\n${contestadas
      .map((p) => `**${p.pregunta}**\n${respuestas[p.id].trim()}`)
      .join('\n\n')}`;
  })
    .filter(Boolean)
    .join('\n\n');
}

/** Los tipos de archivo que Claude puede leer como material. */
export const EXTENSIONES_MATERIAL = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.md', '.txt'];
