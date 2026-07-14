# GG Sheet Export

**Familia GegesVTT** · Visor de lectura elegante para hojas de personaje de D&D 5e en Foundry VTT, con exportación a **PDF** (impresión nativa, vectorial) y **Markdown** (listo para Obsidian).

## Instalación

1. Copiá la carpeta `gg-sheet-export` dentro de `Data/modules/` de tu instalación de Foundry.
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

api.open(actor);            // abre el visor
await api.exportPdf(actor); // exporta a PDF directo
await api.exportMarkdown(actor); // descarga el .md
```

## Compatibilidad

- Foundry VTT v12–v13.
- Sistema **dnd5e** (probado con las hojas ApplicationV2 modernas; también agrega el botón en hojas legacy V1).
- Tipos de actor soportados: `character` y `npc`.

## Notas técnicas

- La extracción de datos (`scripts/extract.mjs`) usa optional chaining en todas las rutas del data model de dnd5e, con fallbacks para las diferencias entre dnd5e 3.x, 4.x (activities) y 5.x. Si una versión futura cambia la estructura, lo esperable es que un campo aparezca como `—` en vez de romper el módulo.
- El PDF usa `window.print()` sobre un documento HTML dedicado con `@page` A4. Esto da tipografía vectorial perfecta y respeta `break-inside` — muy superior a soluciones basadas en html2canvas/jsPDF.
- Las fuentes Cinzel y Cormorant Garamond se cargan de Google Fonts en el documento de imprenta; sin conexión, degradan a Georgia/serif sin romper el layout.

## Extender a otros sistemas

El diseño separa extracción (`extract.mjs`) de presentación (template, `print.mjs`, `markdown.mjs`). Para soportar otro sistema (p. ej. Daggerheart), alcanza con escribir un extractor alternativo que devuelva el mismo objeto plano y elegirlo según `game.system.id`.

---

*GG Sheet Export v1.0.0 · GegesVTT · Crónicas Bárdicas*
