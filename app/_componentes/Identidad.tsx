'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { CUESTIONARIO, EXTENSIONES_MATERIAL, type Respuestas } from '@/lib/cuestionario';
import { plantillaDe } from '@/plantillas';
import { NOMBRES_PALETA, paletas as delaClinica, type NombrePaleta } from '@/plantillas/clinica/tokens';
import type { Proyecto, Slide } from '@/plantillas/clinica/tipos';
import { useApi, useProyecto } from './proyecto';
import { reducirImagen, TOPE_SUBIDA } from './reducirImagen';

/**
 * La identidad de la cuenta: lo que hay que saber antes de escribir por ella.
 *
 * Tres pasos en una pantalla, en el orden en que se hacen:
 *
 *  1. **El cuestionario** — a qué se dedican, cómo llegaron ahí, a quién le
 *     hablan, cómo suenan. Lo que no se sepa se deja en blanco.
 *  2. **Los materiales** — el manual de identidad, posts pasados, el Canva o el
 *     documento del negocio, en PDF o imagen.
 *  3. **Los textos** — Claude lee 1 y 2 y propone `identidad.md`, la voz, las
 *     piezas de los prompts y los datos de la marca, con lo que le falta saber.
 *     Se leen, se corrigen y se guardan. Hasta que se guardan no cambia nada.
 *
 * Una cuenta que ya tiene sus textos —el Dr. Edwin— los ve aquí y los puede
 * editar a mano sin pedir propuesta.
 */

type Material = { nombre: string; bytes: number };

type Marca = {
  nombre: string;
  usuario: string;
  especialidad: string;
  ciudad: string;
  plataforma: string;
  giro: string;
  fuentes: string[];
  cierre: { lugar: string; invitacion: string };
};

type Diseno = {
  plantilla: 'clinica' | 'plana';
  fondo: string;
  tinta: string;
  tituloFuente: string;
  tituloMayusculas: boolean;
  textoFuente: string;
  numeroFuente: string;
  paletas: { nombre: NombrePaleta; color: string; tinta: string; cuando: string }[];
};

export type Textos = {
  identidad: string;
  voz: string;
  alcance: string;
  estructura: string;
  iconos: string;
  fotos: string;
  fotosBanco: string;
  marca: Marca;
  diseno: Diseno;
};

const PIEZAS: { clave: keyof Omit<Textos, 'marca' | 'identidad' | 'diseno'>; titulo: string; que: string }[] = [
  { clave: 'voz', titulo: 'voz.md', que: 'El system prompt de la redacción: a quién le habla, cómo suena, la fórmula del copy.' },
  { clave: 'alcance', titulo: 'prompts/alcance.md', que: 'Qué temas son de la cuenta y cuáles no. Va justo después de la especialidad.' },
  { clave: 'estructura', titulo: 'prompts/estructura.md', que: 'Cuántos slides y qué va en cada uno. El cierre se añade solo.' },
  { clave: 'iconos', titulo: 'prompts/iconos.md', que: 'Lo que nunca se pide como ícono.' },
  { clave: 'fotos', titulo: 'prompts/fotos.md', que: 'Qué foto de banco sí y cuál no, para quien redacta.' },
  { clave: 'fotosBanco', titulo: 'prompts/fotos-banco.md', que: 'Lo mismo para quien busca la foto, con su encabezado.' },
];

const POR_ESCRIBIR = 'POR ESCRIBIR';

const reloj = (s: number) => (s < 60 ? `${Math.round(s)} s` : `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`);
const peso = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export function Identidad({
  proyectoInicial,
  respuestasIniciales,
  materialesIniciales,
  textosIniciales,
  nuevo,
  remoto = false,
}: {
  /** proyecto.json como está: la vista previa del diseño parte de aquí. */
  proyectoInicial: Proyecto;
  respuestasIniciales: Respuestas;
  materialesIniciales: Material[];
  textosIniciales: Textos;
  /** Recién dada de alta: se abre el cuestionario y se explica el camino. */
  nuevo: boolean;
  /** Si se guarda en el repositorio (Vercel): las subidas tienen tope. */
  remoto?: boolean;
}) {
  const api = useApi();
  const proyecto = useProyecto();

  const [respuestas, setRespuestas] = useState<Respuestas>(respuestasIniciales);
  const [respuestasGuardadas, setRespuestasGuardadas] = useState(true);
  const [materiales, setMateriales] = useState<Material[]>(materialesIniciales);
  const [textos, setTextos] = useState<Textos>(textosIniciales);
  const [sinGuardar, setSinGuardar] = useState(false);
  const [preguntas, setPreguntas] = useState<string[]>([]);

  const [subiendo, setSubiendo] = useState(false);
  const [proponiendo, setProponiendo] = useState<number | null>(null);
  const [ahora, setAhora] = useState(Date.now());
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: 'error' | 'ok'; texto: string }>();
  const entrada = useRef<HTMLInputElement>(null);
  const [logo, setLogo] = useState(proyectoInicial.logo);
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const [disenoSinGuardar, setDisenoSinGuardar] = useState(false);
  const [pedidoDiseno, setPedidoDiseno] = useState('');
  const [conReferencias, setConReferencias] = useState(false);
  const [ajustando, setAjustando] = useState(false);
  const [guardandoDiseno, setGuardandoDiseno] = useState(false);
  const [ajuste, setAjuste] = useState<{ tipo: 'error' | 'ok'; texto: string }>();

  useEffect(() => {
    if (proponiendo === null) return;
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [proponiendo]);

  // Avisar antes de salir con una propuesta sin guardar: costó una llamada larga.
  useEffect(() => {
    if (!sinGuardar && !disenoSinGuardar) return;
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [sinGuardar, disenoSinGuardar]);

  const fallo = (e: unknown, porDefecto: string) =>
    setAviso({ tipo: 'error', texto: e instanceof Error ? e.message : porDefecto });

  async function pedir(ruta: string, init: RequestInit) {
    const r = await fetch(api(ruta), init);
    const cuerpo = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(cuerpo.error ?? `La app respondió ${r.status}.`);
    return cuerpo;
  }

  async function guardarRespuestas() {
    await pedir('/identidad/cuestionario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ respuestas }),
    });
    setRespuestasGuardadas(true);
  }

  async function subir(lista: FileList | null) {
    if (!lista?.length) return;
    setSubiendo(true);
    setAviso(undefined);
    try {
      // De uno en uno y las imágenes reducidas: en Vercel una petición no pasa
      // de 4.5 MB, y un manual en PDF más un par de fotos lo rebasan juntos.
      for (const original of Array.from(lista)) {
        const archivo = await reducirImagen(original);
        if (remoto && archivo.size > TOPE_SUBIDA) {
          throw new Error(
            `«${archivo.name}» pesa ${(archivo.size / 1048576).toFixed(1)} MB y desde aquí caben 4. ` +
              'Súbelo desde la computadora, o exporta el PDF con menos páginas.',
          );
        }
        const datos = new FormData();
        datos.append('archivos', archivo);
        const cuerpo = await pedir('/identidad/materiales', { method: 'POST', body: datos });
        setMateriales(cuerpo.materiales);
      }
    } catch (e) {
      fallo(e, 'No se pudo subir.');
    } finally {
      setSubiendo(false);
      if (entrada.current) entrada.current.value = '';
    }
  }

  async function quitar(nombre: string) {
    try {
      const cuerpo = await pedir(`/identidad/materiales?nombre=${encodeURIComponent(nombre)}`, { method: 'DELETE' });
      setMateriales(cuerpo.materiales);
    } catch (e) {
      fallo(e, 'No se pudo quitar.');
    }
  }

  async function proponer() {
    if (sinGuardar && !confirm('Hay una propuesta sin guardar. ¿Pedir otra encima?')) return;
    setProponiendo(Date.now());
    setAhora(Date.now());
    setAviso(undefined);
    try {
      // Lo último que se escribió en el cuestionario es lo que tiene que leer.
      await guardarRespuestas();
      const { propuesta } = await pedir('/identidad/proponer', { method: 'POST' });
      const { preguntas: faltan, ...nuevos } = propuesta;
      setTextos(nuevos);
      setPreguntas(faltan);
      setSinGuardar(true);
      setAviso({ tipo: 'ok', texto: 'Listo. Léelo abajo, corrige lo que haga falta y guárdalo.' });
    } catch (e) {
      fallo(e, 'No se pudo proponer.');
    } finally {
      setProponiendo(null);
    }
  }

  async function guardarTextos() {
    setGuardando(true);
    setAviso(undefined);
    try {
      await pedir('/identidad/textos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ textos }),
      });
      setSinGuardar(false);
      setDisenoSinGuardar(false);
      setAviso({ tipo: 'ok', texto: 'Guardado. Lo que se redacte de aquí en adelante sale con esta identidad.' });
    } catch (e) {
      fallo(e, 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  async function subirLogo(archivo: File | undefined) {
    if (!archivo) return;
    setSubiendoLogo(true);
    setAviso(undefined);
    try {
      const form = new FormData();
      form.append('logo', await reducirImagen(archivo));
      const cuerpo = await pedir('/identidad/logo', { method: 'POST', body: form });
      setLogo(cuerpo.logo);
    } catch (e) {
      fallo(e, 'No se pudo subir el logo.');
    } finally {
      setSubiendoLogo(false);
    }
  }

  const cambiarDiseno = (cambio: Partial<Diseno>) => {
    setTextos((t) => ({ ...t, diseno: { ...t.diseno, ...cambio } }));
    setDisenoSinGuardar(true);
  };

  /** Solo el diseño: no reescribe la identidad ni toca los textos. */
  async function ajustarDiseno() {
    setAjustando(true);
    setAjuste(undefined);
    try {
      const r = await pedir('/identidad/diseno', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diseno: textos.diseno, pedido: pedidoDiseno, conReferencias }),
      });
      cambiarDiseno(r.diseno);
      setAjuste({ tipo: 'ok', texto: `${r.porque} (${r.tokens.toLocaleString('es-MX')} tokens)` });
    } catch (e) {
      setAjuste({ tipo: 'error', texto: e instanceof Error ? e.message : 'No se pudo ajustar.' });
    } finally {
      setAjustando(false);
    }
  }

  async function guardarDiseno() {
    setGuardandoDiseno(true);
    setAjuste(undefined);
    try {
      await pedir('/identidad/diseno', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diseno: textos.diseno }),
      });
      setDisenoSinGuardar(false);
      setAjuste({ tipo: 'ok', texto: 'Diseño guardado. Los carruseles de la cuenta ya salen así.' });
    } catch (e) {
      setAjuste({ tipo: 'error', texto: e instanceof Error ? e.message : 'No se pudo guardar.' });
    } finally {
      setGuardandoDiseno(false);
    }
  }
  const cambiarPaleta = (i: number, cambio: Partial<Diseno['paletas'][number]>) =>
    cambiarDiseno({ paletas: textos.diseno.paletas.map((p, j) => (j === i ? { ...p, ...cambio } : p)) });

  const cambiarTexto = (clave: keyof Omit<Textos, 'marca' | 'diseno'>, valor: string) => {
    setTextos((t) => ({ ...t, [clave]: valor }));
    setSinGuardar(true);
  };
  const cambiarMarca = (cambio: Partial<Marca>) => {
    setTextos((t) => ({ ...t, marca: { ...t.marca, ...cambio } }));
    setSinGuardar(true);
  };

  const contestadas = Object.values(respuestas).filter((v) => v.trim()).length;
  const pendientes = [
    ...Object.entries(textos.marca)
      .filter(([, v]) => JSON.stringify(v).includes(POR_ESCRIBIR))
      .map(([k]) => k),
    ...(['voz', ...PIEZAS.map((p) => p.clave)] as const).filter((k) => textos[k].includes(POR_ESCRIBIR)),
  ];
  const pendientesUnicos = [...new Set(pendientes)];

  return (
    <div className="identidad">
      {nuevo ? (
        <p className="identidad__intro">
          Cuenta dada de alta. Antes de escribir por ella hay que conocerla: contesta lo que sepas, sube lo que tengas
          —manual de identidad, posts pasados, el documento del negocio— y deja que Claude escriba la identidad.
          Nada se guarda sin que lo leas.
        </p>
      ) : null}

      {/* ── 1. el cuestionario ── */}
      <details className="tarjeta" open={nuevo || contestadas === 0} data-cuestionario>
        <summary>
          <span className="chip">1</span>
          <span className="tarjeta__titulo">Lo que debería saber de esta cuenta</span>
          <span className="pista">{contestadas} contestadas</span>
        </summary>
        <div className="tarjeta__cuerpo">
          <p className="pista">
            Ninguna es obligatoria. Lo que no se conteste y no esté en los materiales, Claude lo devuelve como
            pregunta en vez de inventarlo.
          </p>
          {CUESTIONARIO.map((seccion) => (
            <fieldset key={seccion.titulo} className="identidad__seccion">
              <legend>{seccion.titulo}</legend>
              {seccion.preguntas.map((p) => (
                <div key={p.id}>
                  <label htmlFor={`p-${p.id}`}>{p.pregunta}</label>
                  {p.corta ? (
                    <input
                      id={`p-${p.id}`}
                      value={respuestas[p.id] ?? ''}
                      placeholder={p.ejemplo}
                      onChange={(e) => {
                        setRespuestas((r) => ({ ...r, [p.id]: e.target.value }));
                        setRespuestasGuardadas(false);
                      }}
                    />
                  ) : (
                    <textarea
                      id={`p-${p.id}`}
                      rows={2}
                      value={respuestas[p.id] ?? ''}
                      placeholder={p.ejemplo}
                      onChange={(e) => {
                        setRespuestas((r) => ({ ...r, [p.id]: e.target.value }));
                        setRespuestasGuardadas(false);
                      }}
                    />
                  )}
                </div>
              ))}
            </fieldset>
          ))}
          <div className="identidad__acciones">
            <button
              className="boton"
              disabled={respuestasGuardadas}
              onClick={() => guardarRespuestas().catch((e) => fallo(e, 'No se pudo guardar.'))}
            >
              {respuestasGuardadas ? 'Respuestas guardadas' : 'Guardar respuestas'}
            </button>
          </div>
        </div>
      </details>

      {/* ── 2. los materiales ── */}
      <details className="tarjeta" open data-materiales>
        <summary>
          <span className="chip">2</span>
          <span className="tarjeta__titulo">Materiales de la cuenta</span>
          <span className="pista">{materiales.length}</span>
        </summary>
        <div className="tarjeta__cuerpo">
          <p className="pista">
            El manual de identidad, posts publicados, el Canva de una plantilla, el documento que dice a qué se dedican.
            PDF, imágenes o texto; un Word o un Canva se exportan a PDF. Los posts publicados son lo que más enseña del
            tono.
          </p>
          <label
            className="soltar"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void subir(e.dataTransfer.files);
            }}
          >
            {subiendo ? 'Subiendo…' : 'Arrastra aquí los archivos, o haz clic para elegirlos'}
            <input
              ref={entrada}
              type="file"
              multiple
              hidden
              accept={EXTENSIONES_MATERIAL.join(',')}
              onChange={(e) => void subir(e.target.files)}
            />
          </label>
          {materiales.length ? (
            <ul className="identidad__materiales">
              {materiales.map((m) => (
                <li key={m.nombre}>
                  <span>{m.nombre}</span>
                  <span className="pista">{peso(m.bytes)}</span>
                  <button className="boton sm" onClick={() => void quitar(m.nombre)}>
                    quitar
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </details>

      {/* ── 3. los textos ── */}
      <details className="tarjeta" open data-textos>
        <summary>
          <span className="chip">3</span>
          <span className="tarjeta__titulo">La identidad y los textos de la IA</span>
          {sinGuardar ? <span className="chip chip--aviso">sin guardar</span> : null}
        </summary>
        <div className="tarjeta__cuerpo">
          <div className="identidad__acciones">
            <button className="boton" data-proponer onClick={() => void proponer()} disabled={proponiendo !== null}>
              {proponiendo !== null
                ? `Claude está leyendo… ${reloj((ahora - proponiendo) / 1000)}`
                : textos.identidad.trim()
                  ? 'Volver a escribir la identidad con Claude'
                  : 'Escribir la identidad con Claude'}
            </button>
            <button className="boton" data-guardar-textos onClick={() => void guardarTextos()} disabled={guardando || !sinGuardar}>
              {guardando ? 'Guardando…' : 'Guardar textos'}
            </button>
          </div>
          {proponiendo !== null ? (
            <p className="pista">Con un manual en PDF y varios posts tarda uno o dos minutos.</p>
          ) : null}

          {aviso ? <p className={aviso.tipo === 'error' ? 'aviso' : 'pista pista--ok'}>{aviso.texto}</p> : null}

          {preguntas.length ? (
            <div className="identidad__preguntas" data-preguntas>
              <strong>Lo que le faltó saber</strong>
              <ol>
                {preguntas.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ol>
              <p className="pista">
                Contéstalas en el cuestionario —en «Algo más» si no encajan en otra— y vuelve a pedir la identidad.
              </p>
            </div>
          ) : null}

          {pendientesUnicos.length ? (
            <p className="pista pista--aviso">
              Todavía dice {POR_ESCRIBIR} en: {pendientesUnicos.join(', ')}. Mientras siga así, la app no redacta para esta
              cuenta.
            </p>
          ) : null}

          <label htmlFor="t-identidad">identidad.md — quién es la cuenta</label>
          <textarea
            id="t-identidad"
            rows={18}
            className="identidad__md"
            value={textos.identidad}
            placeholder="Todavía no hay identidad escrita."
            onChange={(e) => cambiarTexto('identidad', e.target.value)}
          />

          <fieldset className="identidad__seccion">
            <legend>La marca</legend>
            <div className="fila">
              <div>
                <label>Nombre</label>
                <input value={textos.marca.nombre} onChange={(e) => cambiarMarca({ nombre: e.target.value })} />
              </div>
              <div>
                <label>Usuario</label>
                <input value={textos.marca.usuario} onChange={(e) => cambiarMarca({ usuario: e.target.value })} />
              </div>
            </div>
            <div className="fila">
              <div>
                <label>Especialidad, como la firma la cuenta</label>
                <input value={textos.marca.especialidad} onChange={(e) => cambiarMarca({ especialidad: e.target.value })} />
              </div>
              <div>
                <label>Giro — quién es, dicho por un tercero</label>
                <input value={textos.marca.giro} onChange={(e) => cambiarMarca({ giro: e.target.value })} />
              </div>
            </div>
            <div className="fila">
              <div>
                <label>Ciudad</label>
                <input value={textos.marca.ciudad} onChange={(e) => cambiarMarca({ ciudad: e.target.value })} />
              </div>
              <div>
                <label>Plataforma de citas o contacto</label>
                <input value={textos.marca.plataforma} onChange={(e) => cambiarMarca({ plataforma: e.target.value })} />
              </div>
            </div>
            <div className="fila">
              <div>
                <label>Cierre · primera línea</label>
                <input
                  value={textos.marca.cierre.lugar}
                  onChange={(e) => cambiarMarca({ cierre: { ...textos.marca.cierre, lugar: e.target.value } })}
                />
              </div>
              <div>
                <label>Cierre · segunda línea</label>
                <input
                  value={textos.marca.cierre.invitacion}
                  onChange={(e) => cambiarMarca({ cierre: { ...textos.marca.cierre, invitacion: e.target.value } })}
                />
              </div>
            </div>
            <label>Fuentes que puede citar, separadas por coma</label>
            <input
              value={textos.marca.fuentes.join(', ')}
              onChange={(e) => cambiarMarca({ fuentes: e.target.value.split(',').map((f) => f.trimStart()) })}
            />
          </fieldset>

          <fieldset className="identidad__seccion" data-diseno>
            <legend>Diseño de los slides</legend>
            <p className="pista">
              Claude lo saca de los materiales al escribir la identidad. Aquí se corrige a mano —no gasta tokens— o se
              le pide solo el diseño, sin volver a escribir lo demás.
            </p>
            <div className="fila">
              <div>
                <label>Plantilla</label>
                <select
                  value={textos.diseno.plantilla}
                  onChange={(e) => cambiarDiseno({ plantilla: e.target.value as Diseno['plantilla'] })}
                >
                  <option value="plana">plana — el diseño de esta cuenta</option>
                  <option value="clinica">clinica — la del Dr. Edwin, medida a mano</option>
                </select>
              </div>
              <div>
                <label>Logo</label>
                <label className="boton sm">
                  {subiendoLogo ? 'Subiendo…' : logo ? 'Cambiar logo' : 'Subir logo'}
                  <input
                    type="file"
                    hidden
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    data-logo
                    onChange={(e) => void subirLogo(e.target.files?.[0])}
                  />
                </label>
              </div>
            </div>
            {textos.diseno.plantilla === 'plana' ? (
              <>
                <div className="fila">
                  <Color etiqueta="Fondo" valor={textos.diseno.fondo} onCambio={(fondo) => cambiarDiseno({ fondo })} />
                  <Color etiqueta="Texto" valor={textos.diseno.tinta} onCambio={(tinta) => cambiarDiseno({ tinta })} />
                </div>
                <div className="fila">
                  <div>
                    <label>Tipografía de títulos</label>
                    <input
                      value={textos.diseno.tituloFuente}
                      onChange={(e) => cambiarDiseno({ tituloFuente: e.target.value })}
                    />
                  </div>
                  <div>
                    <label>Tipografía del texto</label>
                    <input value={textos.diseno.textoFuente} onChange={(e) => cambiarDiseno({ textoFuente: e.target.value })} />
                  </div>
                </div>
                <div className="fila">
                  <div>
                    <label>Tipografía del número</label>
                    <input
                      value={textos.diseno.numeroFuente}
                      onChange={(e) => cambiarDiseno({ numeroFuente: e.target.value })}
                    />
                  </div>
                  <div>
                    <label>
                      <input
                        type="checkbox"
                        checked={textos.diseno.tituloMayusculas}
                        onChange={(e) => cambiarDiseno({ tituloMayusculas: e.target.checked })}
                      />{' '}
                      Títulos en mayúsculas
                    </label>
                  </div>
                </div>

                <label>Colores de fondo que usa la cuenta — el primero es el de siempre</label>
                {textos.diseno.paletas.map((p, i) => (
                  <div className="fila identidad__paleta" key={i}>
                    <select
                      value={p.nombre}
                      onChange={(e) => cambiarPaleta(i, { nombre: e.target.value as NombrePaleta })}
                    >
                      {NOMBRES_PALETA.map((n) => (
                        <option key={n} value={n}>
                          {delaClinica[n].nombre}
                        </option>
                      ))}
                    </select>
                    <Color valor={p.color} onCambio={(color) => cambiarPaleta(i, { color })} />
                    <input
                      value={p.cuando}
                      placeholder="para qué temas va"
                      onChange={(e) => cambiarPaleta(i, { cuando: e.target.value })}
                    />
                    <button
                      className="boton sm"
                      onClick={() => cambiarDiseno({ paletas: textos.diseno.paletas.filter((_, j) => j !== i) })}
                    >
                      quitar
                    </button>
                  </div>
                ))}
                <button
                  className="boton sm"
                  onClick={() => {
                    const libre = NOMBRES_PALETA.find((n) => !textos.diseno.paletas.some((p) => p.nombre === n)) ?? 'azul';
                    cambiarDiseno({
                      paletas: [
                        ...textos.diseno.paletas,
                        { nombre: libre, color: textos.diseno.fondo, tinta: '', cuando: 'El color de la cuenta.' },
                      ],
                    });
                  }}
                >
                  + otro color
                </button>
              </>
            ) : null}

            <VistaPrevia proyecto={proyectoInicial} textos={textos} logo={logo} />
            <p className="pista">La vista previa cambia al momento; los slides de verdad, al guardar.</p>

            {textos.diseno.plantilla === 'plana' ? (
              <div className="identidad__ajuste" data-ajuste>
                <label htmlFor="pedido-diseno">Pedirle a Claude solo el diseño</label>
                <textarea
                  id="pedido-diseno"
                  rows={2}
                  value={pedidoDiseno}
                  placeholder="El rosa más fuerte, títulos en mayúsculas, una letra menos redonda…"
                  onChange={(e) => setPedidoDiseno(e.target.value)}
                />
                <label>
                  <input type="checkbox" checked={conReferencias} onChange={(e) => setConReferencias(e.target.checked)} />{' '}
                  Mirar otra vez las imágenes de los materiales{' '}
                  <span className="pista">(más tokens; sin marcar, solo lee lo que escribiste)</span>
                </label>
              </div>
            ) : null}
            <div className="identidad__acciones">
              {textos.diseno.plantilla === 'plana' ? (
                <button
                  className="boton"
                  data-ajustar-diseno
                  disabled={ajustando || (!conReferencias && !pedidoDiseno.trim())}
                  onClick={() => void ajustarDiseno()}
                >
                  {ajustando ? 'Claude está ajustando…' : 'Ajustar el diseño con Claude'}
                </button>
              ) : null}
              <button
                className="boton"
                data-guardar-diseno
                disabled={guardandoDiseno || !disenoSinGuardar}
                onClick={() => void guardarDiseno()}
              >
                {guardandoDiseno ? 'Guardando…' : disenoSinGuardar ? 'Guardar diseño' : 'Diseño guardado'}
              </button>
            </div>
            {ajuste ? <p className={ajuste.tipo === 'error' ? 'aviso' : 'pista pista--ok'}>{ajuste.texto}</p> : null}
          </fieldset>

          {PIEZAS.map((p) => (
            <details key={p.clave} className="identidad__pieza">
              <summary>
                <code>{p.titulo}</code> <span className="pista">{p.que}</span>
              </summary>
              <textarea
                rows={p.clave === 'voz' ? 22 : 10}
                className="identidad__md"
                value={textos[p.clave]}
                onChange={(e) => cambiarTexto(p.clave, e.target.value)}
              />
            </details>
          ))}

          <p className="pista">
            <Link href={`/${proyecto}`}>← los carruseles de esta cuenta</Link>
          </p>
        </div>
      </details>
    </div>
  );
}

function Color({ etiqueta, valor, onCambio }: { etiqueta?: string; valor: string; onCambio: (v: string) => void }) {
  const valido = /^#[0-9a-fA-F]{6}$/.test(valor);
  return (
    <div className="identidad__color">
      {etiqueta ? <label>{etiqueta}</label> : null}
      <span>
        <input type="color" value={valido ? valor : '#000000'} onChange={(e) => onCambio(e.target.value.toUpperCase())} />
        <input value={valor} onChange={(e) => onCambio(e.target.value)} aria-invalid={!valido} />
      </span>
    </div>
  );
}

const ANCHO_PREVIA = 220;

/** Unos slides de muestra con el diseño como va quedando, antes de guardarlo. */
function VistaPrevia({ proyecto, textos, logo }: { proyecto: Proyecto; textos: Textos; logo: string }) {
  const hex = (c: string, otro: string) => (/^#[0-9a-fA-F]{6}$/.test(c) ? c : otro);
  const d = textos.diseno;
  const fondo = hex(d.fondo, '#4FA0FB');
  const tinta = hex(d.tinta, '#FFFFFF');
  const marca: Proyecto = {
    ...proyecto,
    nombre: textos.marca.nombre,
    usuario: textos.marca.usuario,
    ciudad: textos.marca.ciudad,
    plataforma: textos.marca.plataforma,
    cierre: textos.marca.cierre,
    logo,
    plantilla: d.plantilla,
    ...(d.plantilla === 'plana'
      ? {
          diseno: {
            fondo,
            tinta,
            tituloFuente: d.tituloFuente || 'Bagel Fat One',
            tituloMayusculas: d.tituloMayusculas,
            textoFuente: d.textoFuente || 'Figtree',
            numeroFuente: d.numeroFuente || 'Fredoka',
            paletas: d.paletas
              .filter((p) => /^#[0-9a-fA-F]{6}$/.test(p.color))
              .map((p) => ({ nombre: p.nombre, color: p.color, cuando: p.cuando, ...(p.tinta ? { tinta: hex(p.tinta, tinta) } : {}) })),
          },
        }
      : {}),
  };
  const { Slide } = plantillaDe(marca.plantilla);
  const slides: Slide[] = [
    { tipo: 'portada', titulo: 'La **portada**', pregunta: '¿Así se ve?' } as Slide,
    {
      tipo: 'contenido',
      titulo: 'Un título de muestra',
      bajada: '',
      cuerpo: 'Así se ve el texto de un slide con el diseño de la cuenta, con sus colores y sus tipografías.',
      visual: { clase: 'icono', slug: 'appointment-calendar' },
    } as Slide,
    { tipo: 'lista', titulo: '*Tres cosas que sí:*', puntos: ['La primera.', 'La **segunda**.', 'La tercera.'] } as Slide,
    { tipo: 'cierre', frase: 'Una frase de **cierre**' } as Slide,
  ];
  const zoom = ANCHO_PREVIA / 1080;
  const colores = d.plantilla === 'plana' && d.paletas.length ? d.paletas.map((p) => p.nombre) : [undefined];
  return (
    <div className="identidad__previa" data-previa>
      {colores.slice(0, 3).map((paleta, k) =>
        slides.map((_, i) =>
          k > 0 && i !== 1 ? null : (
            <div key={`${k}-${i}`} className="miniatura" style={{ width: ANCHO_PREVIA, height: Math.round(1350 * zoom) }}>
              <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', width: 1080 }}>
                <Slide slides={slides} indice={i} marca={marca} paleta={paleta} />
              </div>
            </div>
          ),
        ),
      )}
    </div>
  );
}
