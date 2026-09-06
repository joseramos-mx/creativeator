import Link from 'next/link';

/**
 * Portada de la aplicación. En la fase 2 esta página se vuelve la lista de
 * carruseles, con su miniatura, su estado y su fecha. Por ahora solo lleva al
 * banco de pruebas, que es lo único que existe.
 */
export default function Inicio() {
  return (
    <main className="banco">
      <h2>Fase 1 · la plantilla</h2>
      <p>
        Por ahora el proyecto es solo el diseño: los tipos de slide, los tokens y el ajuste
        automático de texto. Todavía no hay editor, ni exportación, ni redacción con IA.
      </p>
      <p>
        <Link className="boton" href="/plantilla">
          Ver la plantilla →
        </Link>
      </p>
    </main>
  );
}
