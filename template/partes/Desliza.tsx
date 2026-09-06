/** La palabra sobre la flecha curva. Se omite en el último slide. */
export function Desliza({ flecha, visible }: { flecha: string; visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="desliza">
      <span>DESLIZA</span>
      <img src={flecha} alt="" />
    </div>
  );
}
