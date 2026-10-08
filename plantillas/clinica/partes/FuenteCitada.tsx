/** Solo en los slides que hacen una afirmación clínica. */
export function FuenteCitada({ fuente }: { fuente?: string }) {
  if (!fuente) return null;
  return <div className="fuente">Fuente: {fuente}</div>;
}
