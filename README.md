# Carruseles · @alergo_derma

Genera los carruseles de Instagram de la cuenta a partir de una plantilla fija.
Corre en tu computadora, no en internet.

**Vas en la fase 5 de 6.** Ya existen el diseño, el contenido en archivos, la
exportación a PNG, el editor y la librería de íconos. Falta la redacción con IA.

---

## Arrancar

```bash
npm install        # solo la primera vez
npm run dev
```

Abre <http://localhost:3000>. Si el puerto está ocupado, Next.js te dice en la
terminal cuál usó.

`npm run dev` levanta dos cosas: el servidor y la carpeta vigilada de íconos.
Si solo quieres el servidor, `npm run dev:solo`.

| Página | Qué es |
|---|---|
| `/` | La lista de carruseles, con la portada de cada uno. |
| `/post/<slug>` | El editor: formulario a la izquierda, carrusel a la derecha. |
| `/plantilla` | El banco de pruebas: aquí se prueba un cambio de diseño sin tocar contenido. |
| `/render/<slug>/<n>` | Un slide solo, sin nada alrededor. No es para ti: es la que captura Playwright. |

| Tecla | Qué hace |
|---|---|
| `G` | Rejilla: márgenes, área de contenido y las franjas donde Instagram encima su interfaz. |
| `R` | Encima la captura del post publicado, en modo diferencia. |
| `[` `]` | Sube y baja la opacidad de esa captura (en el banco). |

---

## Un carrusel es un archivo

Cada post vive en `content/posts/<slug>.json`. No hay base de datos: el sistema
de archivos es la base de datos y git es el historial. Para agregar uno a mano,
copia otro, cámbiale el `slug` y los textos, y aparece solo en la lista.

```json
{
  "slug": "impetigo-regreso-a-clases",
  "tema": "Impétigo en el regreso a clases",
  "creado": "2026-09-01",
  "estado": "publicado",
  "copy": "El texto que va debajo del carrusel en Instagram.",
  "pilar": "prevención",
  "objetivo": "que reconozcan el impétigo antes de que se riegue",
  "frase": "Costras color miel en la cara de tu hijo",
  "nota": "publicar la primera semana de agosto",
  "hashtags": ["#impetigo", "#dermatologiapediatrica", "#regresoaclases",
               "#dermatologodurango", "#pielsana"],
  "slides": [
    { "tipo": "portada", "titulo": "*La infección de*\nRegreso **a clases**",
      "pregunta": "¿Qué es el impétigo?", "foto": "/media/…/portada.jpg" },
    { "tipo": "contenido", "titulo": "…", "bajada": "…", "cuerpo": "…",
      "visual": { "clase": "foto", "src": "/media/…/01.jpg" },
      "fuente": "Cleveland Clinic." },
    { "tipo": "lista", "titulo": "…", "puntos": ["…", "…", "…", "…"] },
    { "tipo": "cierre" }
  ]
}
```

Cosas que conviene saber del formato:

- **Cada tipo de slide tiene sus campos y no acepta los del otro.** Si le pones
  `puntos` a un slide de contenido, el archivo no pasa y la app te dice el campo
  exacto en vez de pintar la página a medias.
- **El cierre no guarda nada.** Sale todo de `content/marca.json`, así que el día
  que cambies de ciudad o de plataforma de citas se corrige en un solo lugar y se
  arregla el archivo histórico completo.
- **Las rutas de imagen son locales**, siempre dentro de `public/`. Una URL
  externa es un error de validación a propósito: los enlaces caducan y el PNG
  sale con un hueco meses después.
- **`estado`** es `borrador`, `aprobado` o `publicado`. Sirve para saber qué
  falta revisar del mes.
- **`overrides`** es la excepción de un slide: `offsetY`, `tituloPx`, `cuerpoPx`,
  `mediaAncho`, `mediaAlto`. Vive en el contenido, nunca en los tokens. Si un
  slide junta muchos, la señal es que el token está mal.
- **`pilar`, `objetivo`, `nota` y `hashtags`** salen del brief y no se pintan en
  ningún slide. `pilar` es la línea editorial, y sirve para no repetir eje dos
  veces en el mes. `objetivo` es la acción que se busca —guardar, compartir,
  agendar— y decide a cuál de los cierres del copy se le carga la mano.
  `nota` es el gancho de calendario: qué hace que toque publicarlo ahora.
- **`frase`** sí se pinta: es la línea grande del slide de cierre, y acepta el
  marcado de la plantilla. Es lo único que ese slide no toma de la marca.

El esquema está en `lib/schema.ts` y se usa en los tres momentos: al leer un
archivo, al guardar desde el editor y al validar lo que devuelva el modelo al
redactar (fase 6). Es el mismo en los tres a propósito.

En `content/ejemplos/impetigo-brief.md` está el brief de una publicación real,
con su copy. Sirve de dos cosas: de formato de referencia para el importador, y
de recordatorio de que **el brief no es el arte final**. En ese ejemplo el título
de la portada acabó siendo otro, los íconos que proponía no son los que se
publicaron y la sección de cierre describe una plantilla anterior.

---

## El editor

Formulario a la izquierda, carrusel a la derecha. Cuatro cosas son las que se
notan al usarlo todos los días:

**La imagen se suelta sobre el slide, no sobre un campo.** Arrastra la foto y
suéltala encima del slide de la derecha. El slide se ilumina cuando la va a
aceptar; el de cierre y el de lista no la aceptan y no se iluminan. La imagen se
guarda en `public/media/<slug>/`, con el nombre normalizado y bajada a 1600 px
de ancho.

**No hay botón de guardar.** Se guarda solo, 600 ms después de la última tecla,
y el indicador de arriba dice en qué va. Si el guardado falla —porque el
contenido dejó de ser válido, por ejemplo—, lo dice ahí mismo con el motivo.

**Cuando un texto no cabe, el aviso dice qué hacer.** Si el ajuste automático
llegó al mínimo, la tarjeta del slide avisa: *"hay que recortar el título y el
cuerpo"*. No dice que se encogió la letra, que es lo que pasó pero no lo que
resuelve el problema.

**Las flechas empujan el slide.** Haz clic en un título, un texto o una imagen y
usa las teclas. Solo en desarrollo:

| Tecla | Qué hace |
|---|---|
| `↑` `↓` | Sube y baja el bloque (`offsetY`). Con la imagen seleccionada, cambia su alto. |
| `+` `−` | Cambia el tamaño de lo seleccionado: título, cuerpo o imagen. |
| `Shift` | Multiplica el paso por diez. |
| `Esc` | Suelta la selección. |

Todo eso escribe en `overrides`, nunca en los tokens. Cuando el valor vuelve a
coincidir con el de la plantilla, el override desaparece del JSON en vez de
quedarse escrito. Y cuando un slide junta tres o más, la tarjeta avisa: si te
pasa en varios slides, lo que está mal es el valor de la plantilla, no el slide.

### Importar un brief

En el panel, **Importar desde el brief**: pega el texto y sale el carrusel. No
reemplaza nada hasta que ves qué entendió y cuántos slides encontró; el brief se
escribe a mano y casi siempre trae alguna sorpresa.

El lector está en `lib/brief.ts` y aguanta cómo se escribe de verdad: encabezados
de Markdown con subtítulo, etiquetas con paréntesis (`Fuente (al pie):`), varias
etiquetas en un mismo renglón, valores entre comillas y renglones sueltos que son
notas para el diseñador y no campos. Para adaptarlo a otro formato solo hay que
tocar el diccionario `ETIQUETAS` del principio del archivo.

El copy sale entero de la sección `## Copy de la publicación`, y los cinco
hashtags del último renglón de ese copy.

---

## Los íconos

La librería vive en `public/iconos/`: cada ícono a 1024 px, su miniatura a 192 y
un `manifest.json` con las etiquetas de búsqueda.

**Para meter íconos**, dos caminos:

```bash
npm run iconos ~/Descargas/thiings   # una carpeta de golpe
```

o dejar caer el PNG en `iconos-entrada/` con el servidor corriendo: la carpeta
vigilada lo procesa en dos segundos y aparece en el buscador sin recargar nada.
Si prefieres que vigile directamente tus descargas:

```bash
ICONOS_ORIGEN=~/Descargas npm run dev
```

La carpeta propia es el valor por omisión a propósito: vigilar las descargas es
más cómodo, pero también significa que cualquier PNG que caiga ahí entra a la
librería. De todos modos solo entran los PNG con transparencia, que es lo que
distingue un ícono 3D de una captura de pantalla.

**Qué le hace a cada archivo**: normaliza el nombre a slug, recorta el margen
transparente y lo recentra sobre un lienzo cuadrado con 4 % de aire. Ese último
paso es el que importa: sin él, dos íconos puestos al mismo tamaño en CSS se ven
de tamaños distintos. Es incremental, así que correrlo dos veces no duplica nada.

**Para buscar**, en la tarjeta de un slide con ícono, el botón abre un modal con
la rejilla. Los nombres vienen en inglés y aquí se busca en español, así que cada
palabra arrastra sus sinónimos desde `content/sinonimos.json`, que se edita a
mano: "fiebre" encuentra el termómetro, "advertencia" encuentra la alerta. Los
últimos doce usados salen primero.

Cuando el brief o la IA sugieren un concepto, el buscador abre con esa palabra ya
escrita. Si no encuentra nada —pasa seguido: el brief pedía "magnifying glass" y
se publicó otra cosa— enseña la librería completa en vez de una rejilla vacía.

**Licencia.** Los íconos de Thiings son de pago para uso comercial y su licencia
prohíbe redistribuirlos. Por eso `public/iconos/*` está en `.gitignore` y solo se
versiona el manifiesto. Un consultorio publicando contenido de marca es uso
comercial: la vía gratuita no aplica ni ícono por ícono.

---

## Exportar

Desde `/post/<slug>`, el botón **Exportar carrusel (ZIP)**. Tarda unos segundos
por slide porque abre un navegador de verdad.

Te bajas un ZIP con `01.png` … `07.png` y el `copy.txt`. Los mismos
archivos quedan además en `salidas/<slug>/`, que suele ser más cómodo que
descomprimir.

Los PNG salen a **2160 × 2700**, el doble del lienzo. Instagram recomprime, y
entregarle el doble de píxeles conserva mucho mejor los bordes de la tipografía.

Por debajo es `POST /api/exportar`:

```jsonc
{ "slug": "impetigo-regreso-a-clases",
  "slides": [2, 5],   // opcional: posiciones, empezando en 1. La portada es la 1.
  "escala": 1 }       // opcional: 2 por omisión
```

Un solo slide responde el PNG; varios, el ZIP.

**Por qué Playwright y no una librería en el navegador.** `html2canvas` y
parecidas reimplementan el motor de render en JavaScript, y se rompen con
`clip-path`, con degradados, con `background-size: cover` y con las fuentes que
todavía no cargaron. Sirven para una vista previa rápida, no para el entregable.
El costo es que hace falta un proceso de Node, así que la app corre local. Para
el flujo de una persona eso no es una limitación, es una simplificación.

---

## Las dos verificaciones

```bash
node scripts/comparar.mjs 3000    # captura y compara
python scripts/medir.py           # el informe contra la referencia
```

**1. ¿Se parece a lo publicado?** El primer script captura el banco de pruebas a
tamaño real; `medir.py` lo compara contra las capturas de `public/referencia/` y
dice, renglón por renglón, cuántos píxeles se corrió el diseño. Es lo que
convierte "se ve parecido" en un número.

Esa comparación tiene un **post de control**: el de impétigo, que es de donde
salieron las capturas, y que se publicó en azul. `medir.py` lo comprueba antes
de medir nada y se detiene si alguien le cambió la paleta, porque entonces ya no
estaría midiendo el diseño sino el cambio de color.

**2. ¿El PNG es lo que vi?** El mismo script exporta el carrusel por la ruta real
de exportación —a escala 1, para que los dos lados midan lo mismo— y lo compara
píxel a píxel contra la vista previa.

Esta segunda es la que conviene vigilar. Si sale distinta, casi siempre es que el
ajuste automático de texto no corrió en `/render` y el PNG salió con la letra en
otro tamaño. El hook vive en `template/` y lo usan las dos rutas justamente para
que no pueda pasar, pero es el error clásico de este tipo de proyecto.

Siempre quedan unas decenas de píxeles de diferencia en el borde de un ícono
escalado y en el tramado de los degradados: son deltas de 1 a 6 sobre 255 que no
ve nadie. Por eso el veredicto no cuenta píxeles distintos sino píxeles que se
movieron más de 8, y avisa a partir de 400. Cuando el ajuste de verdad no corre,
el número se va a cientos de miles: no hay zona gris.

Los mapas de diferencias quedan en `salidas/verificar/diff-NN.png`, en rojo.

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
| Qué campos acepta un post | `lib/schema.ts` |
| Tu nombre, ciudad, plataforma de citas, logotipo | `content/marca.json` |
| El papel rasgado, la palomita y la flecha | `template/partes/` (van dibujados en línea) |
| El color de fondo y todo lo que va encima | `template/tokens.ts`, en `paletas` |

`tokens.ts` es la única fuente de verdad de los números. `plantilla.css` no tiene
ni un valor suelto: los lee de ahí a través de `template/variables.ts`.

### Las paletas

El fondo no es identidad de marca: lo decide el tema. En el JSON del post,
`paleta: "naranja"`, y el esquema lo valida contra las paletas que existen de
verdad, así que `"naraja"` falla al leer el archivo y no cuatro pasos después,
mirando el PNG ya exportado.

| Paleta | Cuándo |
|---|---|
| `azul` | Lo que no tiene color obvio: impétigo, dermatitis. **Es la respuesta por defecto**, no un relleno. |
| `naranja` | Sol, calor, verano, quemaduras, sudor. |
| `verde` | Plantas, polen, alergia estacional, primavera. |

**Por qué paletas cerradas y no un color libre.** Porque el fondo es lo de
menos: lo difícil es lo que va encima. Los tres fondos tienen la misma
luminancia, y por eso el contraste del título es 2.47:1 en las tres, idéntico.
Un hex por post rompería esa relación sin avisar.

Lo que sí cambia con el tono es la separación de color, y ahí cada paleta trae
su respuesta: el cuerpo y la bajada son tintes de su propio fondo, la tinta del
papel es su versión oscura, y la palomita cambia en la paleta verde, donde el
verde de siempre desaparecería.

**Agregar una paleta** es agregar una entrada en `paletas`. Lo único que hay que
respetar es la luminancia del fondo. `/plantilla` pinta el mismo carrusel en
todas, una debajo de otra, para revisarla antes de usarla; ese es el trato:
cada paleta se mira una vez, con contenido de verdad encima, y a partir de ahí
es una opción segura.

**Los íconos son el límite.** Los de Thiings traen color fijo y no se
recolorean, así que sobre un fondo de su mismo tono se funden. Dos cosas para
eso: la ingesta guarda el color dominante de cada uno, y el buscador pinta las
miniaturas sobre el fondo de la paleta del post y marca en ámbar las que se
pierden. Además, las paletas cálidas le ponen una sombra a los íconos, que los
despega por su silueta. La paleta azul no la lleva: es como está publicado el
archivo entero.

### El marcado de los títulos

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

El ajuste se recalcula cuando terminan de cargar las fuentes. Sin eso, el primer
cálculo mide con las métricas de la letra sustituta y el PNG puede salir con otro
tamaño que la vista previa, según quién gane la carrera.

---

## De dónde salen los valores del diseño

No están puestos a ojo. Se midieron sobre las siete capturas del carrusel de
impétigo que están en `public/referencia/`:

- Los **colores** son el color más repetido de cada zona de texto. Ahí salió que
  el azul del fondo es `#51A2FF`, que el cuerpo va en `#DBEAFE` y que la bajada
  va en `#EFF6FF`, que no es blanco.
- Los **tamaños de letra y el tracking** se resolvieron comparando la caja de
  tinta de cada renglón publicado contra la misma frase compuesta en Albert Sans.
  Cuatro renglones de cuerpo independientes dieron el mismo resultado —34 px y
  −0.012em—, que es lo que confirma que la tipografía de la cuenta es Albert Sans.
- El sistema tiene **dos tracking y nada más**: lo que se lee de corrido va casi
  neutro (−0.012em) y todo lo que es título o cromo va apretado (−0.06em). Ese
  apretón es el aire de la marca; si un título se ve suelto, revisa eso antes que
  nada.

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
| 1 · plantilla | ✅ Los tipos de slide y sus valores. |
| 2 · contenido | ✅ Los posts en `content/posts/*.json`, validados con Zod. |
| 3 · exportación | ✅ Los PNG a 2160×2700 y el ZIP con el copy. |
| 4 · editor | ✅ Dos columnas, arrastrar y soltar imágenes, ajuste fino sobre el canvas. |
| 5 · íconos | ✅ La librería alojada aquí, con ingesta, manifiesto y buscador. |
| 6 · redacción | Escribir el carrusel y el mes completo con la API de Anthropic. |

---

## Cosas que conviene saber

- **La llave de la API** (fase 6) va en `.env.local`, que no se sube a ningún
  lado. Solo se usa del lado del servidor.
- **Los íconos de Thiings** no se versionan: `public/iconos/*` está en
  `.gitignore` porque su licencia prohíbe redistribuirlos. Se versiona solo el
  manifiesto. Los once que hay ahora son de prueba.
- **Falta tu retrato** para el slide de cierre. Ponlo en
  `public/marca/retrato.jpg` y apunta ahí `retrato` en `content/marca.json`.
  Mientras tanto ese slide sale con el fondo café y el degradado, sin foto.
- **`salidas/` no se versiona.** Se regenera cada vez que exportas.
