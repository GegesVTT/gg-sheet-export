/**
 * GG Sheet Export — main.mjs
 * Punto de entrada: registra el botón en el header de las fichas de actor
 * (hojas ApplicationV2 de dnd5e en v13 y hojas legacy V1) y define el visor.
 */

import { extractActorData } from "./extract.mjs";
import { actorToMarkdown } from "./markdown.mjs";
import { buildPrintHTML } from "./print.mjs";

const MODULE_ID = "gg-sheet-export";
const SUPPORTED_TYPES = ["character", "npc"];

/* ---------- acciones de exportación ---------- */

async function exportPdf(actor) {
  const data = await extractActorData(actor);
  const html = buildPrintHTML(data);
  const win = window.open("", "_blank");
  if (!win) {
    ui.notifications.warn(game.i18n.localize("GGSE.PopupBlocked"));
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
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
  const actor = app.document;
  if (!(actor instanceof Actor) || !SUPPORTED_TYPES.includes(actor.type)) return;
  if (app instanceof GGSheetViewer) return;

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
      exportMarkdown
    };
  }
  console.log(`${MODULE_ID} | GG Sheet Export listo (GegesVTT)`);
});
