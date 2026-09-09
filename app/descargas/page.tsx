import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import Link from 'next/link';
import { PrepararCelular } from '@/app/_componentes/PrepararCelular';
import { listarPosts } from '@/lib/posts';
import { soloLectura } from '@/lib/soloLectura';

/**
 * /descargas — bajar los slides uno por uno desde el teléfono.
 *
 * ── Para qué existe ─────────────────────────────────────────────────────────
 * Para publicar en Instagram desde el celular. El editor y la exportación se
 * quedan en la máquina —en Vercel el disco es de solo lectura y no hay un
 * Chromium que abrir—, así que el despliegue no genera nada: sirve los PNG que
 * `npm run celular <slug>` dejó en public/descargas/.
 *
 * ── Por qué cada slide es un enlace y no un botón ───────────────────────────
 * Porque en el teléfono el gesto que funciona en todos lados es mantener
 * pulsada una imagen y darle a «Guardar en Fotos». `<a download>` es
 * irregular en Safari de iOS, y un botón con JavaScript lo es más. Un enlace a
 * un PNG de verdad, en cambio, se abre y se guarda igual en Android y en
 * iPhone. El `download` va puesto para los navegadores que lo respetan, pero
 * nada depende de él.
 *
 * ── La advertencia de caducado ──────────────────────────────────────────────
 * Un PNG exportado es una copia, y en cuanto se edita el carrusel deja de
 * corresponder. Entregar callado un slide viejo es la clase de error que no se
 * ve hasta que está publicado, así que cada exportación guarda la huella del
 * post y aquí se compara con la de ahora. Si no coinciden, se dice.
 */

export const dynamic = 'force-dynamic';

type Entrada = {
  slug: string;
  tema: string;
  estado: string;
  exportado: string;
  huella: string;
  slides: string[];
};

async function huellaActual(slug: string) {
  const crudo = await readFile(join(process.cwd(), 'content', 'posts', `${slug}.json`), 'utf8').catch(() => null);
  return crudo === null ? null : createHash('sha1').update(crudo).digest('hex').slice(0, 12);
}

export default async function Descargas() {
  const crudo = await readFile(join(process.cwd(), 'public', 'descargas', 'indice.json'), 'utf8').catch(() => '[]');
  const entradas: Entrada[] = JSON.parse(crudo);

  const conEstado = await Promise.all(
    entradas.map(async (e) => ({ ...e, alDia: (await huellaActual(e.slug)) === e.huella })),
  );

  /*
   * El panel para mandar otro carrusel solo se arma en tu máquina. En Vercel
   * exportar es imposible —no hay Chromium y el disco es de solo lectura—, y
   * pintar botones que no pueden funcionar es peor que no pintarlos.
   */
  const filas = soloLectura
    ? []
    : (await listarPosts())
        .filter((p) => !p.slug.startsWith('laboratorio-'))
        .map((p) => {
          const ya = conEstado.find((e) => e.slug === p.slug);
          return {
            slug: p.slug,
            tema: p.tema,
            estado: p.estado,
            preparado: Boolean(ya),
            alDia: Boolean(ya?.alDia),
          };
        });

  return (
    <main className="descargas">
      <header>
        <h1>Descargas</h1>
        <p>
          Mantén pulsada una imagen y dale a <strong>Guardar en Fotos</strong>. Están a 1080 × 1350, el
          tamaño nativo de Instagram.
        </p>
      </header>

      {filas.length > 0 ? <PrepararCelular filas={filas} /> : null}

      {/*
        El mensaje cambia según dónde se lea, porque el consejo no sirve igual.
        En el teléfono, «corre npm run celular» no se puede seguir: lo que hay
        que decir es dónde se hace y que después falta un push.
      */}
      {conEstado.length === 0 ? (
        <p className="descargas__vacio">
          {soloLectura ? (
            <>
              Todavía no hay ninguno preparado. Los slides se exportan desde la computadora —en{' '}
              <strong>/descargas</strong>, con el botón de cada carrusel— y aparecen aquí después del{' '}
              <code>git push</code>.
            </>
          ) : (
            <>
              Todavía no hay ninguno. Ábrelo en <strong>Mandar un carrusel al teléfono</strong>, aquí
              arriba, o corre <code>npm run celular &lt;slug&gt;</code>.
            </>
          )}
        </p>
      ) : null}

      {conEstado.map((e) => (
        <section key={e.slug}>
          <h2>{e.tema}</h2>
          <p className="descargas__meta">
            <em data-estado={e.estado}>{e.estado}</em> · {e.slides.length} slides · exportado{' '}
            {new Date(e.exportado).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}
          </p>

          {/* Lo importante de esta pantalla: si el carrusel cambió después de
              exportarse, lo que hay abajo ya no es el carrusel. */}
          {!e.alDia ? (
            <p className="descargas__viejo">
              Este carrusel se editó después de exportarse. Vuelve a correr{' '}
              <code>npm run celular {e.slug}</code> antes de publicarlo.
            </p>
          ) : null}

          <ol className="descargas__slides">
            {e.slides.map((nombre, i) => (
              <li key={nombre}>
                <a href={`/descargas/${e.slug}/${nombre}`} download={`${e.slug}-${nombre}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/descargas/${e.slug}/${nombre}`} alt={`Slide ${i + 1} de ${e.tema}`} loading="lazy" />
                  <span>{i + 1}</span>
                </a>
              </li>
            ))}
          </ol>
        </section>
      ))}

      <p className="descargas__volver">
        <Link href="/">← todos los carruseles</Link>
      </p>
    </main>
  );
}
