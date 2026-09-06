/**
 * template/tipos.ts
 *
 * La forma del contenido. En la fase 2 estos tipos pasan a salir de un esquema
 * de Zod en lib/schema.ts (mismo shape), para que un JSON editado a mano no
 * reviente la app en silencio. Los componentes no tienen que cambiar.
 */

/** Texto con el marcado de la plantilla: *serif itálica*, **negrita**, saltos. */
export type TextoMarcado = string;

/** La excepción de un slide. Si un campo no está, manda el token. */
export type Overrides = {
  /** Empuja el bloque de contenido hacia abajo. */
  offsetY?: number;
  tituloPx?: number;
  cuerpoPx?: number;
  mediaAncho?: number;
  mediaAlto?: number;
};

export type Visual =
  | { clase: 'ninguno' }
  | { clase: 'foto'; src: string; alto?: number; ideaImagen?: string }
  | { clase: 'icono'; slug?: string; tam?: number; iconoSugerido?: string };

export type SlidePortada = {
  tipo: 'portada';
  titulo: TextoMarcado;
  pregunta: string;
  foto?: string;
  overrides?: Overrides;
};

export type SlideContenido = {
  tipo: 'contenido';
  titulo: TextoMarcado;
  bajada?: string;
  cuerpo: string;
  /** Ícono chico encima del título. Opcional; no sustituye al visual. */
  emblema?: { slug: string; tam?: number };
  visual: Visual;
  fuente?: string;
  overrides?: Overrides;
};

export type SlideLista = {
  tipo: 'lista';
  titulo: TextoMarcado;
  puntos: string[];
  fuente?: string;
  overrides?: Overrides;
};

/** El cierre no guarda datos: los toma de content/marca.json. */
export type SlideCierre = { tipo: 'cierre' };

export type Slide = SlidePortada | SlideContenido | SlideLista | SlideCierre;

export type Post = {
  slug: string;
  tema: string;
  creado: string;
  estado: 'borrador' | 'aprobado' | 'publicado';
  pieDeFoto?: string;
  slides: Slide[];
};

export type Marca = {
  nombre: string;
  usuario: string;
  especialidad: string;
  ciudad: string;
  plataforma: string;
  /** Logotipo de la plataforma de citas. Si falta, se escribe el nombre. */
  plataformaLogo?: string;
  logo: string;
  retrato: string;
  papel: string;
  palomita: string;
  flecha: string;
  iconosRecientes?: string[];
};

/**
 * Numeración: la portada no lleva número; el primer slide de contenido es 01 y
 * el cierre lleva el último. Con portada + 5 contenidos + cierre, el cierre
 * es 06. Devuelve null cuando no debe pintarse número.
 */
export function numeroDeSlide(slides: Slide[], i: number): string | null {
  if (slides[i]?.tipo === 'portada') return null;
  return String(i).padStart(2, '0');
}
