# Spec: generación asistida de íconos e imágenes

Estado: propuesta. **No implementar sin completar antes la sección "Verificar primero".**

Esta spec fue escrita sin acceso al código. Describe intención y restricciones,
no estructura de archivos. Donde diga "el vigía" o "el manifiesto", localiza el
equivalente real en el repo antes de tocar nada.

---

## 0. Verificar primero

Antes de escribir una línea, confirma en el código y repórtame qué encontraste:

1. **Identidad de íconos en el manifiesto.** ¿Se identifican por nombre de
   archivo o por hash del contenido? Si es por hash, la generación rompe la
   deduplicación: cada render es único aunque el ícono sea visualmente igual.
2. **Persistencia del manifiesto.** El vigía lo mantiene en memoria. ¿Ya se
   escribe a disco? Los alias generados tienen que sobrevivir a un reinicio o
   se regenera lo mismo cada sesión.
3. **Filtro de entrada.** Confirmado que solo acepta PNG con transparencia.
   ¿Valida el canal alfa de verdad o solo la extensión?
4. **Slide 03 del post de impétigo.** Lleva una foto de un gimnasio en una
   sección sobre contagio escolar. Determina si es placeholder del template o
   si algo la seleccionó. Cambia si esto es bug o funcionalidad faltante.
5. **Proveedor de imagen disponible.** ¿Hay credenciales de algún modelo de
   imagen en el entorno? La API de Anthropic no genera imágenes; hace falta un
   proveedor aparte.

---

## 1. Íconos generados

### Flujo

El generador solo escribe un PNG en disco. La tubería existente
(carpeta vigilada → filtro → manifiesto → buscador) no se modifica.

```
iconos-generados/   staging — el vigía NO la vigila
iconos-entrada/     al aprobar, se mueve el archivo aquí
```

Aprobar = `rename()`. Sin código nuevo de ingesta.

### Dos etapas

1. **Claude (texto)** recibe el título del slide y el emoji del sistema.
   Devuelve JSON: `{ slug, alias[], prompt_visual }`.
2. **Modelo de imagen** renderiza a 1024×1024 con fondo transparente.

Si el proveedor no soporta transparencia nativa, pasar por remoción de fondo
antes de guardar. Verificar contra documentación actual del proveedor.

### Restricciones

- **Estilo bloqueado.** Crear `estilo-iconos.md`, versionado, con el sufijo
  exacto de prompt (material, iluminación, ángulo, paleta) y referencias a 2–3
  íconos existentes de la librería. Sin esto el estilo deriva en semanas.
- **Legibilidad a 68 px.** Los íconos se renderizan a 68 px máximo. El prompt
  debe pedir silueta gruesa, sin líneas finas, sin texto, sin detalle interno.
  La vista previa en el selector debe mostrarse **ya escalada a 68 px**.
- **Deduplicación por alias.** Antes de llamar al modelo, normalizar el término
  y buscarlo contra los alias del manifiesto. Al aprobar, escribir el término
  que originó la generación como alias nuevo.

### Disparador

El botón `[Generar ícono]` aparece **solo** cuando el buscador no encuentra
nada. No generar automáticamente en cada búsqueda vacía.

---

## 2. Imágenes

Dos tipos con reglas opuestas. No mezclarlos en un solo flujo.

### 2a. Contextual (portada, ambiente, regreso a clases)

Riesgo bajo. Se automatiza completa, con selección humana entre candidatos.

Fuentes permitidas: Unsplash, Pexels, Openverse. Stock de pago si hay cuenta.

**Prohibido jalar de resultados de búsqueda de imágenes genéricos.** La cuenta
es de un médico identificable; es exposición legal, no tecnicismo.

Claude genera los criterios de búsqueda a partir del slide:

```json
{
  "query": "children classroom backpacks school",
  "criterios": "niños, ambiente escolar, sin rostros enfermos",
  "descartar": "gimnasio, adultos, equipo deportivo"
}
```

El campo `descartar` es lo que habría atrapado la foto del gimnasio.

### 2b. Clínica (fotos de la condición)

**Riesgo alto. Nunca se inserta automáticamente.**

Stock genérico no sirve: buscar "impétigo" en bancos generales devuelve acné,
dermatitis y eczema mal etiquetados.

Fuentes candidatas: CDC PHIL (dominio público), Wikimedia Commons (CC),
DermNet (verificar licencia para uso comercial antes de integrar).

Reglas:
- Cola separada, distinta de la contextual, visualmente distinta en la UI.
- El sistema propone, el médico aprueba. Sin excepción.
- El manifiesto guarda fuente, licencia y quién aprobó.

---

## 3. Reglas duras

Estas no son preferencias de implementación:

1. Ninguna imagen clínica entra sin aprobación explícita del médico.
2. Ninguna imagen sin licencia verificada y registrada.
3. El ZIP de exportación incluye `creditos.txt` junto a `copy.txt`, con la
   atribución de cada imagen usada.

---

## 4. Fases

Entregar y verificar una a la vez. No empezar la siguiente sin confirmación.

| Fase | Alcance |
|---|---|
| 0 | Responder la sección "Verificar primero" |
| 1 | Staging + aprobación por `rename()`, con archivos puestos a mano |
| 2 | Generación de íconos (dos etapas + `estilo-iconos.md`) |
| 3 | Deduplicación por alias y persistencia del manifiesto |
| 4 | Imágenes contextuales |
| 5 | Imágenes clínicas + `creditos.txt` |

La fase 1 sin generación permite probar la tubería completa aislada del
proveedor de imagen. Si algo se rompe ahí, se rompe barato.
