import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Identidad } from '@/app/_componentes/Identidad';
import { remoto } from '@/lib/almacen';
import { leerCuestionario, leerTextos, listarMateriales } from '@/lib/identidad';
import { hayProyecto, leerProyecto } from '@/lib/posts';

/**
 * /<proyecto>/identidad — quién es la cuenta, y de ahí cómo escribe la IA.
 * Ver app/_componentes/Identidad.tsx y lib/identidad.ts.
 */
export const dynamic = 'force-dynamic';

export default async function PaginaIdentidad({
  params,
  searchParams,
}: {
  params: Promise<{ proyecto: string }>;
  searchParams: Promise<{ nuevo?: string }>;
}) {
  const { proyecto } = await params;
  if (!(await hayProyecto(proyecto))) notFound();
  const { nuevo } = await searchParams;

  const [marca, respuestas, materiales, textos] = await Promise.all([
    leerProyecto(proyecto),
    leerCuestionario(proyecto),
    listarMateriales(proyecto),
    leerTextos(proyecto),
  ]);

  return (
    <>
      <header className="cromo">
        <h1>Identidad · {marca.usuario}</h1>
        <p>proyectos/{proyecto}/identidad.md</p>
        <span className="sep" />
        <Link className="boton" href={`/${proyecto}`}>
          Carruseles →
        </Link>
      </header>
      <main className="banco">
        <Identidad
          proyectoInicial={marca}
          respuestasIniciales={respuestas}
          materialesIniciales={materiales}
          textosIniciales={textos}
          nuevo={nuevo === '1'}
          remoto={remoto}
        />
      </main>
    </>
  );
}
