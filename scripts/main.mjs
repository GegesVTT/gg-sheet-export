/**
 * GG Sheet Export — main.mjs
 * Punto de entrada: registra el botón en el header de las fichas de actor
 * (hojas ApplicationV2 de dnd5e en v13 y hojas legacy V1) y define el visor.
 */

import { actorToMarkdown } from "./markdown.mjs";
import { buildPrintHTML, buildStandaloneHTML } from "./print.mjs";

const MODULE_ID = "gg-sheet-export";
const SUPPORTED_TYPES = ["character", "npc"];

/* ---------- despacho por sistema ----------
   La extracción depende del sistema; la presentación (template, print, markdown) no.
   Cada extractor exporta extractActorData(actor) y devuelve un objeto plano.
   Se importa bajo demanda: en un mundo dnd5e nunca se carga el código de pf2e. */

const EXTRACTORS = {
  dnd5e: () => import("./extract.mjs"),
  pf2e: () => import("./extract-pf2e.mjs")
};

function isSupportedSystem() {
  return game.system.id in EXTRACTORS;
}

async function extractActorData(actor) {
  const load = EXTRACTORS[game.system.id];
  if (!load) throw new Error(`${MODULE_ID} | sistema no soportado: ${game.system.id}`);
  const mod = await load();
  return await mod.extractActorData(actor);
}

/* ---------- acciones de exportación ---------- */

async function exportPdf(actor) {
  const data = await extractActorData(actor);
  const html = buildPrintHTML(data);

  // Impresión vía iframe oculto: el diálogo de imprimir se abre sobre la misma
  // ventana de Foundry, sin depender de ventanas emergentes — que la app nativa
  // (Electron) y varios navegadores bloquean por defecto (bug reportado en v1.2.x).
  // El documento de imprenta se auto-imprime al cargar (script embebido en print.mjs).
  try {
    document.getElementById("ggse-print-frame")?.remove();
    const frame = document.createElement("iframe");
    frame.id = "ggse-print-frame";
    frame.style.cssText = "position:fixed; right:0; bottom:0; width:0; height:0; border:0; visibility:hidden;";
    frame.srcdoc = html;
    frame.addEventListener("load", () => {
      try {
        frame.contentWindow.addEventListener("afterprint", () => frame.remove());
      } catch (e) { /* sin cleanup inmediato: el frame se recicla en el próximo export */ }
    });
    document.body.appendChild(frame);
    return;
  } catch (e) {
    console.warn(`${MODULE_ID} | Falló la impresión por iframe, probando ventana emergente`, e);
  }

  // Fallback: ventana emergente (comportamiento previo a v1.2.4).
  const win = window.open("", "_blank");
  if (!win) {
    ui.notifications.warn(game.i18n.localize("GGSE.PopupBlocked"));
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

async function exportHtml(actor) {
  const data = await extractActorData(actor);
  const html = await buildStandaloneHTML(data);
  const save = foundry.utils.saveDataToFile ?? globalThis.saveDataToFile;
  const slug = actor.name.slugify?.() ?? actor.name.toLowerCase().replace(/\s+/g, "-");
  save(html, "text/html", `${slug}.html`);
  ui.notifications.info(game.i18n.format("GGSE.HtmlSaved", { name: actor.name }));
}

async function exportMarkdown(actor) {
  const data = await extractActorData(actor);
  const md = actorToMarkdown(data);
  const save = foundry.utils.saveDataToFile ?? globalThis.saveDataToFile;
  const slug = actor.name.slugify?.() ?? actor.name.toLowerCase().replace(/\s+/g, "-");
  save(md, "text/markdown", `${slug}.md`);
  ui.notifications.info(game.i18n.format("GGSE.MdSaved", { name: actor.name }));
}

/* ---------- visor de lectura ---------- */

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

class GGSheetViewer extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
  }

  static DEFAULT_OPTIONS = {
    classes: ["gg-sheet-export"],
    tag: "div",
    window: {
      icon: "fa-solid fa-book-open",
      resizable: true,
      contentClasses: ["ggse-content"]
    },
    position: { width: 880, height: 900 },
    actions: {
      ggseExportPdf: GGSheetViewer.#onExportPdf,
      ggseExportHtml: GGSheetViewer.#onExportHtml,
      ggseExportMd: GGSheetViewer.#onExportMd
    }
  };

  static PARTS = {
    body: {
      template: `modules/${MODULE_ID}/templates/viewer.hbs`,
      scrollable: [".ggse-scroll"]
    }
  };

  get id() {
    return `ggse-viewer-${this.actor.uuid.replaceAll(".", "-")}`;
  }

  get title() {
    return `${this.actor.name} — ${game.i18n.localize("GGSE.ViewerTitle")}`;
  }

  async _prepareContext(_options) {
    return await extractActorData(this.actor);
  }

  static async #onExportPdf() {
    await exportPdf(this.actor);
  }

  static async #onExportHtml() {
    await exportHtml(this.actor);
  }

  static async #onExportMd() {
    await exportMarkdown(this.actor);
  }
}

function openViewer(actor) {
  new GGSheetViewer(actor).render(true);
}

/* ---------- botones en el header de las fichas ---------- */

/** Hojas legacy (ApplicationV1). */
Hooks.on("getActorSheetHeaderButtons", (sheet, buttons) => {
  if (!isSupportedSystem()) return;
  const actor = sheet.actor ?? sheet.object;
  if (!actor || !SUPPORTED_TYPES.includes(actor.type)) return;
  buttons.unshift({
    label: game.i18n.localize("GGSE.Button"),
    class: "ggse-header-btn",
    icon: "fa-solid fa-book-open",
    onclick: () => openViewer(actor)
  });
});

/** Hojas ApplicationV2 (dnd5e en Foundry v13): inyección DOM en el header. */
Hooks.on("renderApplicationV2", (app, element) => {
  if (!isSupportedSystem()) return;
  const actor = app.document;
  if (!(actor instanceof Actor) || !SUPPORTED_TYPES.includes(actor.type)) return;
  if (app instanceof GGSheetViewer) return;
  // Solo hojas de actor reales: sin este guard, el botón aparecía también en los
  // diálogos de configuración de dnd5e (habilidades, movimiento, etc.), que son
  // AppV2 con el actor como document. Si la clase no existe, degradamos al
  // comportamiento previo.
  const ActorSheetV2 = foundry.applications?.sheets?.ActorSheetV2;
  if (ActorSheetV2 && !(app instanceof ActorSheetV2)) return;

  const header = element.querySelector(".window-header");
  if (!header || header.querySelector(".ggse-header-btn")) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "header-control icon fa-solid fa-book-open ggse-header-btn";
  btn.dataset.tooltip = game.i18n.localize("GGSE.Button");
  btn.setAttribute("aria-label", game.i18n.localize("GGSE.Button"));
  btn.addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    openViewer(actor);
  });

  const close = header.querySelector('[data-action="close"]');
  header.insertBefore(btn, close ?? null);
});

/* ---------- API pública ---------- */

Hooks.once("init", () => {
  const mod = game.modules.get(MODULE_ID);
  if (mod) {
    mod.api = {
      open: openViewer,
      exportPdf,
      exportHtml,
      exportMarkdown
    };
  }
  console.log(`${MODULE_ID} | GG Sheet Export listo — sistema: ${game.system.id} (GegesVTT)`);
});
