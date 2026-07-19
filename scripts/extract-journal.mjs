/**
 * GG Sheet Export — extract-journal.mjs
 * Extrae un JournalEntry a un objeto plano, independiente de la presentación.
 * Mismo criterio que extract.mjs: enriquecer el HTML de Foundry (resolviendo
 * @UUID, tiradas inline, @Embed) y devolver algo que print/markdown puedan
 * consumir sin volver a tocar la API del documento.
 *
 * Alcance actual: páginas de texto e imagen. Otros tipos (pdf, video, de
 * módulos) se listan como no exportables en vez de romper el recorrido.
 */

const loc = (k) => game.i18n.localize(k);

/** Resolución de TextEditor entre v12 (global) y v13 (namespace ux). */
function getTextEditor() {
  return foundry.applications?.ux?.TextEditor?.implementation ?? globalThis.TextEditor;
}

/**
 * Limpia el HTML enriquecido para vivir fuera de Foundry, pero —a diferencia de
 * la ficha— conserva imágenes y tablas: en un journal son contenido, no adorno.
 * Los enlaces se aplanan a <span> con el texto; se preserva en data-* la info
 * mínima para que el Markdown pueda reconstruir wiki-links de Obsidian.
 */
function sanitizeJournalHTML(html, { includeSecrets }) {
  if (!html) return "";
  const div = document.createElement("div");
  div.innerHTML = html;

  // Bloques secretos de GM: fuera salvo que se pidan explícitamente.
  div.querySelectorAll("section.secret").forEach((el) => {
    if (includeSecrets) {
      el.classList.add("ggse-secret");
      el.setAttribute("data-ggse-label", loc("GGSE.Journal.GMOnly"));
    } else {
      el.remove();
    }
  });

  // Multimedia/lógica embebida que no queremos en un export estático.
  div.querySelectorAll("script, style, iframe, audio, video").forEach((el) => el.remove());

  // Enlaces → span. Los content-link (@UUID) y externos guardan una pista en
  // data-ggse-* para que el Markdown emita [[wiki]] o [texto](url).
  div.querySelectorAll("a").forEach((a) => {
    const span = document.createElement("span");
    span.className = "ggse-link";
    const isContent = a.classList.contains("content-link") || a.hasAttribute("data-uuid");
    const href = a.getAttribute("href") || "";
    if (isContent) span.setAttribute("data-ggse-wiki", "1");
    else if (/^https?:/i.test(href)) span.setAttribute("data-ggse-href", href);
    span.textContent = a.textContent ?? "";
    a.replaceWith(span);
  });

  // Íconos sueltos de FontAwesome sin texto (botón de revelar secreto, etc.).
  div.querySelectorAll("i, span.fa, .fas, .fa-solid").forEach((el) => {
    if (!(el.textContent ?? "").trim()) el.remove();
  });

  // Atributos peligrosos o de UI de Foundry. Se conservan: class, src/alt en
  // imágenes, y los data-ggse-* que agregamos recién.
  div.querySelectorAll("*").forEach((el) => {
    for (const attr of [...el.attributes]) {
      const n = attr.name;
      if (n.startsWith("data-ggse-")) continue;
      if (el.tagName === "IMG" && (n === "src" || n === "alt")) continue;
      if (n.startsWith("on") || n === "style" || n.startsWith("data-") || n === "id") {
        el.removeAttribute(n);
      }
    }
  });

  return div.innerHTML.trim();
}

/**
 * @param {JournalEntry} journal
 * @param {{ includeSecrets?: boolean }} [opts]
 */
export async function extractJournalData(journal, { includeSecrets = false } = {}) {
  const TE = getTextEditor();
  const pages = [...journal.pages.contents].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));

  const out = [];
  for (const page of pages) {
    const base = {
      title: page.name ?? "",
      level: Number(page.title?.level ?? 1),
      showTitle: page.title?.show !== false
    };

    if (page.type === "text") {
      // format 1 = HTML (lo normal). Si una página es markdown y no tiene
      // content derivado, usamos el markdown crudo como mejor esfuerzo.
      const raw = page.text?.content || page.text?.markdown || "";
      const enriched = raw
        ? await TE.enrichHTML(raw, { secrets: includeSecrets, relativeTo: page, async: true })
        : "";
      out.push({ ...base, type: "text", html: sanitizeJournalHTML(enriched, { includeSecrets }) });
    } else if (page.type === "image") {
      out.push({ ...base, type: "image", src: page.src ?? "", caption: page.image?.caption ?? "" });
    } else {
      out.push({ ...base, type: "other", pageType: page.type });
    }
  }

  return {
    name: journal.name ?? loc("GGSE.Journal.Untitled"),
    pages: out,
    pageCount: out.length,
    includeSecrets,
    exportDate: new Date().toLocaleDateString(game.i18n.lang || "es")
  };
}
