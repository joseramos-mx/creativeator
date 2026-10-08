'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

/** Lo que va en la URL: minúsculas, sin acentos, guiones. */
function aId(nombre: string) {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/^(dr|dra)\.?\s+/, '$1-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

/**
 * El alta: nombre e id, y a la página de identidad. No pregunta más aquí a
 * propósito: el cuestionario de verdad está allá, junto a los materiales, y
 * repetirlo aquí sería contestarlo dos veces.
 */
export function NuevoProyecto() {
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [id, setId] = useState('');
  const [idTocado, setIdTocado] = useState(false);
  const [error, setError] = useState<string>();
  const [creando, setCreando] = useState(false);

  const idFinal = idTocado ? id : aId(nombre);

  async function crear() {
    setCreando(true);
    setError(undefined);
    try {
      const r = await fetch('/api/proyectos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: idFinal, nombre }),
      });
      const cuerpo = await r.json();
      if (!r.ok) throw new Error(cuerpo.error);
      router.push(`/${cuerpo.id}/identidad?nuevo=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo dar de alta.');
      setCreando(false);
    }
  }

  return (
    <div className="tarjeta identidad" data-nuevo>
      <div className="tarjeta__cuerpo">
        <label htmlFor="n-nombre">¿Cómo se llama la cuenta?</label>
        <input id="n-nombre" value={nombre} placeholder="Dra. Mildreth …, Adimex…" onChange={(e) => setNombre(e.target.value)} />
        <label htmlFor="n-id">Su id — lo que va en la URL</label>
        <input
          id="n-id"
          value={idFinal}
          onChange={(e) => {
            setIdTocado(true);
            setId(e.target.value);
          }}
        />
        <p className="pista">
          Se abre en <code>/{idFinal || '…'}</code>. Solo minúsculas, números y guiones.
        </p>
        {error ? <p className="aviso">{error}</p> : null}
        <div className="identidad__acciones">
          <button className="boton" data-crear onClick={() => void crear()} disabled={creando || !idFinal}>
            {creando ? 'Creando…' : 'Crear y conocer la cuenta →'}
          </button>
          <Link className="boton" href="/">
            Cancelar
          </Link>
        </div>
      </div>
    </div>
  );
}
