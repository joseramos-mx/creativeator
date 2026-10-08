/** Numeración del slide, dos dígitos. La portada no lleva. */
export function Numero({ numero }: { numero: string | null }) {
  if (!numero) return null;
  return <div className="numero">{numero}</div>;
}
