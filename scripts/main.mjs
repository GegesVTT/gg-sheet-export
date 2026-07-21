/**
 * GG Sheet Export — main.mjs
 * Punto de entrada: registra el botón en el header de las fichas de actor
 * (hojas ApplicationV2 de dnd5e en v13 y hojas legacy V1) y define el visor.
 */

import { actorToMarkdown } from "./markdown.mjs";
import { buildPrintHTML, buildStandaloneHTML } from "./print.mjs";
import { extractJournalData } from "./extract-journal.mjs";
import { journalToMarkdown } from "./journal-markdown.mjs";
import { buildJournalPrintHTML, buildJournalStandaloneHTML, buildJournalBody } from "./journal-print.mjs";
import { extractSpellCards } from "./extract-spellcards.mjs";
import { buildCardsBody, buildCardsPrintHTML, themeStyle, CARDS_CSS, fitSpellCards, THEMES, registerCardTheme } from "./spellcards-print.mjs";

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

/* ---------- exportación de journals ----------
   Los journals no dependen del sistema, así que estas acciones funcionan en
   cualquier mundo. El estilo es propio (tomo/manuscrito, ver journal-print.mjs)
   y comparten el pipeline de impresión nativa con las fichas. */

/** ¿Incluir los bloques secretos (contenido de GM) en el export? Por defecto no. */
function journalIncludeSecrets() {
  try { return game.settings.get(MODULE_ID, "journalIncludeSecrets") === true; }
  catch (e) { return false; }
}

/** Impresión vía iframe oculto (mismo enfoque que la ficha desde v1.2.4). */
function printHTMLToFrame(html) {
  try {
    document.getElementById("ggse-print-frame")?.remove();
    const frame = document.createElement("iframe");
    frame.id = "ggse-print-frame";
    frame.style.cssText = "position:fixed; right:0; bottom:0; width:0; height:0; border:0; visibility:hidden;";
    frame.srcdoc = html;
    frame.addEventListener("load", () => {
      try {
        frame.contentWindow.addEventListener("afterprint", () => frame.remove());
      } catch (e) { /* se recicla en el próximo export */ }
    });
    document.body.appendChild(frame);
    return true;
  } catch (e) {
    console.warn(`${MODULE_ID} | Falló la impresión por iframe`, e);
    return false;
  }
}

async function exportJournalPdf(journal) {
  const data = await extractJournalData(journal, { includeSecrets: journalIncludeSecrets() });
  const html = buildJournalPrintHTML(data);
  if (printHTMLToFrame(html)) return;

  const win = window.open("", "_blank");
  if (!win) { ui.notifications.warn(game.i18n.localize("GGSE.PopupBlocked")); return; }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

async function exportJournalHtml(journal) {
  const data = await extractJournalData(journal, { includeSecrets: journalIncludeSecrets() });
  const html = await buildJournalStandaloneHTML(data);
  const save = foundry.utils.saveDataToFile ?? globalThis.saveDataToFile;
  const slug = journal.name.slugify?.() ?? journal.name.toLowerCase().replace(/\s+/g, "-");
  save(html, "text/html", `${slug}.html`);
  ui.notifications.info(game.i18n.format("GGSE.HtmlSaved", { name: journal.name }));
}

async function exportJournalMarkdown(journal) {
  const data = await extractJournalData(journal, { includeSecrets: journalIncludeSecrets() });
  const md = journalToMarkdown(data);
  const save = foundry.utils.saveDataToFile ?? globalThis.saveDataToFile;
  const slug = journal.name.slugify?.() ?? journal.name.toLowerCase().replace(/\s+/g, "-");
  save(md, "text/markdown", `${slug}.md`);
  ui.notifications.info(game.i18n.format("GGSE.MdSaved", { name: journal.name }));
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
      ggseExportMd: GGSheetViewer.#onExportMd,
      ggseExportSpellCards: GGSheetViewer.#onExportSpellCards
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

  static async #onExportSpellCards() {
    openSpellCardsViewer(this.actor);
  }
}

function openViewer(actor) {
  new GGSheetViewer(actor).render(true);
}

/* ---------- visor de lectura de journals ---------- */

class GGJournalViewer extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(journal, options = {}) {
    super(options);
    this.journal = journal;
  }

  static DEFAULT_OPTIONS = {
    classes: ["gg-sheet-export"],
    tag: "div",
    window: {
      icon: "fa-solid fa-book-open",
      resizable: true,
      contentClasses: ["ggse-content"]
    },
    position: { width: 820, height: 900 },
    actions: {
      ggseJExportPdf: GGJournalViewer.#onExportPdf,
      ggseJExportHtml: GGJournalViewer.#onExportHtml,
      ggseJExportMd: GGJournalViewer.#onExportMd
    }
  };

  static PARTS = {
    body: {
      template: `modules/${MODULE_ID}/templates/journal-viewer.hbs`,
      scrollable: [".ggse-scroll"]
    }
  };

  get id() {
    return `ggse-jrnl-viewer-${this.journal.uuid.replaceAll(".", "-")}`;
  }

  get title() {
    return `${this.journal.name} — ${game.i18n.localize("GGSE.ViewerTitle")}`;
  }

  async _prepareContext(_options) {
    const data = await extractJournalData(this.journal, { includeSecrets: journalIncludeSecrets() });
    return { name: data.name, bodyHtml: buildJournalBody(data) };
  }

  static async #onExportPdf() { await exportJournalPdf(this.journal); }
  static async #onExportHtml() { await exportJournalHtml(this.journal); }
  static async #onExportMd() { await exportJournalMarkdown(this.journal); }
}

function openJournalViewer(journal) {
  new GGJournalViewer(journal).render(true);
}

/* ---------- tarjetas de conjuros (D&D 5e) ----------
   Módulo aparte con estética por tema (hoy "cronicas"; a futuro, packs). Solo
   D&D 5e por ahora. Salida a doble faz, tamaño póker, lista para cortar. */

function spellCardTheme() {
  try { return game.settings.get(MODULE_ID, "spellCardTheme") || "cronicas"; }
  catch (e) { return "cronicas"; }
}

async function exportSpellCardsPdf(actor) {
  const data = await extractSpellCards(actor);
  if (!data.spellCount) { ui.notifications.warn(game.i18n.localize("GGSE.Cards.NoSpells")); return; }
  const html = buildCardsPrintHTML(data, spellCardTheme());
  if (printHTMLToFrame(html)) return;

  const win = window.open("", "_blank");
  if (!win) { ui.notifications.warn(game.i18n.localize("GGSE.PopupBlocked")); return; }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

class GGSpellCardsViewer extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
  }

  static DEFAULT_OPTIONS = {
    classes: ["gg-sheet-export"],
    tag: "div",
    window: { icon: "fa-solid fa-wand-sparkles", resizable: true, contentClasses: ["ggse-content"] },
    position: { width: 900, height: 900 },
    actions: { ggseCardsPdf: GGSpellCardsViewer.#onExportPdf }
  };

  static PARTS = {
    body: { template: `modules/${MODULE_ID}/templates/spell-cards-viewer.hbs`, scrollable: [".ggse-scroll"] }
  };

  get id() { return `ggse-cards-viewer-${this.actor.id}`; }
  get title() { return `${this.actor.name} — ${game.i18n.localize("GGSE.Cards.Title")}`; }

  async _prepareContext(_options) {
    const data = await extractSpellCards(this.actor);
    const theme = spellCardTheme();
    return {
      cardsCss: themeStyle(theme) + CARDS_CSS,
      bodyHtml: buildCardsBody(data, theme, { mirror: false })
    };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    // Ajuste de dorsos igual que en el PDF, para que la vista previa sea fiel.
    try { fitSpellCards(this.element); } catch (e) { /* noop */ }
  }

  static async #onExportPdf() { await exportSpellCardsPdf(this.actor); }
}

function openSpellCardsViewer(actor) {
  new GGSpellCardsViewer(actor).render(true);
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

/* ---------- botones en el header de los journals ----------
   Los journals existen en cualquier sistema, así que estos hooks no se filtran
   por game.system.id. */

/** Hojas de journal legacy (ApplicationV1, Foundry v12). */
Hooks.on("getJournalSheetHeaderButtons", (sheet, buttons) => {
  const journal = sheet.document ?? sheet.object;
  if (!(journal instanceof JournalEntry)) return;
  buttons.unshift({
    label: game.i18n.localize("GGSE.Button"),
    class: "ggse-header-btn",
    icon: "fa-solid fa-book-open",
    onclick: () => openJournalViewer(journal)
  });
});

/** Hojas de journal ApplicationV2 (Foundry v13): inyección DOM en el header. */
Hooks.on("renderApplicationV2", (app, element) => {
  const journal = app.document;
  if (!(journal instanceof JournalEntry)) return;
  if (app instanceof GGJournalViewer) return;
  // Solo la hoja del JournalEntry, no los editores de página sueltos (que son
  // AppV2 con un JournalEntryPage como document — ya excluidos por el instanceof
  // de arriba — ni otras ventanas con un journal asociado).
  const JournalEntrySheet = foundry.applications?.sheets?.journal?.JournalEntrySheet;
  if (JournalEntrySheet && !(app instanceof JournalEntrySheet)) return;

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
    openJournalViewer(journal);
  });

  const close = header.querySelector('[data-action="close"]');
  header.insertBefore(btn, close ?? null);
});

/** Menú contextual del directorio de journals (clic derecho → exportar). */
Hooks.on("getJournalDirectoryEntryContext", (html, options) => {
  options.push({
    name: game.i18n.localize("GGSE.Button"),
    icon: '<i class="fa-solid fa-book-open"></i>',
    callback: (li) => {
      const el = li?.[0] ?? li; // jQuery (v12) u HTMLElement (v13)
      const id = el?.dataset?.entryId ?? el?.dataset?.documentId;
      const journal = id ? game.journal.get(id) : null;
      if (journal) openJournalViewer(journal);
    }
  });
});

/** Menú contextual del directorio de actores (clic derecho → tarjetas). */
Hooks.on("getActorDirectoryEntryContext", (html, options) => {
  const resolve = (li) => {
    const el = li?.[0] ?? li;
    const id = el?.dataset?.entryId ?? el?.dataset?.documentId;
    return id ? game.actors.get(id) : null;
  };
  options.push({
    name: game.i18n.localize("GGSE.Cards.Button"),
    icon: '<i class="fa-solid fa-wand-sparkles"></i>',
    condition: (li) => {
      const actor = resolve(li);
      return !!actor && game.system.id === "dnd5e" && actor.items.some((i) => i.type === "spell");
    },
    callback: (li) => {
      const actor = resolve(li);
      if (actor) openSpellCardsViewer(actor);
    }
  });
});

/* ---------- init: ajustes + API pública ---------- */

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "journalIncludeSecrets", {
    name: "GGSE.Journal.SettingSecretsName",
    hint: "GGSE.Journal.SettingSecretsHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  // Tema de las tarjetas. Las choices se arman desde el registro de themes y
  // se refrescan cuando un módulo satélite registra el suyo (registerCardTheme).
  const themeChoices = () => Object.fromEntries(Object.values(THEMES).map((t) => [t.id, t.name]));
  game.settings.register(MODULE_ID, "spellCardTheme", {
    name: "GGSE.Cards.SettingThemeName",
    hint: "GGSE.Cards.SettingThemeHint",
    scope: "world",
    config: true,
    type: String,
    choices: themeChoices(),
    default: "cronicas"
  });

  // Fusionar conjuros duplicados (mismo nombre + nivel). Apagado por defecto.
  game.settings.register(MODULE_ID, "spellCardDedupe", {
    name: "GGSE.Cards.SettingDedupeName",
    hint: "GGSE.Cards.SettingDedupeHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  // API pública.
  const mod = game.modules.get(MODULE_ID);
  if (mod) {
    mod.api = {
      open: openViewer,
      exportPdf,
      exportHtml,
      exportMarkdown,
      openJournal: openJournalViewer,
      exportJournalPdf,
      exportJournalHtml,
      exportJournalMarkdown,
      openSpellCards: openSpellCardsViewer,
      exportSpellCards: exportSpellCardsPdf,
      /** Para packs de themes (módulos satélite). Ver esquema en spellcards-print.mjs */
      registerCardTheme: (theme) => {
        const ok = registerCardTheme(theme);
        if (ok) {
          // refrescar las opciones del selector ya registrado
          const s = game.settings.settings.get(`${MODULE_ID}.spellCardTheme`);
          if (s) s.choices = themeChoices();
        }
        return ok;
      }
    };
  }
  console.log(`${MODULE_ID} | GG Sheet Export listo — sistema: ${game.system.id} (GegesVTT)`);
});
