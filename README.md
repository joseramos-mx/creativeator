# Carruseles · @alergo_derma

Genera los carruseles de Instagram de la cuenta a partir de una plantilla fija.
Corre en tu computadora, no en internet.

Las seis fases están construidas. Lo que sigue es un mapa de qué está
encendido, qué está apagado y por qué.

---

## Estado: qué está encendido y qué no

**Encendido y en uso.**

| | Qué hace | Llave |
|---|---|---|
| Plantilla y editor | Los cuatro tipos de slide, el ajuste automático, el empuje con flechas | — |
| Exportación | PNG a 2160×2700, ZIP con `copy.txt` y `creditos.txt` | — |
| Íconos de la librería | Ingesta, manifiesto, buscador con sinónimos y aviso de fusión con la paleta | — |
| Paletas | Azul, naranja y verde por tema, elegidas por el redactor | — |
| Redacción con IA | `/api/redactar`: el tema entra, el borrador sale con sus fotos puestas | `ANTHROPIC_API_KEY` + `PEXELS_API_KEY` |
| Propuesta de temas | `/api/proponer`: sin tema escrito, elige uno del mes y arranca | `ANTHROPIC_API_KEY` |
| Cola de afirmaciones | Extracción determinista y barrera de guardado | — |
| Fotos de contexto | Búsqueda en Pexels, descarga y crédito en el mismo movimiento | `PEXELS_API_KEY` |
| Archivo clínico | Wikimedia Commons con firma del médico y huella de la imagen | — |
| Íconos generados | Se genera lo que la librería no tiene, al redactar | `GEMINI_API_KEY` con facturación |

**Apagado, y el porqué de cada uno.**

- **Unsplash como buscador automático.** Sus Términos de la API obligan a
  hotlinkear las imágenes y a enlazar el perfil del fotógrafo cada vez que se
  muestran; aquí la foto se hornea dentro de un PNG que va a Instagram. **La
  restricción es del canal, no de la foto**: bajarla del sitio a mano sí da uso
  comercial libre. Vía manual documentada más abajo.
- **DermNet.** CC BY-NC-ND: la cuenta de una consulta privada es uso comercial
  (NC) y recortar la foto dentro del slide es obra derivada (ND). Dos de dos en
  contra. Para uso comercial venden una licencia aparte.
- **CDC PHIL como adaptador.** Sus imágenes sirven, pero no tiene API y su FAQ
  dice "la mayoría" de dominio público, no todas. Sin una interfaz que devuelva
  el estado de cada una, un adaptador tendría que suponer que todas lo son. Vía
  manual.
- **CC BY-SA en el archivo clínico.** Se puede usar, pero el share-alike
  alcanzaría al carrusel entero. Es una línea en `lib/bancos/commons.ts` si
  algún día se decide asumirlo; el porqué está escrito ahí al lado.
- **El doble render de íconos.** Sobre un fondo de color plano una lente
  transparente se lee como un agujero, así que el vidrio va opaco por diseño y
  el croma basta. Espera a un concepto que de verdad necesite translucidez.
- **`/api/mes`**, la generación del mes completo. Es lo único de la fase 6 que
  no está.

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

**El primer ícono generado, y por qué era este.** El slide 02 del post de
impétigo usaba `informacion`: un ícono azul sobre fondo azul, ΔE 33, marcado por
el buscador. Lo que se publicó ahí fue una lupa y la librería no tenía ninguna,
así que quedó anotado como el primer concepto concreto para la generación —no
como algo a sustituir por otro que quedara mejor, porque este post es la
referencia contra la que mide `medir.py` y tiene que reflejar lo que se publicó.

Ya está generada, y los números lo confirman: el ícono pasó de **−61 px de
desfase contra la captura publicada a +8**, con el ancho exacto (231 px contra
231), y el desplazamiento máximo de todo el carrusel bajó de 68 a 54 px. Poner
la lupa acercó el post a lo que se publicó en vez de alejarlo, que era
justamente la condición.

Su entrada del manifiesto lleva `origen: "generado"`, el modelo, la fecha y el
prompt. El prompt es el que importa: es lo único que permite regenerar la pieza
si algún día cambia el estilo de la cuenta.

**Licencia.** Los íconos de Thiings son de pago para uso comercial y su licencia
prohíbe redistribuirlos. Por eso `public/iconos/*` está en `.gitignore` y solo se
versiona el manifiesto. Un consultorio publicando contenido de marca es uso
comercial: la vía gratuita no aplica ni ícono por ícono.

---

### Generar sustituye a Thiings, no la complementa

La colección de Thiings es de pago, y mientras no esté la librería local es
pequeña. Con doce íconos no resuelve casi nada: de tres carruseles seguidos, los
conceptos que pidió el redactor —"water drop", "wind", "stethoscope"— no estaba
ninguno, y esos slides salían sin ícono.

Por eso, al redactar, **lo que la librería no tiene se genera**. Una variante y
no tres: el flujo de tres es para cuando alguien elige, y aquí no elige nadie.

Y cada ícono generado entra en la librería por la misma puerta que los
descargados, así que **la librería se llena sola con lo que la cuenta usa de
verdad**. El segundo carrusel que pida "stethoscope" ya lo encuentra y no vuelve
a generar nada. `npm run banco-iconos` fija esa propiedad: si el slug o las
etiquetas que escribe el guardado no fueran encontrables por el mismo buscador
que preguntó, se generaría el mismo ícono una vez por carrusel para siempre.

El día que se compre Thiings, esto no estorba: los diez mil íconos entran por la
ingesta, `mejorCoincidencia` los encuentra primero y la generación deja de
dispararse sola. Lo generado se queda, marcado con `origen: "generado"` y su
prompt.

### Generar un ícono a mano

Además del relleno automático, se puede generar a mano y elegir entre tres
variantes — para cuando el concepto importa y quieres verlo antes:

```bash
curl -X POST localhost:3001/api/icono   -H 'Content-Type: application/json'   -d '{"concepto":"Una lupa clásica, con mango y aro metálico","n":3}'

npm run comparar-iconos <archivo.png> lupa   # el candidato contra la librería
```

**El estilo vive en `content/estilo-iconos.md`**, hermano de `voz.md`: se
antepone a cada concepto en cada llamada y se edita ahí, no en el código. Su
descripción sale de mirar la librería que ya está —plástico mate con brillo
satinado, sombra propia sin sombra proyectada, vista de tres cuartos—, porque
un ícono que no comparta esas tres cosas se nota en el mismo carrusel.

**El alfa se recupera por croma.** Gemini no devuelve canal alfa, así que se
pide fondo verde `#00FF00` y se recorta con `lib/iconos/croma.ts`. El recorte
no decide píxel a píxel: inunda desde el borde de la imagen, porque un píxel
del borde del objeto y un verde hoja saturado son el mismo color aislados y
solo los separa dónde están. `npm run banco-croma` lo comprueba con imágenes
hechas a mano, incluido el límite conocido — un verde muy saturado y oscuro sí
se confunde con el croma, y ahí la salida es pedir el fondo en otro color.

**No se genera al renderizar, nunca.** El ícono se resuelve en el editor y
queda en disco. Si `/render` dependiera de una llamada externa, la exportación
del mes tardaría minutos y fallaría a la mitad.

**Lo que no se genera son fotos clínicas.** El criterio no es el estilo ni el
realismo: es la función. Si la imagen es lo que el lector debe aprender a
reconocer en su propia piel, tiene que ser real y aprobada. Está escrito en el
propio `estilo-iconos.md`, donde lo va a leer quien edite el estilo.

### El manifiesto: quién es dueño de cada campo

La ingesta reconstruía cada entrada desde cero a partir del PNG, así que un
ícono generado perdía `origen`, `proveedor`, `fecha` y —el que duele— `prompt`
cada vez que volvía a pasar por ella. Con el prompt se pierde lo único que
permite regenerar la pieza si cambia el estilo de la cuenta.

La regla, en `lib/manifiesto.ts`: **la ingesta es dueña de los campos que
deriva del PNG y de ninguno más.** Todo lo demás se conserva, incluido lo que
nadie ha previsto todavía; no hay lista de campos a salvar.

La alternativa evidente era un `icono.json` al lado del PNG. Se descartó porque
`public/iconos/*` está en `.gitignore` —los íconos de Thiings no se pueden
redistribuir— y lo único versionado es `manifest.json`: un archivo acompañante
sería *menos* durable que el manifiesto al que pretende proteger, y añade su
propio modo de fallo, que es mover el PNG sin su JSON.

Su límite: borrar la entrada del manifiesto a mano hace que la siguiente
ingesta la reconstruya sin la metadata de generación. Es correcto — borrar la
entrada es pedir que se reconstruya.

## Lo que se decide solo, y lo que no

Tres pasos que antes preguntaban ya no preguntan, porque lo que estaban
preguntando era preferencia y no criterio: **cambiarlo después en el editor
cuesta lo mismo que haberlo elegido antes.**

- **Sin tema escrito**, el modelo propone y arranca con el primero. Sigue
  proponiendo tres —ordenar lo mejor primero le sale mejor que pedirle una sola
  respuesta— pero cuál se escribe no se pregunta. Se enseña cuál tomó y por qué
  toca este mes, que es información, no una pregunta.
- **Las fotos de ambiente ya vienen puestas.** El carrusel redactado sale con
  sus imágenes descargadas y acreditadas, no con el hueco: el propio redactor
  devuelve la consulta al banco y los términos de descarte de cada slide en la
  misma llamada, así que no cuesta ni una llamada más. Si un slide se queda sin
  foto usable, ese slide —y solo ese— sale con el hueco señalado y un aviso;
  el texto es lo caro y no se tira por una imagen.
- **La foto de banco, a mano**, también se busca, se criba y se pone en un solo
  clic. Las otras quedan a un botón de distancia y las apartadas también, con
  su motivo.
- **El ícono sugerido** se pone si la librería lo tiene, y **si no lo tiene se
  genera**. Nunca se pone uno parecido: o es el concepto que se pidió, o se
  fabrica ese concepto.

**Lo que sigue preguntando no es preferencia y no va a dejar de preguntar:**

- **La cola de afirmaciones.** Una cifra plausible con una institución al lado
  es el error más difícil de cazar. Se revisa de una en una y no hay botón de
  aprobar todo.
- **La aprobación de imágenes clínicas.** Que esa piel sea lo que el texto dice
  que es lo firma un médico, y el servidor lo comprueba contra
  `content/marca.json`.
- **El paso de edición entre redactar y exportar.** El borrador se abre en el
  editor. No hay camino de un texto generado a un PNG sin que alguien lo mire.

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

## La cola de revisión

Un modelo puede escribir una cifra plausible con una institución real al lado
—"cerca del 10% de las consultas de piel en niños (StatPearls)"— y eso es más
difícil de cazar que un error obvio, porque llega ya vestido de verificado.

Por eso el editor extrae del carrusel las afirmaciones que hay que mirar y no
deja marcarlo como aprobado hasta que estén revisadas una por una. El post de
impétigo, por ejemplo, tiene nueve.

Entran por cuatro disparadores, que se acumulan:

| | qué lo dispara |
|---|---|
| `cifra` | un porcentaje, "N de cada N", una cantidad con unidad |
| `fuente` | una institución nombrada, en el slide o dentro del copy |
| `seguridad` | un modal junto a tratamiento, contagio, vuelta a clases o consulta: "necesita antibiótico", "puede volver a clases" |
| cifra sin fuente | no es para revisar, es una regla rota |

**Las que llevan cifra exigen el enlace a la fuente.** Pegar la URL obliga a
haber abierto la fuente; con el campo opcional, "la verifiqué" se vuelve trámite.
En las demás el enlace es opcional.

Cada revisión se guarda por una **huella** del texto: si cambias una coma, la
afirmación vuelve sola a la cola. No se puede aprobar una frase y luego cambiarla.

**Lo que esto no hace.** El sistema no comprueba nada: no abre la fuente, no
valida el enlace, no contrasta la atribución. Una entrada en `revisiones`
significa una sola cosa, que **una persona la miró un día**. Por eso el JSON
guarda `revisadaPor` y `fecha`, y no un `"verificada"` que dentro de seis meses
alguien leería como si el sistema hubiera comprobado algo. Está explicado largo
en `references/ia.md` de la skill.

## Las fotos: de dónde salen y bajo qué licencia

Cada foto del carrusel guarda en el JSON de dónde salió y bajo qué términos:

```json
"credito": {
  "fuente": "Pexels",
  "licencia": "Pexels License",
  "licenciaUrl": "https://www.pexels.com/license/",
  "autor": "Artem Podrez",
  "url": "https://www.pexels.com/photo/8088232/"
}
```

**Sin eso el carrusel no se puede marcar como aprobado.** Es la misma barrera
que la de las afirmaciones: va en el estado y no en la exportación, y del
guardado y no de la lectura, para que un carrusel de antes del mecanismo siga
abriéndose. Y `"desconocida"` no la pasa, a propósito: si no se sabe de dónde
salió la foto, el crédito se queda vacío y el post se queda en borrador.
Rellenar el campo satisfaría la validación sin registrar nada.

### Buscar en el banco

En la tarjeta de un slide con foto, **Buscar foto en el banco**. Dos etapas:

1. Claude lee el slide y su `ideaImagen` y propone la consulta, qué tiene que
   enseñar la foto y —lo que importa— **qué la descalifica**. Esto cuesta una
   llamada.
2. El banco devuelve candidatos. Corregir la consulta y volver a buscar no gasta
   modelo, solo cuota del banco.

Al elegir una, **se descarga a `public/media/<slug>/` y el crédito se escribe en
el mismo movimiento**. No hay ventana en la que el archivo esté puesto y la
procedencia sin escribir; ese era el problema, porque el campo se llenaba a mano
y por eso estaba vacío en todo el proyecto.

Los candidatos que el banco devuelve sin autor o sin enlace **no se ofrecen**:
lo que no se puede acreditar no se usa. Salen contados, no escondidos.

**Las apartadas se enseñan.** Los candidatos que encajaban con la consulta y aun
así estaban mal aparecen en su propia lista, con el término que los apartó. Un
filtro que quita cosas en silencio no se distingue de una búsqueda con pocos
resultados, y entonces no se nota cuando está mal puesto. Este descarte existe
por un caso concreto: el slide del contagio en la escuela se publicó con la foto
de un gimnasio, porque encajaba con "niños juntos".

Solo fotos **de contexto**: un aula, mochilas, el recreo. Nada clínico. Las
fotos de lesiones son otro flujo, con aprobación del médico, y no pasan por aquí.

### Por qué Unsplash no está en el buscador

Sus Términos de la API obligan a *hotlinkear* las URLs que devuelve —«All API
uses must use the hotlinked image URLs returned by the API»— y a enlazar el
perfil del fotógrafo cada vez que se muestra la imagen. Este proyecto hornea la
foto dentro de un PNG que se sube a Instagram: ni hay hotlink ni cabe un enlace.

**La restricción es del canal, no de la foto.** La Licencia de Unsplash, la que
rige cuando bajas la imagen del sitio a mano, sí da uso comercial libre y no
exige atribución. Así que Unsplash se usa así:

1. buscar y descargar la foto desde `unsplash.com`, con el navegador;
2. arrastrarla sobre el slide en el editor;
3. llenar el crédito a mano: fuente `Unsplash`, licencia `Unsplash License`,
   `licenciaUrl` `https://unsplash.com/license`, y el nombre del fotógrafo y el
   enlace a la foto, que están en la página de la que la bajaste.

Es más trabajo y por eso el crédito hay que cuidarlo: aquí no hay API que lo
llene sola.

### Las llaves

`PEXELS_API_KEY` en `.env.local`. El límite gratuito es de 200 peticiones por
hora y 20 000 al mes, de sobra para un mes de carruseles.

### Las fotos clínicas van por otra cola

Una foto de aula y una foto de piel enferma se eligen con el mismo gesto y no
son la misma decisión. En la de aula lo único que se revisa es de dónde salió;
en la de piel, además, **si esa imagen es lo que el texto dice que es**, y eso
lo firma un médico. Por eso el archivo clínico es un panel aparte, se ve
distinto, y lo que sale de él no se puede insertar sin firma.

En la tarjeta de un slide con foto: **Archivo clínico — imágenes de lesión**.
El sistema propone; el médico inserta. El botón no se activa hasta que se
escribe su nombre, y el servidor lo vuelve a comprobar: lo que queda en el JSON
es una firma, y un botón desactivado en el navegador no basta para eso.

Lo que se guarda al aprobar:

```json
"clinica": true,
"aprobacion": {
  "aprobadaPor": "Dr. Edwin Maldonado",
  "fecha": "2026-09-06",
  "huella": "9f2c…"
}
```

**La huella es de los bytes de la imagen, no de su ruta.** Si el archivo cambia
—alguien lo sustituye por otro con el mismo nombre—, la firma deja de valer y el
carrusel vuelve a borrador. Es la misma idea que sostiene la cola de
afirmaciones: allí editar el texto devuelve la afirmación a la cola, aquí
cambiar la imagen devuelve la aprobación al médico.

Y como allí, esto no dice que el sistema haya comprobado nada. Dice que una
persona con cédula miró esa imagen concreta un día concreto.

### El consentimiento es una referencia, no un sí

Para las fotos del consultorio, `credito.consentimiento.referencia` guarda el
identificador del documento firmado. Nunca un booleano.

La razón no es burocrática. Un sí/no contesta "¿firmó?", que es la pregunta
fácil y solo hace falta una vez. La pregunta difícil llega meses después y va al
revés: **un paciente retira su consentimiento y hay que encontrar todo lo suyo
que esté publicado.** Un sí no se puede buscar.

```bash
npm run consentimiento                      # todo lo que lleva consentimiento
npm run consentimiento "expediente 218"     # solo ese
npm run consentimiento -- --clinicas        # todas las fotos clínicas
```

Devuelve el carrusel, el slide, la ruta del archivo y si está publicado. No
borra nada: dice qué hay que tocar.

### De dónde salen, y de dónde no

**Wikimedia Commons** es el único con adaptador automático. A diferencia de
Pexels, aquí la licencia **sí viene por imagen** y varía —dominio público, CC0,
CC BY, CC BY-SA y también cosas inusables—, así que se lee la de cada archivo y
se compara contra una lista blanca: dominio público, CC0 y CC BY.

**CC BY-SA no entra**, aunque se pueda usar. El share-alike no se queda en la
foto: la plantilla la recorta y la compone dentro del slide, ese slide se
exporta a un PNG y ese PNG se sube a Instagram. Si eso es obra derivada —y lo
es—, la obligación de licenciar igual alcanza al carrusel entero, y eso no lo
va a desenredar nadie dentro de un año. Con veintiuna usables para "impetigo" no
hace falta correr el riesgo. Si alguna vez se decide asumirlo, es una línea en
`lib/bancos/commons.ts` y el porqué está escrito ahí al lado.

**DermNet queda fuera.** Sus imágenes son CC BY-NC-ND 3.0: **NC** prohíbe el uso
comercial y la cuenta de una consulta privada lo es; **ND** prohíbe las obras
derivadas, que es exactamente lo que hace la plantilla al recortar la foto
dentro del slide. Para uso comercial DermNet vende una licencia aparte. Dos de
dos en contra, así que no está ni como opción configurable.

**CDC PHIL queda fuera del adaptador, pero sirve a mano.** Sus imágenes están
casi todas en dominio público, pero **no tiene API**, y su propio FAQ dice "la
mayoría", no "todas": hay imágenes con copyright de terceros mezcladas. Sin una
interfaz que devuelva el estado de cada una, un adaptador tendría que suponer
que todas son libres, que es el fallo en abierto que este proyecto no hace. La
vía es la misma que la de Unsplash: buscar en `phil.cdc.gov`, comprobar en la
ficha que esa imagen concreta es de dominio público, bajarla, subirla por el
editor y llenar el crédito a mano.

## Las pruebas

Una que abre el navegador y cinco que no.

```bash
npm run pruebas 3002      # el editor entero, con Playwright y servidor
```

| Banco | Qué mide | Por qué no se puede mirar a ojo |
|---|---|---|
| `npm run banco` | El disparador de seguridad, contra quince frases | "Necesita antibiótico" y "suele picar de noche" tienen las dos un verbo, y solo una manda hacer algo |
| `npm run banco-fotos` | El adaptador de Pexels y el descarte | Aparta el gimnasio del slide del contagio, y prueba lo que pasa cuando la respuesta viene rota |
| `npm run banco-clinicas` | El archivo clínico y la barrera de aprobación | Inventa licencias —incluida la de DermNet— y comprueba que las malas no pasan |
| `npm run banco-croma` | El recorte del fondo verde | El halo verde no se ve sobre el blanco del editor y sí sobre el azul del slide |
| `npm run banco-manifiesto` | Que la ingesta no borre lo que no calculó | El borrado no se nota: la entrada sigue ahí, solo le faltan campos |
| `npm run banco-proponer` | Que el contexto llegue al prompt de propuestas | Con la lista de temas vacía el modelo sigue contestando bien, y uno repetiría lo publicado |
| `npm run banco-iconos` | Que `iconoSugerido` case con el ícono correcto, o con ninguno | Un ícono equivocado ya puesto no lo revisa nadie: sale publicado |

```bash
npm run laboratorio       # devuelve los carruseles de prueba a su estado inicial
```

**Los cinco `banco*` corren sin navegador, sin servidor y sin salir a la red.**
Miden contra respuestas reales congeladas en `scripts/muestras/` y contra copias
mutadas a mano. Eso es lo que hace que los casos de fallo —una foto sin autor,
una licencia no comercial, un campo que el adaptador no reconoce— salgan tan
baratos como el camino feliz, que es justo al revés de lo que pasa cuando las
pruebas salen a la red.

En el editor, los slugs que empiezan por `laboratorio-` van a un banco de
imágenes falso que lee esa misma muestra y "descarga" un archivo local. Así la
prueba de Playwright recorre buscar, apartar, elegir y acreditar sin gastar
cuota ni depender de qué fotos tenga Pexels hoy.

Las pruebas corren sobre `laboratorio-edicion` y `laboratorio-paletas`, que son
posts de verdad —mismo esquema, mismo código de lectura— pero desechables. Se
reinician antes de cada corrida, así que pueden escribir, borrar y empujar lo
que quieran.

**Nunca tocan contenido publicado**, y no es una promesa: `soloLaboratorio()`
para el proceso si un slug no empieza por `laboratorio-`. La regla existe porque
una prueba llegó a borrar un slide de un post publicado —un clic calculado sobre
una lista que se estaba repintando cayó en el botón equivocado—. El slide se
recuperó de git, pero el problema no era el slide.

En la lista de carruseles salen apagados y con su etiqueta, para que nadie los
confunda con contenido.

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
| 3 · exportación | ✅ Los PNG a 2160×2700 y el ZIP con el copy y los créditos. |
| 4 · editor | ✅ Dos columnas, arrastrar y soltar imágenes, ajuste fino sobre el canvas. |
| 5 · íconos | ✅ La librería alojada aquí, con ingesta, manifiesto y buscador. |
| 6 · redacción | ✅ `/api/redactar` y la cola de afirmaciones. Falta `/api/mes`. |
| + imágenes | ✅ Pexels para contexto, Wikimedia Commons para clínicas, con registro de licencia. |
| + generación | ✅ Íconos con Gemini, croma y la misma puerta que los descargados. |

**Lo único pendiente es `/api/mes`**: proponer los temas del mes, dejar que se
tachen los que no sirven, y redactar uno por uno guardando cada borrador en
cuanto llega. Está descrito en `references/ia.md` de la skill.

---

## Cosas que conviene saber

- **Las llaves** van en `.env.local`, que no se sube a ningún lado, y solo se
  usan del lado del servidor: `ANTHROPIC_API_KEY` para redactar,
  `PEXELS_API_KEY` para las fotos de contexto y `GEMINI_API_KEY` para generar
  íconos. Wikimedia Commons no pide ninguna.
- **Los íconos de Thiings no se versionan**: `public/iconos/*` está en
  `.gitignore` porque su licencia prohíbe redistribuirlos, y se versiona el
  manifiesto. **Los íconos propios sí**, porque esa restricción es de ellos y no
  nuestra. Las excepciones se derivan del campo `origen` del manifiesto y las
  escribe la propia ingesta en `public/iconos/.gitignore`, así que el siguiente
  generado se versiona solo, sin que nadie mantenga una lista. Los once de
  Thiings que hay son de prueba; la lupa es propia.
- **Falta tu retrato** para el slide de cierre. Ponlo en
  `public/marca/retrato.jpg` y apunta ahí `retrato` en `content/marca.json`.
  Mientras tanto ese slide sale con el fondo café y el degradado, sin foto.
- **`salidas/` no se versiona.** Se regenera cada vez que exportas.
