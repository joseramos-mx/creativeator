/** El usuario, centrado abajo. Aparece en todos los slides. */
export function Pie({ usuario }: { usuario: string }) {
  return <div className="pie">{usuario}</div>;
}
