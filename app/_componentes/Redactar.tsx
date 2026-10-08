'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Post } from '@/plantillas/clinica/tipos';
import { useApi, useProyecto } from './proyecto';

/**
 * Escribe un tema y sale un borrador.
 *
 * Dos cosas que este panel hace a propósito y conviene no "arreglar":
 *
 * · **No exporta.** Guarda como borrador y abre el editor. Entre lo que escribe
 *   el modelo y un PNG hay una persona, siempre.
 * · **Enseña antes de escribir a disco.** Una llamada cuesta y tarda; ver qué
 *   salió —con qué paleta, con qué slides— antes de
 *   crear el archivo es lo que evita acumular borradores que nadie quiso.
 *
 * Y si el tema se deja vacío, el modelo propone y arranca con el primero. No
 * hay paso de elegir: cuál de los temas propuestos se escribe es preferencia, y
 * cambiarlo después cuesta lo mismo que haberlo elegido antes. Sí se enseña
 * cuál tomó y por qué toca este mes, que es información y no una pregunta.
 */

type Fase = 'proponiendo' | 'redactando';

/** Cuánto tarda cada fase en una corrida normal, en segundos. */
const DURACION: Record<Fase, number> = { proponiendo: 20, redactando: 150 };

const TEXTO: Record<Fase, string> = {
  proponiendo: 'Eligiendo tema…',
  redactando: 'Escribiendo el carrusel, buscando las fotos y generando los íconos que falten…',
};

/**
 * La barra mientras se trabaja.
 *
 * **Es indeterminada a propósito.** Todo el trabajo va en una sola petición y
 * el servidor no manda avance, así que una barra que dijera "62 %" se lo
 * estaría inventando. Lo que sí se sabe es en qué fase va y cuánto lleva, y eso
 * es lo que contesta la pregunta de quien mira: ¿sigue viva y cuánto llevo
 * esperando?
 *
 * El relleno avanza contra la duración típica pero **nunca llega al final**: se
 * frena asintóticamente en el 92 %. Una barra que se planta en 100 % y sigue
 * esperando es peor que no tener barra, porque enseña a no creerle.
 *
 * Pasada la duración típica lo dice, en vez de fingir que todo va bien.
 */
function Progreso({ fase, segundos }: { fase: Fase; segundos: number }) {
  const tipico = DURACION[fase];
  // Se acerca al 92 % y ahí se queda: el último tramo no se puede saber.
  const avance = 92 * (1 - Math.exp(-segundos / (tipico / 1.6)));
  const tarde = segundos > tipico * 1.6;

  return (
    <div className="progreso" role="status" aria-live="polite">
      <div className="progreso__barra">
        <div className="progreso__relleno" style={{ width: `${avance.toFixed(1)}%` }} />
      </div>
      <p className="pista">
        {TEXTO[fase]} <b>{segundos}s</b>
        {tarde ? ' · está tardando más de lo normal, pero sigue trabajando.' : ''}
      </p>
    </div>
  );
}

type Propuesta = {
  tema: string;
  /** Qué hace que este tema toque este mes y no en marzo. */
  porQueAhora: string;
  paleta: string;
  porQuePaleta: string;
};

export function Redactar() {
  const api = useApi();
  const proyecto = useProyecto();
  const router = useRouter();
  const [tema, setTema] = useState('');
  const [propuestas, setPropuestas] = useState<Propuesta[] | null>(null);
  const [contexto, setContexto] = useState<{ mes: string } | null>(null);
  const [salida, setSalida] = useState<{
    post: Post;
    porQuePaleta: string;
    avisos: string[];
  } | null>(null);
  const [slug, setSlug] = useState('');
  const [error, setError] = useState<string>();
  const [trabajando, setTrabajando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [fase, setFase] = useState<Fase | null>(null);
  const [segundos, setSegundos] = useState(0);

  // El reloj corre en el navegador porque el servidor no manda avance: todo el
  // trabajo va en una petición. Ver el comentario de `Progreso`.
  useEffect(() => {
    if (!fase) return;
    setSegundos(0);
    const t = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [fase]);

  /**
   * Sin tema escrito: el modelo propone y se arranca con el primero.
   *
   * Propone tres y no uno porque pedirle que ordene lo mejor primero le sale
   * mejor que pedirle una sola respuesta; pero cuál de los tres se escribe no
   * es criterio, es preferencia, y cambiar el tema después cuesta lo mismo que
   * haberlo elegido antes. Lo que sí se enseña es cuál tomó y por qué.
   */
  async function proponerTemas() {
    setTrabajando(true);
    setFase('proponiendo');
    setError(undefined);
    setSalida(null);
    setPropuestas(null);
    try {
      const r = await fetch(api('/proponer'), { method: 'POST' });
      const cuerpo = await r.json();
      if (!r.ok) throw new Error(cuerpo.error);

      const elegida = cuerpo.propuestas?.[0];
      if (!elegida) throw new Error('El modelo no propuso ningún tema.');
      setPropuestas([elegida]);
      setContexto(cuerpo.contexto);
      setTema(elegida.tema);
      await redactar(elegida.tema);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron proponer temas.');
      setTrabajando(false);
      setFase(null);
    }
  }

  async function redactar(elegido?: string) {
    const cual = (elegido ?? tema).trim();
    setTrabajando(true);
    setFase('redactando');
    setError(undefined);
    setSalida(null);
    try {
      const r = await fetch(api('/redactar'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tema: cual }),
      });
      const cuerpo = await r.json();
      if (!r.ok) throw new Error(cuerpo.error);
      setSalida(cuerpo);
      setSlug(cuerpo.post.slug);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo redactar.');
    } finally {
      setTrabajando(false);
      setFase(null);
    }
  }

  async function guardar() {
    if (!salida) return;
    setGuardando(true);
    setError(undefined);
    try {
      const post = { ...salida.post, slug };
      const r = await fetch(api('/post'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post }),
      });
      const cuerpo = await r.json();
      if (!r.ok) throw new Error(cuerpo.error);
      router.push(`/${proyecto}/post/${slug}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
      setGuardando(false);
    }
  }

  return (
    <details className="tarjeta" data-redactar>
      <summary>
        <span className="chip">redactar</span>
        <span className="tarjeta__titulo">Redactar un carrusel con la IA</span>
      </summary>

      <div className="tarjeta__cuerpo">
        <label>El tema, como se lo dirías a alguien — o déjalo vacío</label>
        <input
          value={tema}
          placeholder="dermatitis atópica en invierno"
          onChange={(e) => setTema(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || trabajando) return;
            if (tema.trim().length >= 4) redactar();
            else if (!tema.trim()) void proponerTemas();
          }}
        />

        {/* Sin tema, el botón hace el trabajo entero: propone y redacta. */}
        <button
          className="boton"
          onClick={() => (tema.trim() ? redactar() : proponerTemas())}
          disabled={trabajando || (tema.trim().length > 0 && tema.trim().length < 4)}
        >
          {trabajando
            ? tema.trim()
              ? 'redactando… tarda un par de minutos'
              : 'eligiendo tema y redactando…'
            : tema.trim()
              ? 'Redactar'
              : 'Elegir tema y redactar'}
        </button>

        {fase ? <Progreso fase={fase} segundos={segundos} /> : null}

        {error ? <p className="aviso">{error}</p> : null}

        {propuestas?.[0] ? (
          <div className="propuesta propuesta--tomada">
            <span className="chip">tema de {contexto?.mes}</span>
            <strong>{propuestas[0].tema}</strong>
            <span>{propuestas[0].porQueAhora}</span>
            <em data-paleta={propuestas[0].paleta}>
              paleta {propuestas[0].paleta} · {propuestas[0].porQuePaleta}
            </em>
          </div>
        ) : null}

        {salida ? (
          <>
            <p className="pista">
              <strong>{salida.post.slides.length} slides</strong> · paleta{' '}
              <strong>{salida.post.paleta}</strong> — {salida.porQuePaleta}
            </p>
            <p className="pista">
              {conFoto(salida.post) === 0
                ? 'Sin fotos: este carrusel va con íconos.'
                : `${conFoto(salida.post)} ${conFoto(salida.post) === 1 ? 'foto puesta' : 'fotos puestas'} del banco, con su autor y su licencia. Cámbialas en el editor si alguna no te convence.`}
            </p>

            <ol className="redaccion">
              {salida.post.slides.map((s, i) => (
                <li key={i}>
                  <span className="chip">{s.tipo}</span>
                  <span>{titulo(s)}</span>
                </li>
              ))}
            </ol>

            {salida.avisos.length ? (
              <ul className="avisos">
                {salida.avisos.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            ) : null}

            <label>El nombre del archivo</label>
            <input value={slug} onChange={(e) => setSlug(e.target.value.trim())} />

            <button className="boton" onClick={guardar} disabled={guardando || !slug}>
              {guardando ? 'guardando…' : 'Guardar como borrador y abrirlo'}
            </button>
            <p className="pista">
              Se guarda como borrador y se abre en el editor. No se exporta nada: lo que escribió el
              modelo todavía no lo ha leído nadie.
            </p>
          </>
        ) : null}
      </div>
    </details>
  );
}

/**
 * Las fotos que ya quedaron puestas, no las que faltan.
 *
 * Cuenta también la de la portada, que va en su propio campo: es la más
 * visible del carrusel y la que se nota cuando falta.
 */
function conFoto(post: Post) {
  return post.slides.filter((s) =>
    s.tipo === 'portada'
      ? Boolean(s.fotoCredito)
      : s.tipo === 'contenido' && s.visual.clase === 'foto' && Boolean(s.visual.credito),
  ).length;
}

function titulo(s: Post['slides'][number]) {
  if (s.tipo === 'cierre') return s.frase ?? 'cierre de la cuenta';
  return s.titulo.replace(/[*\n]/g, ' ').replace(/\s+/g, ' ').trim();
}
