# Carruseles

Genera carruseles de Instagram y Facebook a partir de un calendario de
contenido, con una plantilla por cuenta. Corre en tu computadora, no en
internet.

Cada cuenta es un **proyecto**: hoy está el del Dr. Edwin (`@alergo_derma`), y
la Dra. Mildreth, Adimex o la que venga se dan de alta al lado sin tocar código.
Ver [Proyectos: una carpeta por cuenta](#proyectos-una-carpeta-por-cuenta).

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
| Paletas | Veinticinco tonos a la misma luminancia; diez las elige el redactor, el resto a mano | — |
| Redacción con IA | `/api/<proyecto>/redactar`: el tema entra, el borrador sale con sus fotos puestas | `ANTHROPIC_API_KEY` + `PEXELS_API_KEY` |
| Propuesta de temas | `/api/<proyecto>/proponer`: sin tema escrito, elige uno del mes y arranca | `ANTHROPIC_API_KEY` |
| El calendario | Panel en la portada o `npm run mes`: lee la hoja y escribe los que faltan | las mismas tres |
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
- **La tanda en paralelo.** `npm run mes` escribe uno a uno. En paralelo sería
  cuatro veces más rápido y se comería la librería de íconos: dos carruseles a
  la vez que pidan el mismo concepto lo generarían dos veces y una escritura
  del manifiesto pisaría a la otra. La tanda se deja corriendo sola, así que el
  tiempo no es el problema que hay que resolver.

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
| `/` | Elegir proyecto. Con uno solo se salta y lleva directo a él. |
| `/<proyecto>` | La lista de carruseles de esa cuenta, con la portada de cada uno. |
| `/<proyecto>/descargas` | Los slides listos para bajarlos al teléfono. |
| `/<proyecto>/post/<slug>` | El editor: formulario a la izquierda, carrusel a la derecha. |
| `/plantilla` | El banco de pruebas: aquí se prueba un cambio de diseño sin tocar contenido. |
| `/<proyecto>/render/<slug>/<n>` | Un slide solo, sin nada alrededor. No es para ti: es la que captura Playwright. |

| Tecla | Qué hace |
|---|---|
| `G` | Rejilla: márgenes, área de contenido y las franjas donde Instagram encima su interfaz. |
| `R` | Encima la captura del post publicado, en modo diferencia. |
| `[` `]` | Sube y baja la opacidad de esa captura (en el banco). |

### Clonar en otra máquina

```bash
git clone <el repositorio>
npm install
cp .env.local.ejemplo .env.local     # y pon las tres llaves
npm run dev
```

Dos cosas **no viajan con el repositorio**, y conviene saberlo antes y no al
abrir el primer carrusel:

- **`.env.local`.** Las tres llaves se copian a mano. Está ignorado a propósito:
  una llave que entra en el historial de git no se borra cambiándola de sitio.
- **Los dieciséis íconos de Thiings.** Su licencia prohíbe redistribuirlos, así
  que el repositorio versiona el manifiesto y no los archivos. Tres de ellos
  —`termometro`, `informacion` y `alerta`— los usan carruseles que ya están
  escritos, así que en una copia limpia esos slides salen sin ícono. Se arregla
  copiando `public/iconos/` de la máquina donde están, por USB o por nube. Los
  generados con Gemini sí van en el repositorio: esa restricción no es nuestra.

Lo demás sí viaja: las fuentes, las fotos de los carruseles, el calendario y los
posts. Las carpetas `public/proyectos/<id>/media/laboratorio-*` no, pero las recrea
`npm run laboratorio` cuando corren las pruebas.

Si al exportar se queja de que falta el navegador, `npx playwright install
chromium`.

---

## Proyectos: una carpeta por cuenta

Todo lo que es de una cuenta vive en dos carpetas con su id, y nada más:

```
proyectos/<id>/                 lo que se edita
  proyecto.json                 marca y configuración (ver abajo)
  voz.md                        el system prompt de la redacción
  prompts/                      lo demás que la IA tiene que saber de la cuenta
    alcance.md                  qué temas son suyos y cuáles no
    estructura.md               cuántos slides y qué va en cada uno
    iconos.md                   lo que nunca se pide como ícono
    fotos.md                    qué foto de banco sí y cuál no (al redactar)
    fotos-banco.md              lo mismo, para quien busca la foto
  calendario.tsv                el calendario editorial
  posts/<slug>.json             los carruseles

public/proyectos/<id>/          lo que se sirve
  marca/                        logo, logo de la plataforma, retrato
  media/<slug>/                 las fotos de cada carrusel
  descargas/                    los PNG para el teléfono
```

Lo **compartido** entre cuentas: la librería de íconos (`public/iconos/`), su
estilo (`compartido/estilo-iconos.md`) y los sinónimos del buscador
(`compartido/sinonimos.json`). Un ícono generado para una cuenta le sirve a la
siguiente, y la librería se llena el doble de rápido.

El id es lo que va en la URL (`/dr-edwin`, `/dra-mildreth`) y en las rutas de la
API (`/api/dr-edwin/redactar`). Sale de la URL y no de un "proyecto activo"
guardado, a propósito: con dos pestañas abiertas en dos cuentas, cada una
guarda en la suya. Todas las rutas se resuelven en un solo sitio,
`lib/proyecto.ts`; ninguna otra parte del código arma una a mano.

### proyecto.json

```json
{
  "nombre": "Dr. Edwin Maldonado",
  "usuario": "@alergo_derma",
  "especialidad": "Especialista en alergología y dermatología",
  "ciudad": "Durango",
  "plataforma": "Doctoralia",
  "plataformaLogo": "/proyectos/dr-edwin/marca/doctoralia-blanco.png",
  "logo": "/proyectos/dr-edwin/marca/logo-blanco.png",
  "retrato": "",
  "cierre": {
    "lugar": "*Consulta en* **{ciudad}**",
    "invitacion": "Agenda tu cita desde"
  },
  "plantilla": "clinica",
  "giro": "un dermatólogo",
  "fuentes": ["Mayo Clinic", "Cleveland Clinic", "AAP", "AAD", "KidsHealth", "StatPearls"],
  "iconosRecientes": []
}
```

- **`cierre`** son las dos líneas de la llamada a la acción del último slide,
  encima del logo de la plataforma. Aceptan el marcado de la plantilla, y
  `{ciudad}` y `{plataforma}` se sustituyen. Una consulta dice "Agenda tu cita
  desde"; una distribuidora dirá "Cotiza por".
- **`plantilla`** es el diseño que usa la cuenta. Ver
  [Una plantilla nueva](#una-plantilla-nueva).
- **`giro`** es quién es la cuenta dicho por un tercero: entra en frases como
  "un carrusel de Instagram de *un dermatólogo*".
- **`fuentes`** son las únicas instituciones que el redactor puede citar.

### Lo que es de cada cuenta, y dónde entra en los prompts

Los prompts tienen dos partes. Lo que es de la app —la forma de los campos, cómo
se busca una foto, la regla de las cifras— vive en el código
(`lib/instrucciones.ts` y `lib/temas.ts`). Lo que es de la cuenta llega de su
carpeta y se inserta en su sitio:

| Archivo | Entra en | Qué dice en el del Dr. Edwin |
|---|---|---|
| `voz.md` | El system prompt de la redacción | A quién le habla, cómo suena, límites clínicos, la fórmula del copy |
| `prompts/alcance.md` | Proponer temas, sección «Quién firma» | Alergología **y** dermatología: qué temas sí, cuáles no (láser, estética) |
| `prompts/estructura.md` | Redactar, sección «Estructura» | Seis slides: portada, qué es, cómo se reconoce, por qué ahora, lista, cuándo acudir |
| `prompts/iconos.md` | Redactar, «El elemento visual» | Nunca el signo clínico como ícono: el objeto que lo acompaña |
| `prompts/fotos.md` | Redactar, «La búsqueda de la foto» | Solo ambiente, nunca piel enferma |
| `prompts/fotos-banco.md` | Buscar foto, con su encabezado | Lo mismo, dicho para quien elige entre candidatos |

Al separarlos, los prompts del Dr. Edwin quedaron **idénticos letra por letra** a
los de antes: se comprobó armándolos con el código viejo y con el nuevo.

### Dar de alta una cuenta

```bash
npm run proyecto:nuevo -- dra-mildreth
```

Crea las dos carpetas con los textos del Dr. Edwin **como ejemplo**, porque
adaptar un prompt que ya funciona es más fácil que escribirlo en blanco. Cada
texto lleva arriba la línea `POR ESCRIBIR`, igual que los campos de
`proyecto.json`, y **mientras siga ahí la app no redacta con él**: dice qué
archivo falta. Es la barrera contra el error que no avisa, una pediatra
escribiendo con el alcance de un dermatólogo.

Después: llenar `proyecto.json`, poner el logo en `public/proyectos/<id>/marca/`,
reescribir los seis textos empezando por `voz.md` y, si hay, subir el calendario
desde el panel. Con `--desde <id>` copia los ejemplos de otra cuenta.

### Con más de un proyecto

`/` enseña las cuentas para elegir. Los scripts que escriben —`npm run mes`,
`npm run celular`— **se niegan a adivinar** y piden `--proyecto <id>`; con uno
solo no hace falta. Va después de `--` para que npm no se quede la bandera:

```bash
npm run mes -- --proyecto dra-mildreth --plan
```

`npm run consentimiento` busca en todas las cuentas, porque quien pregunta por
un consentimiento quiere saber dónde está esa foto.

### Una plantilla nueva

Una plantilla es un diseño completo: sus tipos de slide, su CSS y sus tokens.
Hoy hay una, `plantillas/clinica/`, la medida sobre el carrusel publicado del Dr.
Edwin. Lo que pinta un slide —la ruta que captura Playwright, el editor, la
lista— la pide por su nombre a `plantillas/index.ts`, así que dos cuentas pueden
verse completamente distintas con la misma app.

Hoy, si una cuenta nueva usa `clinica`, cambia todo lo que es de la marca
—nombre, logo, cierre, ciudad— y conserva el diseño. Para un diseño propio:

1. Copiar `plantillas/clinica/` a `plantillas/<nombre>/` y cambiar lo que haga falta.
2. Añadir el nombre en `plantillas/nombres.ts` y su `Slide` en `plantillas/index.ts`.
3. Poner `"plantilla": "<nombre>"` en el `proyecto.json` de la cuenta.

Lo que todavía no está separado, y es lo siguiente: el CSS de `clinica` se carga
para toda la app (`app/layout.tsx`), y las paletas y los tamaños que usan el
editor y el esquema salen de `plantillas/clinica/tokens.ts`. Una segunda
plantilla tiene que ir con sus clases bajo su propio prefijo y, mientras no se
generalice eso, usar los mismos nombres de paleta.

---

## Un carrusel es un archivo

Cada post vive en `proyectos/<id>/posts/<slug>.json`. No hay base de datos: el sistema
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
      "pregunta": "¿Qué es el impétigo?", "foto": "/proyectos/dr-edwin/media/…/portada.jpg" },
    { "tipo": "contenido", "titulo": "…", "bajada": "…", "cuerpo": "…",
      "visual": { "clase": "foto", "src": "/proyectos/dr-edwin/media/…/01.jpg" },
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
- **El cierre no guarda nada.** Sale todo de `proyectos/<id>/proyecto.json`, así que el día
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

### Qué modelo escribe cada cosa

Las tres constantes están en `lib/modelo.ts` y dos son configurables desde
`.env.local`, así que probar otro no es tocar código:

| | Por defecto | Variable |
|---|---|---|
| Redactar el carrusel | Opus 5 | `CLAUDE_MODELO` |
| Proponer temas | Sonnet 5 | `CLAUDE_MODELO_AUXILIAR` |
| Criterios de búsqueda de foto | Sonnet 5 | `CLAUDE_MODELO_AUXILIAR` |

**Sobre bajarlo para gastar menos**, que es la pregunta que siempre aparece:
cambiar de *versión* dentro de Opus no cambia de precio —4.7 sigue siendo
Opus—; lo que baja el costo es cambiar de *nivel*, Opus → Sonnet. Proponer temas
y sacar criterios de búsqueda ya van en Sonnet: eligen entre reglas que están
escritas en el prompt, no inventan contenido.

Bajar el de redactar es otra cosa, y **el riesgo no está donde parece**. La
barrera de afirmaciones no deja publicar una cifra sin revisar venga del modelo
que venga, así que no se arriesga una mentira publicada: se arriesga que salgan
*más afirmaciones que revisar*, y revisar ya es el cuello de botella —once por
carrusel, cinco de ellas para el médico—. Un modelo que escriba dos cifras de
más por carrusel se paga solo en tiempo de revisión.

Así que la forma de saber si salió a cuenta no es leer el carrusel: es mirar
**cuántas afirmaciones dejó en la cola**, que sale en el resumen de `npm run
mes` y en el panel del calendario. Un carrusel son unos 7.400 tokens de entrada
y 7.800 de salida, medidos.

El esquema está en `lib/schema.ts` y se usa en los tres momentos: al leer un
archivo, al guardar desde el editor y al validar lo que devuelva el modelo al
redactar (fase 6). Es el mismo en los tres a propósito.

En `proyectos/dr-edwin/ejemplos/impetigo-brief.md` está el brief de una publicación real,
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
guarda en `public/proyectos/<id>/media/<slug>/`, con el nombre normalizado y bajada a 1600 px
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
palabra arrastra sus sinónimos desde `compartido/sinonimos.json`, que se edita a
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

**El estilo vive en `compartido/estilo-iconos.md`**, hermano de `voz.md`: se
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
- **Con un tema escrito, se escribe ese**, tal cual, sin pasar por la propuesta.
  Ojo con una asimetría: el filtro de especialidad —lo que descarta estética,
  láser, rellenos, melanoma y cirugía— vive en el prompt de la propuesta y solo
  ahí. Un tema tecleado a mano no pasa por él.
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
- **El color se reparte cuando el tema no pide ninguno.** El redactor elige la
  paleta por el tema y hace bien, pero la mayoría de los temas de esta cuenta
  no tienen color: impétigo no es de ningún color, dermatitis atópica tampoco.
  Ahí la respuesta correcta es azul y así está escrito en el prompt — con el
  resultado medido de que **siete de quince carruseles salieron azules**. Ahora,
  y solo en ese caso, se elige la que hace más que no se usa, entre las quince
  del reparto. Si el modelo eligió turquesa porque el carrusel va de albercas,
  se queda turquesa. No es al azar: doce tiradas sobre quince colores repiten
  una de cada cinco veces, y una repetición seguida se ve tanto como el mes
  azul. Ver `lib/variedad.ts`.

**Lo que sigue preguntando no es preferencia y no va a dejar de preguntar:**

- **La cola de afirmaciones.** Una cifra plausible con una institución al lado
  es el error más difícil de cazar. Se revisa de una en una y no hay botón de
  aprobar todo.
- **La aprobación de imágenes clínicas.** Que esa piel sea lo que el texto dice
  que es lo firma un médico, y el servidor lo comprueba contra
  `proyectos/<id>/proyecto.json`.
- **El paso de edición entre redactar y exportar.** El borrador se abre en el
  editor. No hay camino de un texto generado a un PNG sin que alguien lo mire.

Cada tarjeta de la lista lleva dos botones cuadrados, sin texto porque en una
rejilla de cinco columnas una etiqueta la partiría: **avanzar el estado**
(`borrador → aprobado → publicado`, apagado en publicado) y **exportar el ZIP**.
El primero no es un atajo alrededor de nada: manda el post a `/api/<proyecto>/post` y el
servidor decide, así que si quedan afirmaciones sin revisar el estado no se
mueve y la tarjeta dice por qué. La suite lo comprueba dando el clic.

## El calendario: escribir los que faltan

El calendario editorial vive en **`proyectos/<id>/calendario.tsv`**. Se sube de dos
maneras y las dos escriben el mismo archivo, así que da igual cuál se use:

**Desde la portada** — «Escribir varios desde el calendario». Se suelta el CSV o
el TSV en el recuadro, sale la hoja entera con lo ya escrito apagado y lo que
falta marcado, y un botón que dice cuántos va a escribir. Se pueden desmarcar
los que no toquen ahora.

**Desde la terminal**, que es lo mismo sin navegador:

```
npm run dev                              # en otra terminal, y anota el puerto
npm run mes -- 3001 --plan               # qué falta, sin escribir ni gastar nada
npm run mes -- 3001                      # escribe todos los que faltan
npm run mes -- 3001 --desde colageno     # de esa fila en adelante
npm run mes -- 3001 --desde 4            # lo mismo, por el número de la hoja
npm run mes -- 3001 --proyecto adimex    # con varias cuentas, de cuál
```

| No. | Fecha | Día | Tipo | Pilar | Tema | Objetivo | Nota estratégica |
|---|---|---|---|---|---|---|---|
| 1 | 24/08/2026 | Lunes | Carrusel | Ciencia que entiendes | Psoriasis: no es contagiosa… | Compartir | Mes de la Psoriasis |
| | 25/08/2026 | Martes | Reel | — | Por definir | — | — |

**Las columnas se buscan por su nombre**, así que el orden da igual y las
columnas de más sobran. Se leen tabulaciones —que es lo que sale de copiar y
pegar— y también comas con comillas, por si se exporta como CSV. Los reels y
las filas sin tema se saltan y se cuentan; cualquier otra que se caiga se dice
con su línea y su motivo, porque una fila que desaparece en silencio es un
carrusel que nadie echa de menos hasta su día.

**Sin `proyectos/<id>/calendario.tsv`, el modelo propone la tanda** como antes:
`npm run mes -- 8 3001`, ocho por defecto —dos por semana— con techo de veinte.

### Lo que el calendario le quita de encima al modelo

Sin hoja, el redactor **inventa** el pilar, el objetivo y la nota de cada
carrusel. Con hoja los recibe, y no es un detalle de comodidad: el objetivo
decide a cuál de los cierres del copy se le carga la mano, así que un carrusel
que la hoja marca `agendar` y el modelo escribe para `guardar` sale con el
cierre equivocado — y eso no se nota leyéndolo suelto. El pilar es peor todavía:
dos posts que en la hoja son del mismo eje salían con dos pilares distintos, y
eso solo se ve mirando el mes entero.

Se le dicen en el prompt **y se le imponen encima de lo que devuelva**. Si el
modelo propone otra cosa, gana la hoja y sale un aviso diciendo qué propuso.
La fecha de la hoja va a `creado`.

### Cómo sabe cuáles faltan

Por el **tema**, no solo por el nombre de archivo. La hoja dice «Impétigo: la
infección del regreso a clases» y el archivo que ya existe se llama
`impetigo-regreso-a-clases`: los slugs no coinciden, así que comparar nombres lo
daría por no escrito y lo redactaría otra vez — una llamada larga para acabar
con dos carruseles del mismo tema. Los textos sí coinciden al 100 % con la
medida de `lib/mes.ts`, que es la misma que detecta repetidos.

### Por qué el panel no es "un botón que lo hace todo"

Doce carruseles son media hora y una ruta de Next se corta a los cinco minutos,
así que una sola petición que lo haga todo no existe. Las opciones eran una cola
de trabajos en el servidor —con su estado, su reinicio y su endpoint de
consulta— o que el bucle viva en el navegador y llame a `/api/<proyecto>/redactar` una vez
por fila, que es exactamente lo que hace `npm run mes` desde la terminal.

Gana lo segundo, y no solo por ser menos código: **cada carrusel se guarda en
cuanto sale**. Si se cierra la pestaña a la mitad, lo escrito está escrito y al
volver a abrir el panel salen los que falten. Lo que cuesta es que la pestaña
tiene que quedarse abierta mientras trabaja; el panel lo dice en pantalla y
pregunta antes de cerrarla.

### Lo demás que hace la tanda

- **Habla por HTTP con el servidor de desarrollo** y llama a `/api/<proyecto>/redactar`, la
  misma ruta que el botón de redactar uno. Mismo prompt, mismas fotos, mismos
  íconos. No es una segunda implementación que se va separando sola.
- **Ninguna foto se usa dos veces.** Nueve carruseles sobre temas vecinos le
  piden al banco escenas parecidas, y la mejor foto de aula suele ser la misma.
  Cada llamada devuelve las que gastó y la siguiente las recibe apartadas.
- **Nunca sobrescribe.** Por eso **volver a correrlo después de un fallo
  continúa donde iba**, y por eso no puede pisar un borrador en revisión.
- **Un carrusel que falla no se lleva la tanda.** El siguiente sigue; el que
  falló se dice al final con su motivo y se recupera volviendo a correr.
- **`--desde` que no casa no arranca nada.** Si "colageno" no encuentra su fila,
  se para: escribir la hoja entera porque no se reconoció el argumento serían
  doce carruseles que nadie pidió.

### La fecha es lo que más caro sale leer mal

`24/08/2026` es 24 de agosto. La misma hoja abierta en una configuración en
inglés escribe `08/24/2026`, y **las dos se leen sin error dando meses
distintos**: el carrusel no falla, se publica fuera de temporada. Se comprueba
de dos formas que se reparten el trabajo, porque ninguna sola alcanza:

- un "mes" 24 es imposible y se caza por la forma;
- `08/09/2026` es válido leído de las dos maneras, y ahí lo único que decide es
  **la columna del día de la semana**: si el 8 de septiembre no cae en miércoles,
  la fila se aparta.

Por eso conviene dejar la columna `Día` en la hoja aunque parezca redundante: es
lo que convierte una suposición en una comprobación.

### El costo de verdad no son los tokens

Al terminar dice cuántas afirmaciones acaban de entrar a la cola y cuántas de
ésas son indicaciones de seguridad. Medido sobre un carrusel real de la tanda:
**once afirmaciones, cinco de seguridad.** Ocho carruseles son del orden de
noventa por revisar y cuarenta que firma el doctor, no tú. Escribir el mes toma
veinte minutos; revisarlo, no.

**La tanda no afloja nada.** Todo sale en `borrador`, la cola de afirmaciones
queda entera, las fotos clínicas siguen sin poder entrar por aquí y ninguno se
puede pasar de estado hasta que esté revisado. Lo único que se hace en tanda es
**escribir**, que es la parte lenta y la que no decide nada. Revisar sigue
siendo de uno en uno, y ahí no hay atajo.

### Los dos umbrales del repetido

`lib/mes.ts` compara los temas por las palabras que dicen de qué van, sin la
gramática. De 85 % para arriba **se tira**: es el mismo título reordenado.
Entre 60 y 85 **se escribe y se avisa**, y esa franja existe porque el banco
encontró que contar palabras no puede resolverla:

| | |
|---|---|
| «Protector solar en niños» vs «Protector solar y dermatitis» | 67 % — **dos** carruseles |
| «Alergia al polen en primavera» vs «Alergia al polen en marzo» | 67 % — **uno** |

Miden igual porque tienen la misma forma: dos palabras compartidas y una
distinta. Lo que los separa es si la palabra distinta cambia lo que se aprende,
y eso no lo dice contar. Así que en esa franja se escribe y se dice contra qué
se parece: cuál de los dos sobra es criterio editorial y no de un umbral.

## Exportar

Desde `/<proyecto>/post/<slug>`, el botón **Exportar carrusel (ZIP)**. Tarda unos segundos
por slide porque abre un navegador de verdad.

Te bajas un ZIP con `01.png` … `07.png` y el `copy.txt`. Los mismos
archivos quedan además en `salidas/<proyecto>/<slug>/`, que suele ser más cómodo que
descomprimir.

Los PNG salen a **2160 × 2700**, el doble del lienzo. Instagram recomprime, y
entregarle el doble de píxeles conserva mucho mejor los bordes de la tipografía.

Por debajo es `POST /api/<proyecto>/exportar`:

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

Al elegir una, **se descarga a `public/proyectos/<id>/media/<slug>/` y el crédito se escribe en
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
| `npm run banco-paletas` | Que las 25 estén a la misma luminancia | El contraste no se ve, se mide: con 25 tonos, revisar a ojo es revisar 25 veces |
| `npm run banco-mes` | Que la tanda no escriba dos veces el mismo carrusel | Un repetido cuesta una llamada larga y una revisión entera para tirarlo; tirar uno bueno deja el mes corto sin que nadie sepa por qué |
| `npm run banco-calendario` | Que la hoja se lea como está escrita | Una fecha al revés se publica fuera de temporada y una fila que desaparece no se echa de menos hasta su día. Ninguna de las dos da error |
| `npm run banco-variedad` | Que el reparto de color no pise una elección del modelo | Cambiar el turquesa de un carrusel de albercas no se ve en la cuadrícula: se ve leyendo, y para entonces está publicado |
| `npm run banco-proyectos` | Que cada cuenta escriba con lo suyo y guarde en lo suyo | Un carrusel de la pediatra redactado con el alcance del dermatólogo no revienta: sale bien escrito y equivocado. Tampoco una foto guardada en la carpeta de otra cuenta |
| `npm run iconos:recortar` | Busca íconos guardados con el fondo de croma puesto | No es una prueba, es una reparación. Sin `--escribir` solo dice cuáles están mal; `--fondo <slug> <r,g,b>` para los que ya no tienen el croma en la orilla |

```bash
npm run laboratorio       # devuelve los carruseles de prueba a su estado inicial
```

**Los `banco*` corren sin navegador, sin servidor y sin salir a la red.**
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
otro tamaño. El hook vive en `plantillas/clinica/` y lo usan las dos rutas justamente para
que no pueda pasar, pero es el error clásico de este tipo de proyecto.

Siempre quedan unas decenas de píxeles de diferencia en el borde de un ícono
escalado y en el tramado de los degradados: son deltas de 1 a 6 sobre 255 que no
ve nadie. Por eso el veredicto no cuenta píxeles distintos sino píxeles que se
movieron más de 8, y avisa a partir de 400. Cuando el ajuste de verdad no corre,
el número se va a cientos de miles: no hay zona gris.

Los mapas de diferencias quedan en `salidas/verificar/diff-NN.png`, en rojo.

---

## Dónde se cambia cada cosa

Todo el diseño vive en `plantillas/clinica/`. **Si quieres cambiar cómo se ve algo, la
respuesta siempre está dentro de esa carpeta.** Si para mover un título hay que
tocar `app/`, algo se rompió.

| Quiero cambiar… | Archivo |
|---|---|
| Un color, un tamaño de letra, un margen, una separación | `plantillas/clinica/tokens.ts` |
| Cómo se acomodan las piezas de un slide | `plantillas/clinica/plantilla.css` |
| Qué lleva cada tipo de slide | `plantillas/clinica/slides/` |
| La cabecera, el pie, la flecha, la palomita, el papel | `plantillas/clinica/partes/` |
| Qué campos acepta un post | `lib/schema.ts` |
| Tu nombre, ciudad, plataforma de citas, logotipo, el texto del cierre | `proyectos/<id>/proyecto.json` |
| Cómo escribe la IA, qué temas son de la cuenta, cuántos slides | `proyectos/<id>/voz.md` y `proyectos/<id>/prompts/` |
| El papel rasgado, la palomita y la flecha | `plantillas/clinica/partes/` (van dibujados en línea) |
| El color de fondo y todo lo que va encima | `plantillas/clinica/tokens.ts`, en `paletas` |

`tokens.ts` es la única fuente de verdad de los números. `plantilla.css` no tiene
ni un valor suelto: los lee de ahí a través de `plantillas/clinica/variables.ts`.

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
| 2 · contenido | ✅ Los posts en `proyectos/<id>/posts/*.json`, validados con Zod. |
| 3 · exportación | ✅ Los PNG a 2160×2700 y el ZIP con el copy y los créditos. |
| 4 · editor | ✅ Dos columnas, arrastrar y soltar imágenes, ajuste fino sobre el canvas. |
| 5 · íconos | ✅ La librería alojada aquí, con ingesta, manifiesto y buscador. |
| 6 · redacción | ✅ `/api/<proyecto>/redactar`, la cola de afirmaciones y el mes entero. |
| + imágenes | ✅ Pexels para contexto, Wikimedia Commons para clínicas, con registro de licencia. |
| + generación | ✅ Íconos con Gemini, croma y la misma puerta que los descargados. |

**Las seis fases están completas.** El último hueco era el mes completo, que
`references/ia.md` describía como `/api/mes`: proponer los temas, dejar que se
tachen los que no sirven y redactarlos uno a uno.

Acabó siendo otra cosa, y por dos motivos. **No es una ruta**: media hora de
trabajo no cabe en una petición que se corta a los cinco minutos, y lo que uno
quiere cuando falla el séptimo es que los seis anteriores sigan en disco. Un
script que escribe archivo por archivo hace eso sin inventar nada; una ruta
habría necesitado una cola de trabajos para lo mismo.

Y **no propone**, porque hay un calendario editorial de verdad. Proponer temas
era resolver un problema que la hoja ya tenía resuelto; el trabajo estaba en
leerla bien y en saber cuáles ya se escribieron. El paso de tachar a mano
tampoco hizo falta: `--plan` enseña la tanda sin escribirla y `--desde` recorta
por dónde empezar.

### Varios proyectos

| Fase | Qué trae |
|---|---|
| 1 · una carpeta por cuenta | ✅ `proyectos/<id>/`, rutas en `lib/proyecto.ts`, URLs y API con el id, scripts con `--proyecto`. |
| 2 · lo de la cuenta fuera del código | ✅ Alcance, estructura, reglas de imagen, fuentes, giro y cierre en la carpeta de cada cuenta; plantilla elegida por proyecto. |
| 3 · los módulos médicos, opcionales | La cola de afirmaciones firmada "por el médico", el archivo clínico de Commons y el disparador de seguridad (`lib/afirmaciones.ts`) son de una consulta. Una cuenta como Adimex los tiene que poder apagar en `proyecto.json`. |
| 4 · la Dra. Mildreth | La primera cuenta de verdad que no es el Dr. Edwin: misma plantilla, otra voz. Es la prueba de que las fases 1 y 2 alcanzan. |
| 5 · una cuenta que no es médica | Adimex. Pide la fase 3 y, si su diseño es otro, la plantilla propia con su CSS separado (ver «Una plantilla nueva»). |

Lo que queda de dermatología en los prompts compartidos son **ejemplos** —"en un
carrusel de alergia alimentaria van cacahuates"—, no reglas. A otra consulta le
sirven igual; a Adimex le conviene revisarlos en la fase 5.

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
  `public/proyectos/<id>/marca/retrato.jpg` y apunta ahí `retrato` en `proyectos/<id>/proyecto.json`.
  Mientras tanto ese slide sale con el fondo café y el degradado, sin foto.
- **`salidas/` no se versiona.** Se regenera cada vez que exportas.


## Subirlo a Vercel

El despliegue sirve para **dos cosas y ninguna más**: ver los carruseles desde
donde sea y bajar los slides al teléfono para publicarlos. No edita.

### Por qué no edita

No es una decisión de diseño, es lo que hay. En Vercel el disco del proyecto es
de solo lectura y cada petición corre en un contenedor que se destruye al
terminar, así que las siete rutas que guardan archivos —el carrusel, las fotos,
el calendario, los íconos, la exportación— no pueden funcionar allá. Escribirían
en un `/tmp` que se evapora, y parecería que guardaron.

`lib/soloLectura.ts` las apaga cuando detecta que está en Vercel y contesta
diciendo qué pasa. Sin eso, dar a guardar desde el teléfono devuelve un error de
permisos de Node en crudo.

Y la exportación además abre un Chromium de verdad, que allá no existe. Por eso
se exporta aquí y el despliegue solo sirve el resultado.

### Que solo entres tú

Vercel lo trae de fábrica y no hay que programar nada:

> Proyecto → **Settings → Deployment Protection → Vercel Authentication →
> Standard Protection**

Con eso, abrir la URL exige iniciar sesión con una cuenta de Vercel de tu equipo.
Es mejor que cualquier login escrito a mano: no hay contraseñas que guardar, ni
sesiones que caduquen mal, ni una ruta que se olvide de comprobar el permiso.

### Los pasos

1. **Importar.** En vercel.com → Add New → Project → el repositorio. Next.js lo
   detecta solo; no hay que tocar la configuración de build.
2. **Las llaves.** Settings → Environment Variables, las mismas tres de
   `.env.local` (ver `.env.local.ejemplo`). Sin ellas la app arranca, pero
   redactar y buscar fotos no funcionan — que allá tampoco funcionarían.
3. **La protección**, arriba.
4. **Push.** Cada `git push` a `main` despliega.

### Bajar los slides al teléfono

Desde la app, que es lo cómodo: en **/<proyecto>/descargas → «Mandar un carrusel al
teléfono»** sale la lista entera y cada uno tiene su botón. Ese panel solo
aparece en tu máquina; en Vercel no, porque allá exportar es imposible y
enseñar botones que no funcionan es peor que no enseñarlos.

Por consola hace lo mismo:

```bash
npm run celular                      # lista qué hay, qué está al día y qué cambió
npm run celular <slug>               # lo prepara
npm run celular -- --todos           # todos (avisa del peso antes)
git add public/proyectos/<id>/descargas && git commit && git push
```

Con más de un proyecto se dice de cuál, después de `--` para que npm no se
quede la bandera: `npm run celular -- <slug> --proyecto dra-mildreth`.

Y en los dos casos falta el `git push`: los PNG viven en el repositorio, que es
de donde Vercel los sirve. El panel lo dice en pantalla — si no, preparas, abres
el teléfono y no está, sin ninguna pista de por qué.

Y en el teléfono, `/<proyecto>/descargas`: cada slide es una imagen; se mantiene pulsada y
**Guardar en Fotos**. Salen a 1080 × 1350, el tamaño nativo de Instagram. Eso sí
funciona en producción — lo que no se puede allá es *preparar* uno nuevo.

Un detalle que rompe el despliegue en silencio si se pierde de vista: `public/`
no viaja en el paquete de las funciones, porque Vercel lo sirve como estático.
Los PNG no lo necesitan, pero **el índice sí se lee desde el servidor**, así que
va declarado en `outputFileTracingIncludes`. Sin él la página se queda con la
lista vacía y dice que no hay nada preparado aunque lo haya.

Se exporta de uno en uno a propósito. Son archivos derivados que **caducan**: en
cuanto edites un slide, el PNG guardado deja de ser el carrusel. Exportar los
diecisiete "por si acaso" llenaría el repositorio de imágenes viejas —a escala 2
serían 120 MB, más de lo que pesa el proyecto entero—. Y para lo que caduque de
todos modos, cada exportación guarda la huella del post: si después lo editas, la
página lo dice en vez de darte callado un slide pasado. La suite lo comprueba.

| | |
|---|---|
| `npm run celular` | Sin argumentos: qué hay, qué está exportado y qué cambió después |
| `npm run celular <slug>` | Lo exporta a `public/proyectos/<id>/descargas/<slug>/` a 1080 × 1350 |
| `npm run celular -- <slug> --quitar` | Lo borra de las descargas |
| `--puerto 3001` | Si el servidor no está en el 3000 |
| `--proyecto <id>` | De qué cuenta, cuando hay más de una |
