<p align="center">
  <img src="https://raw.githubusercontent.com/GegesVTT/gg-sheet-export/main/docs/images/icon.png" width="120" alt="GG Sheet Export">
</p>

<h1 align="center">GG Sheet Export</h1>

<p align="center">
  <strong>Clean, printable D&D 5e character sheets straight from Foundry VTT</strong><br>
  Reading view · vector-crisp <strong>PDF</strong> (native print) · <strong>Markdown</strong> (Obsidian-ready)
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Foundry-v12-green" alt="Foundry v12">
  <img src="https://img.shields.io/badge/Foundry-v13-green" alt="Foundry v13">
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="License: MIT">
  <img src="https://img.shields.io/github/v/release/GegesVTT/gg-sheet-export" alt="Latest Release">
</p>

<p align="center"><strong>English</strong> · <a href="#-español">Español</a></p>

<p align="center">
  <img src="https://raw.githubusercontent.com/GegesVTT/gg-sheet-export/main/docs/images/cover.png" width="100%" alt="GG Sheet Export — GegesVTT">
</p>

---

## Screenshots

**Before / after** — the same sheet, native Foundry vs. exported with the module:

![Before and after](https://raw.githubusercontent.com/GegesVTT/gg-sheet-export/main/docs/images/screenshot-antes-despues.jpg)

**Everything in one view** — Foundry makes you hop between tabs for combat, spells, features and inventory. The reading view puts the whole character in a single scroll:

![Everything in one view](https://raw.githubusercontent.com/GegesVTT/gg-sheet-export/main/docs/images/screenshot-una-sola-vista.jpg)

**A real table sheet** — spells, inventory and biography from an actual campaign character:

![Real table sheet](https://raw.githubusercontent.com/GegesVTT/gg-sheet-export/main/docs/images/screenshot-ficha-real.jpg)

---

## ✨ Features

- **📖 Reading view** — the entire character on one scroll: combat, abilities, skills, attacks, spells by level, features, inventory, biography. No tab-hopping.
- **Export to PDF** — a print-ready layout (warm parchment look, serif type, clean page breaks). Uses the browser's **native print**, so the PDF comes out vector-crisp — not a blurry screenshot.
- **Export to Markdown** — tables and headers, drops straight into Obsidian or any notes vault.
- **Built to be used at the table**: bubbles to pencil in spell slots as you burn them, death save trackers, hit dice, a line for temp HP. Spells grouped by level, features grouped by source, inventory grouped by category with total weight.
- Works for **characters and NPCs**, fully localized in **English and Spanish**.

## 💡 Beyond the printed page

Ideas straight from the community:

- **Feed your character to an LLM** — the Markdown export is perfect context for NotebookLM, Claude or ChatGPT (and uses far fewer tokens than a PDF).
- **Help new players learn their sheet** — the reading view shows the whole character in plain, ordered form, without Foundry's UI in the way.

## 📦 Installation

In Foundry: **Add-on Modules → Install Module** and paste the manifest URL:

```
https://github.com/GegesVTT/gg-sheet-export/releases/latest/download/module.json
```

Then enable **GG Sheet Export** in *Manage Modules* of your dnd5e world. (Manual alternative: drop the `gg-sheet-export` folder into `Data/modules/`.)

## 🚀 Usage

Open any character or NPC sheet — you'll see an open-book 📖 icon in the window header.

- **Reading view**: a read-only window with the whole sheet, in the Crónicas Bárdicas look (black oak + amber).
- **Export PDF**: the print dialog opens right over Foundry — pick **"Save as PDF"** as destination. Since v1.2.4 no pop-up window is needed, so it works in the Foundry desktop app too.
- **Export Markdown**: downloads a `.md` with tables and headers.

> If the print dialog ever fails to open, the module falls back to a pop-up window — allow pop-ups for your Foundry domain in that case.

## 🔌 Macro API

```js
const actor = game.actors.getName("Rahegal");
const api = game.modules.get("gg-sheet-export").api;

api.open(actor);                 // open the reading view
await api.exportPdf(actor);      // print/export to PDF
await api.exportMarkdown(actor); // download the .md
```

## ✅ Compatibility

- Foundry VTT **v12–v13**.
- **dnd5e** system (tested with the modern ApplicationV2 sheets; the button is also added to legacy V1 sheets).
- Actor types: `character` and `npc`.

## 🛠️ Technical notes

- Data extraction (`scripts/extract.mjs`) uses optional chaining on every dnd5e data-model path, with fallbacks covering the differences between dnd5e 3.x, 4.x (activities) and 5.x. If a future version changes the structure, the expected failure mode is a field showing `—`, not the module breaking.
- Damage formulas with unresolved variables (e.g. `1 + @mod` on unarmed strikes or natural weapons) are resolved with `Roll.replaceFormulaData` using the item's own `rollData` before display.
- The PDF uses `window.print()` on a dedicated HTML document with an A4 `@page` — perfect vector typography and proper `break-inside` handling, far superior to html2canvas/jsPDF approaches. Printing runs in a hidden iframe, so no pop-ups are required.
- Cinzel and Cormorant Garamond load from Google Fonts in the print document; offline, they degrade to Georgia/serif without breaking the layout.

## 🧭 Roadmap & other systems

The design separates extraction (`extract.mjs`) from presentation (template, `print.mjs`, `markdown.mjs`): supporting another system means writing an extractor that returns the same flat object, selected by `game.system.id`.

- **Pathfinder 2e support is in the works** for v1.3.0.
- Daggerheart is on the radar. Playing something else? [Open an issue](https://github.com/GegesVTT/gg-sheet-export/issues).

## 🏷️ Keywords

character sheet · print · printable · PDF export · Markdown · Obsidian · reading view · D&D 5e · dnd5e · hybrid table · in-person · paper · NPC statblock · LLM context

## 📜 License

MIT — © Geges

Part of the **GegesVTT** family: [GG Calendar](https://github.com/GegesVTT/gg-calendar) · [GG Nameforge](https://github.com/GegesVTT/gg-nameforge)

---

## 🇪🇸 Español

**Fichas de personaje de D&D 5e limpias e imprimibles, directo desde Foundry VTT.** Visor de lectura · **PDF** vectorial (impresión nativa) · **Markdown** (listo para Obsidian).

### ✨ Características

- **📖 Vista de lectura** — todo el personaje en un solo scroll: combate, características, habilidades, ataques, conjuros por nivel, rasgos, inventario y biografía. Sin saltar entre pestañas.
- **Exportar PDF** — versión de imprenta (fondo pergamino cálido, tipografía serif, cortes de página limpios). Usa la **impresión nativa** del navegador: el PDF sale vectorial y nítido, no una captura borrosa.
- **Exportar Markdown** — tablas y encabezados, listo para Obsidian o cualquier vault de notas.
- **Pensado para usarse en la mesa**: burbujas para marcar con lápiz los espacios de conjuro, salvaciones de muerte, dados de golpe y una línea para PG temporales. Conjuros agrupados por nivel, rasgos por origen, inventario por categoría con peso total.
- Funciona con **personajes y PNJs**, localizado en **español e inglés**.

### 💡 Más allá del papel

Ideas que trajo la comunidad:

- **Dale tu personaje a una IA** — el Markdown es contexto perfecto para NotebookLM, Claude o ChatGPT (y gasta muchos menos tokens que un PDF).
- **Ayudá a jugadores nuevos a entender su ficha** — el visor muestra el personaje completo, ordenado y sin la interfaz de Foundry en el medio.

### 📦 Instalación

En Foundry: **Módulos Complementarios → Instalar Módulo** y pegá la URL de manifiesto:

```
https://github.com/GegesVTT/gg-sheet-export/releases/latest/download/module.json
```

Después activá **GG Sheet Export** en *Gestionar Módulos* de tu mundo dnd5e. (Alternativa manual: copiá la carpeta `gg-sheet-export` dentro de `Data/modules/`.)

### 🚀 Uso

Abrí cualquier ficha de personaje o PNJ: vas a ver un ícono de libro abierto 📖 en el header de la ventana.

- **Vista de lectura**: ventana de solo lectura con toda la ficha, con la estética Crónicas Bárdicas (roble negro + ámbar).
- **Exportar PDF**: el diálogo de impresión se abre sobre la misma ventana de Foundry — elegí **"Guardar como PDF"** como destino. Desde v1.2.4 no hace falta ninguna ventana emergente, así que también funciona en la app de escritorio de Foundry.
- **Exportar Markdown**: descarga un `.md` con tablas y encabezados.

> Si el diálogo de impresión no llegara a abrirse, el módulo recurre a una ventana emergente — en ese caso, permití ventanas emergentes para tu dominio de Foundry.

### 🔌 API para macros

```js
const actor = game.actors.getName("Rahegal");
const api = game.modules.get("gg-sheet-export").api;

api.open(actor);                 // abre el visor
await api.exportPdf(actor);      // exporta a PDF
await api.exportMarkdown(actor); // descarga el .md
```

### ✅ Compatibilidad

- Foundry VTT **v12–v13**.
- Sistema **dnd5e** (probado con las hojas ApplicationV2 modernas; también agrega el botón en hojas legacy V1).
- Tipos de actor: `character` y `npc`.

### 🧭 Hoja de ruta y otros sistemas

El diseño separa extracción (`extract.mjs`) de presentación (template, `print.mjs`, `markdown.mjs`): soportar otro sistema es escribir un extractor que devuelva el mismo objeto plano, elegido según `game.system.id`.

- **El soporte de Pathfinder 2e está en desarrollo** para la v1.3.0.
- Daggerheart está en el radar. ¿Jugás otra cosa? [Abrí un issue](https://github.com/GegesVTT/gg-sheet-export/issues).

### 🏷️ Palabras clave

ficha de personaje · imprimir · imprimible · exportar PDF · Markdown · Obsidian · vista de lectura · D&D 5e · dnd5e · mesa híbrida · presencial · papel · PNJ · contexto para IA

### 📜 Licencia

MIT — © Geges

Parte de la familia **GegesVTT**: [GG Calendar](https://github.com/GegesVTT/gg-calendar) · [GG Nameforge](https://github.com/GegesVTT/gg-nameforge)

---

<p align="center"><em>GG Sheet Export · GegesVTT · Crónicas Bárdicas</em></p>
