# Carruseles · @alergo_derma

Genera los carruseles de Instagram de la cuenta a partir de una plantilla fija.
Corre en tu computadora, no en internet.

**Vas en la fase 1 de 6.** Por ahora existe el diseño: los tipos de slide, los
valores de la plantilla y el ajuste automático del texto. Todavía no hay editor,
ni exportación a PNG, ni redacción con IA.

---

## Arrancar

```bash
npm install        # solo la primera vez
npm run dev
```

Abre <http://localhost:3000/plantilla>. Si el puerto 3000 está ocupado, Next.js
te dice en la terminal cuál usó.

Esa página es el **banco de pruebas**: dos carruseles de mentira que ejercitan
todos los tipos de slide. Es donde se prueba un cambio de diseño sin tocar
contenido real.

| Tecla | Qué hace |
|---|---|
| `G` | Enciende la rejilla: márgenes, área de contenido y las franjas donde Instagram encima su propia interfaz. |
| `R` | Encima la captura del post ya publicado, en modo diferencia. Lo que coincide se apaga; lo que baila queda brillante. |
| `[` `]` | Sube y baja la opacidad de esa captura. |

Los botones de 34 %, 50 % y 100 % cambian el zoom. Para comparar de verdad, 100 %.

---

## Dónde se cambia cada cosa

Todo el diseño vive en `template/`. **Si quieres cambiar cómo se ve algo, la
respuesta siempre está dentro de esa carpeta.** Si para mover un título hay que
tocar `app/`, algo se rompió.

| Quiero cambiar… | Archivo |
|---|---|
| Un color, un tamaño de letra, un margen, una separación | `template/tokens.ts` |
| Cómo se acomodan las piezas de un slide | `template/plantilla.css` |
| Qué lleva cada tipo de slide | `template/slides/` |
| La cabecera, el pie, la flecha, la palomita, el papel | `template/partes/` |
| Tu nombre, ciudad, plataforma de citas, logotipo | `content/marca.json` |
| El papel rasgado, la palomita y la flecha (dibujos) | `npm run graficos` |

`tokens.ts` es la única fuente de verdad de los números. `plantilla.css` no tiene
ni un valor suelto: los lee de ahí a través de `template/variables.ts`. Cambias
el token y cambia en los dos lados.

### El marcado de los títulos

Los títulos mezclan tres estilos en un renglón. En vez de armar el diseño, se
escribe una sola cadena con dos marcas:

```
*así*      sale en serif itálica color crema
**así**    sale en negrita color crema
lo demás   sale en la sans ligera
salto      corta el renglón
```

Ejemplo real de la cuenta: `*La infección de*\nRegreso **a clases**`.

Dos marcas y ya. No son Markdown completo a propósito: dos se recuerdan, diez no.

### Cuando un texto no cabe

El texto pegado nunca mide lo que el diseño espera, así que antes de pintar se
ajusta solo, en pasos de 2 px:

1. **El título nunca rompe más renglones de los que escribiste.** Si escribiste
   un título de un renglón y no cabe, se achica; no se parte.
2. **El bloque completo cabe en el área.** Primero cede el cuerpo, que tiene más
   margen; el título solo si con eso no alcanzó.

Si un bloque llega al mínimo (título 44 px, cuerpo 26 px), el problema es que el
texto es largo: hay que recortarlo, no seguir encogiéndolo. A partir de la fase 4
el editor te lo va a marcar.

### Cuando un slide necesita una excepción

Para empujar algo en **un** slide sin tocar la plantilla existe `overrides`:
`offsetY` (subir o bajar el bloque), `tituloPx`, `cuerpoPx`, `mediaAncho`,
`mediaAlto`. Vive en el contenido del post, no en los tokens.

Si un slide junta muchos overrides, la señal es que el token está mal y conviene
subir el cambio a la plantilla.

---

## De dónde salen los valores del diseño

No están puestos a ojo. Se midieron sobre las siete capturas del carrusel de
impétigo que están en `public/referencia/`:

- Los **colores** son el color más repetido de cada zona de texto, no una
  estimación. Ahí salió que el azul del fondo es `#51A2FF`, que el cuerpo va en
  `#DBEAFE` y que la bajada va en `#EFF6FF`, que no es blanco.
- Los **tamaños de letra y el tracking** se resolvieron comparando la caja de
  tinta de cada renglón publicado contra la misma frase compuesta en Albert Sans.
  Cuatro renglones de cuerpo independientes dieron el mismo resultado —34 px y
  −0.012em—, que es lo que confirma que la tipografía de la cuenta es Albert Sans.
- El sistema tiene **dos tracking y nada más**: lo que se lee de corrido va casi
  neutro (−0.012em) y todo lo que es título o cromo va apretado (−0.06em). Ese
  apretón es el aire de la marca; si un título se ve suelto, revisa eso antes que
  nada.

Para volver a medir después de un cambio:

```bash
node scripts/comparar.mjs 3000   # captura los slides a tamaño real
python scripts/medir.py          # los compara contra las capturas publicadas
```

Te dice, renglón por renglón, cuántos píxeles se corrió el diseño. Es lo que
convierte "se ve parecido" en un número.

---

## Tipografías

Auto-alojadas en `public/fonts`, nunca desde internet: si la red tarda, el PNG
sale con la letra equivocada y nadie lo nota hasta que el post está publicado.

- **Albert Sans** (variable 100–900) y **Fraunces** — las del kit de marca.
- **Fraunces Italic** se bajó de Google Fonts, porque el kit traía solo la
  redonda y la itálica es la que aparece en los títulos. Licencia OFL, incluida
  en `public/fonts/OFL-Fraunces.txt`.

---

## Lo que falta y en qué orden viene

| Fase | Qué trae |
|---|---|
| 1 · plantilla | ✅ Los tipos de slide y sus valores. Estás aquí. |
| 2 · contenido | Los posts pasan a archivos `content/posts/*.json`, validados con Zod. |
| 3 · exportación | El botón que da los PNG a 1080×1350, capturados con Playwright. |
| 4 · editor | Dos columnas, arrastrar y soltar imágenes, ajuste fino sobre el canvas. |
| 5 · íconos | La librería de Thiings alojada aquí, con buscador. |
| 6 · redacción | Escribir el carrusel y el mes completo con la API de Anthropic. |

Al terminar cada fase tienes algo que puedes ver y usar.

---

## Cosas que conviene saber

- **La llave de la API** (fase 6) va en `.env.local`, que no se sube a ningún
  lado. Solo se usa del lado del servidor.
- **Los íconos de Thiings** no se versionan: `public/iconos/*` está en
  `.gitignore` porque su licencia prohíbe redistribuirlos. Se versiona solo el
  manifiesto. Los once que hay ahora son de prueba.
- **Las imágenes se guardan siempre** en `public/media/`. Nada de enlaces a
  Pinterest: caducan y el PNG sale con un hueco.
- **Falta tu retrato** para el slide de cierre. Ponlo en
  `public/marca/retrato.jpg` y apunta ahí `retrato` en `content/marca.json`.
  Mientras tanto ese slide sale con el fondo café y el degradado, sin foto.
