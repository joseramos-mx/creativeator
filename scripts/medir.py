# -*- coding: utf-8 -*-
"""
scripts/medir.py — compara los renders contra las capturas publicadas.

Corre despues de `node scripts/comparar.mjs`. Toma cada PNG de
salidas/comparar/ y su captura de public/referencia/, detecta las bandas de
tinta de las dos (cada renglon de texto, cada foto, cada pieza del cromo) y las
empareja de arriba hacia abajo.

El resultado dice, renglon por renglon, cuantos pixeles se corrio el diseno y
cuanto cambio de ancho. Es lo que convierte "se ve parecido" en un numero.
"""
import io
import json
import os
import sys

import numpy as np
from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# El post de control. Las capturas de public/referencia/ son de este carrusel
# publicado, y se publicó en azul: si alguien le cambia la paleta, esta
# comparacion deja de medir el diseno y empieza a medir el cambio de color, sin
# que nada avise. Por eso se comprueba antes de comparar nada.
CONTROL = "impetigo-regreso-a-clases"
PALETA_CONTROL = "azul"
RENDER = os.path.join(RAIZ, "salidas", "comparar")
REF = os.path.join(RAIZ, "public", "referencia")
AZUL = np.array([0x51, 0xA2, 0xFF])

PAREJAS = [
    ("00.png", "portada.png", "portada"),
    ("01.png", "contenido-01.png", "contenido 01 (foto)"),
    ("02.png", "contenido-02.png", "contenido 02 (icono)"),
    ("03.png", "contenido-03.png", "contenido 03 (emblema + foto)"),
    ("04.png", "lista-04.png", "lista 04"),
    ("05.png", "contenido-05.png", "contenido 05 (icono)"),
    ("06.png", "cierre-06.png", "cierre 06"),
]


def bandas(ruta, umbral=60, hueco_min=6):
    """Franjas horizontales con tinta, en coordenadas de 1080x1350."""
    im = Image.open(ruta).convert("RGB")
    if im.size != (1080, 1350):
        im = im.resize((1080, 1350), Image.LANCZOS)
    a = np.asarray(im).astype(int)
    m = np.abs(a - AZUL).sum(axis=2) > umbral

    dentro = (m.sum(axis=1) / 1080.0) > 0.0008
    seg, ini, hueco = [], None, 0
    for y, v in enumerate(dentro):
        if v:
            if ini is None:
                ini = y
            hueco = 0
        elif ini is not None:
            hueco += 1
            if hueco > hueco_min:
                seg.append((ini, y - hueco))
                ini = None
    if ini is not None:
        seg.append((ini, len(dentro) - 1))

    salida = []
    for y0, y1 in seg:
        xs = np.nonzero(m[y0:y1 + 1].sum(axis=0) > 0)[0]
        if len(xs):
            salida.append((y0, y1, int(xs.min()), int(xs.max())))
    return salida


def empareja(a, b, tolerancia=90):
    """Empareja franjas por cercania vertical, en orden."""
    pares, j = [], 0
    for fa in a:
        mejor, dist = None, tolerancia
        for k in range(j, len(b)):
            d = abs(b[k][0] - fa[0])
            if d < dist:
                mejor, dist = k, d
            elif b[k][0] - fa[0] > tolerancia:
                break
        if mejor is None:
            pares.append((fa, None))
        else:
            pares.append((fa, b[mejor]))
            j = mejor + 1
    return pares


def revisar_control():
    """El post de control tiene que seguir en la paleta con la que se publico."""
    ruta = os.path.join(RAIZ, "proyectos", "dr-edwin", "posts", CONTROL + ".json")
    try:
        with io.open(ruta, encoding="utf-8") as f:
            post = json.load(f)
    except Exception as e:
        return "no pude leer %s: %s" % (CONTROL, e)

    paleta = post.get("paleta", PALETA_CONTROL)
    if paleta != PALETA_CONTROL:
        return (
            "el post de control esta en la paleta '%s' y las capturas de\n"
            "   public/referencia/ se publicaron en '%s'. Esta comparacion ya no\n"
            "   mide el diseno: mide el cambio de color. Devuelvelo a '%s' o\n"
            "   cambia CONTROL por otro post que si tenga capturas publicadas."
            % (paleta, PALETA_CONTROL, PALETA_CONTROL)
        )
    return None


def main():
    problema = revisar_control()
    if problema:
        print("ALTO: " + problema)
        sys.exit(1)
    print("control: %s en paleta %s\n" % (CONTROL, PALETA_CONTROL))

    solo = sys.argv[1] if len(sys.argv) > 1 else None
    peor = 0.0
    for render, ref, etiqueta in PAREJAS:
        if solo and solo not in render:
            continue
        pr, pf = os.path.join(RENDER, render), os.path.join(REF, ref)
        if not os.path.exists(pr):
            print("falta %s; corre antes: node scripts/comparar.mjs" % render)
            continue

        br, bf = bandas(pr), bandas(pf)
        print("\n== %s   (%d franjas en el render, %d en la referencia)" % (etiqueta, len(br), len(bf)))
        for (r, f) in empareja(br, bf):
            if f is None:
                print("   y %4d..%-4d  x %4d..%-4d   -- sin pareja en la referencia" % r)
                continue
            dy, dan = r[0] - f[0], (r[3] - r[2]) - (f[3] - f[2])
            aviso = "  <<<" if abs(dy) > 12 or abs(dan) > 24 else ""
            peor = max(peor, abs(dy))
            print("   y %4d  (ref %4d, %+4d)   ancho %4d (ref %4d, %+4d)%s"
                  % (r[0], f[0], dy, r[3] - r[2], f[3] - f[2], dan, aviso))
    print("\nDesplazamiento vertical maximo: %d px" % peor)


if __name__ == "__main__":
    main()
