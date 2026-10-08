import { NuevoProyecto } from '@/app/_componentes/NuevoProyecto';
import { soloLectura } from '@/lib/soloLectura';

/**
 * /nuevo — dar de alta una cuenta. Solo pide el nombre; lo demás se pregunta
 * en /<id>/identidad, adonde lleva al terminar.
 */
export default function Nuevo() {
  return (
    <>
      <header className="cromo">
        <h1>Nuevo proyecto</h1>
      </header>
      <main className="banco">
        {soloLectura ? (
          <p className="aviso">Este despliegue es de solo lectura: las cuentas se dan de alta en tu computadora.</p>
        ) : (
          <NuevoProyecto />
        )}
      </main>
    </>
  );
}
