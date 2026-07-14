<p align="center">
  <img src="https://raw.githubusercontent.com/GegesVTT/gg-sheet-export/main/docs/images/icon.png" width="120" alt="GG Sheet Export">
</p>

<h1 align="center">GG Sheet Export</h1>

<p align="center">
  <em>Familia GegesVTT</em> · Visor de lectura elegante para hojas de personaje de D&D 5e en Foundry VTT,<br>
  con exportación a <strong>PDF</strong> (impresión nativa, vectorial) y <strong>Markdown</strong> (listo para Obsidian).
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/GegesVTT/gg-sheet-export/main/docs/images/cover.png" width="100%" alt="GG Sheet Export — GegesVTT">
</p>

---

## Capturas

**Antes / después** — la misma ficha, nativa de Foundry vs. exportada con el módulo:

![Antes y después](https://raw.githubusercontent.com/GegesVTT/gg-sheet-export/main/docs/images/screenshot-antes-despues.jpg)

**Todo en una sola vista** — en Foundry hay que saltar entre pestañas para ver combate, conjuros, rasgos e inventario. El visor lo pone todo en un solo scroll:

![Todo en una sola vista](https://raw.githubusercontent.com/GegesVTT/gg-sheet-export/main/docs/images/screenshot-una-sola-vista.jpg)

**Una ficha real de mesa** — conjuros, inventario y biografía de un personaje de campaña real:

![Ficha real de mesa](https://raw.githubusercontent.com/GegesVTT/gg-sheet-export/main/docs/images/screenshot-ficha-real.jpg)

---

## Instalación

1. Copiá la carpeta `gg-sheet-export` dentro de `Data/modules/` de tu instalación de Foundry, **o** instalá directamente con la URL de manifiesto:
   ```
   https://github.com/GegesVTT/gg-sheet-export/releases/latest/download/module.json
   ```
2. Activá **GG Sheet Export** en *Manage Modules* de tu mundo dnd5e.
3. Abrí cualquier ficha de personaje o PNJ: vas a ver un ícono de libro abierto 📖 en el header de la ventana.

## Uso

- **📖 Vista de lectura**: abre una ventana de solo lectura con toda la ficha ordenada — combate, características, habilidades, ataques, conjuros por nivel, rasgos, inventario y biografía — con la estética Crónicas Bárdicas (roble negro + ámbar).
- **Exportar PDF**: abre una ventana con versión de imprenta (fondo claro, tipografía serif, cortes de página limpios) y dispara el diálogo de impresión. Elegí **"Guardar como PDF"** como destino: el resultado es un PDF vectorial de alta calidad, no una captura rasterizada.
- **Exportar Markdown**: descarga un `.md` con tablas y encabezados, pensado para Obsidian o cualquier vault de notas.

> Si el navegador bloquea la ventana del PDF, permití ventanas emergentes para tu dominio de Foundry.

## API para macros

```js
const actor = game.actors.getName("Rahegal");
const api = game.modules.get("gg-sheet-export").api;

api.open(actor);                 // abre el visor
await api.exportPdf(actor);      // exporta a PDF directo
await api.exportMarkdown(actor); // descarga el .md
```

## Compatibilidad

- Foundry VTT v12–v13.
- Sistema **dnd5e** (probado con las hojas ApplicationV2 modernas; también agrega el botón en hojas legacy V1).
- Tipos de actor soportados: `character` y `npc`.

## Notas técnicas

- La extracción de datos (`scripts/extract.mjs`) usa optional chaining en todas las rutas del data model de dnd5e, con fallbacks para las diferencias entre dnd5e 3.x, 4.x (activities) y 5.x. Si una versión futura cambia la estructura, lo esperable es que un campo aparezca como `—` en vez de romper el módulo.
- Las fórmulas de daño con variables sin resolver (ej. `1 + @mod` en ataques desarmados o armas naturales) se resuelven con `Roll.replaceFormulaData` antes de mostrarse, usando el `rollData` propio del ítem.
- El PDF usa `window.print()` sobre un documento HTML dedicado con `@page` A4. Esto da tipografía vectorial perfecta y respeta `break-inside` — muy superior a soluciones basadas en html2canvas/jsPDF.
- Las fuentes Cinzel y Cormorant Garamond se cargan de Google Fonts en el documento de imprenta; sin conexión, degradan a Georgia/serif sin romper el layout.

## Extender a otros sistemas

El diseño separa extracción (`extract.mjs`) de presentación (template, `print.mjs`, `markdown.mjs`). Para soportar otro sistema (p. ej. Daggerheart), alcanza con escribir un extractor alternativo que devuelva el mismo objeto plano y elegirlo según `game.system.id`.

---

<p align="center"><em>GG Sheet Export · GegesVTT · Crónicas de un Bardo</em></p>
