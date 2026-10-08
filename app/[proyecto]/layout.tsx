import type { Metadata } from 'next';
import { existeProyecto, leerProyecto } from '@/lib/posts';

/** El título de la pestaña dice de qué cuenta es: con dos abiertas, se confunden. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ proyecto: string }>;
}): Promise<Metadata> {
  const { proyecto } = await params;
  if (!existeProyecto(proyecto)) return {};
  const marca = await leerProyecto(proyecto);
  return { title: `Carruseles · ${marca.usuario}` };
}

export default function LayoutDeProyecto({ children }: { children: React.ReactNode }) {
  return children;
}
