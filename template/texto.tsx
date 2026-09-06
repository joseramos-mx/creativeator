import type { ReactNode } from 'react';

/**
 * El marcado de la plantilla. Dos marcas, no diez:
 *
 *   *así*    → serif itálica en crema
 *   **así**  → sans bold en crema
 *   resto    → sans light
 *   salto    → renglón nuevo (el CSS del título va en white-space: pre-wrap)
 *
 * Esto es lo que hace que redactar sea escribir texto y no editar diseño, y lo
 * que permite que la IA devuelva títulos ya formateados. No lo cambies por
 * Markdown completo: dos marcas se recuerdan, diez no.
 */
export function marcado(texto: string): ReactNode {
  const partes = texto.split(/(\*\*[\s\S]+?\*\*|\*[\s\S]+?\*)/g);

  return partes.map((parte, i) => {
    if (!parte) return null;
    if (parte.startsWith('**') && parte.endsWith('**') && parte.length > 4) {
      return <b key={i}>{parte.slice(2, -2)}</b>;
    }
    if (parte.startsWith('*') && parte.endsWith('*') && parte.length > 2) {
      return <i key={i}>{parte.slice(1, -1)}</i>;
    }
    return <span key={i}>{parte}</span>;
  });
}

/** Renglones que escribió el autor. El ajuste automático los respeta. */
export function renglones(texto: string): number {
  return texto.split('\n').length;
}

/** El mismo texto sin marcas, para títulos de tarjeta y nombres de archivo. */
export function sinMarcas(texto: string): string {
  return texto.replace(/\*\*?/g, '').replace(/\n/g, ' ').trim();
}
