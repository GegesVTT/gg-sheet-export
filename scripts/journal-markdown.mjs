/**
 * GG Sheet Export — journal-markdown.mjs
 * Convierte un journal extraído en un .md limpio para Obsidian/notas.
 *
 * A diferencia del htmlToMd de la ficha (regex, pensado para biografías
 * cortas), acá recorremos el DOM: los journals traen tablas, listas anidadas e
 * imágenes que un reemplazo por regex destruye. Además, los content-link de
 * Foundry se convierten en wiki-links [[...]] de Obsidian.
 */

const loc = (k) => game.i18n.localize(k);

const INDENT = "  ";

/** Texto inline de los hijos de un nodo (negrita, cursiva, enlaces, saltos). */
function inline(node) {
  let out = "";
  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      out += child.textContent.replace(/\s+/g, " ");
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const tag = child.tagName.toLowerCase();
    const inner = inline(child).trim();
    switch (tag) {
      case "strong": case "b": out += inner ? `**${inner}**` : ""; break;
      case "em": case "i": out += inner ? `*${inner}*` : ""; break;
      case "code": out += inner ? `\`${inner}\`` : ""; break;
      case "br": out += "\n"; break;
      case "span":
        if (child.hasAttribute("data-ggse-wiki")) out += `[[${inner}]]`;
        else if (child.hasAttribute("data-ggse-href")) out += `[${inner}](${child.getAttribute("data-ggse-href")})`;
        else out += inner;
        break;
      case "img": {
        const src = child.getAttribute("src") || "";
        const alt = child.getAttribute("alt") || "";
        out += `![${alt}](${src})`;
        break;
      }
      default: out += inner;
    }
  }
  return out;
}

/** Una fila de tabla → celdas de texto. */
function rowCells(tr) {
  return Array.from(tr.querySelectorAll("th, td"))
    .map((c) => inline(c).trim().replace(/\|/g, "\\|").replace(/\n/g, " "));
}

function tableToMd(table) {
  const rows = Array.from(table.querySelectorAll("tr"));
  if (!rows.length) return "";
  const headTr = table.querySelector("thead tr") || rows[0];
  const headers = rowCells(headTr);
  const bodyRows = rows.filter((tr) => tr !== headTr).map(rowCells);
  const head = `| ${headers.join(" | ")} |`;
  const sep = `|${headers.map(() => "---").join("|")}|`;
  const body = bodyRows.map((r) => `| ${r.join(" | ")} |`).join("\n");
  return `${head}\n${sep}${body ? `\n${body}` : ""}\n`;
}

function listToMd(el, depth) {
  const ordered = el.tagName.toLowerCase() === "ol";
  const pad = INDENT.repeat(depth);
  const lines = [];
  let n = 1;
  for (const li of el.children) {
    if (li.tagName?.toLowerCase() !== "li") continue;
    const marker = ordered ? `${n++}.` : "-";
    // texto directo del <li> (sin sus sublistas)
    const clone = li.cloneNode(true);
    clone.querySelectorAll(":scope > ul, :scope > ol").forEach((s) => s.remove());
    lines.push(`${pad}${marker} ${inline(clone).trim()}`);
    for (const sub of li.querySelectorAll(":scope > ul, :scope > ol")) {
      lines.push(listToMd(sub, depth + 1));
    }
  }
  return lines.join("\n");
}

/** Recorre los bloques de nivel superior del contenido de una página. */
function blocksToMd(root, headingBase) {
  const parts = [];
  for (const el of root.childNodes) {
    if (el.nodeType === Node.TEXT_NODE) {
      const t = el.textContent.trim();
      if (t) parts.push(t);
      continue;
    }
    if (el.nodeType !== Node.ELEMENT_NODE) continue;
    const tag = el.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) {
      const lvl = Math.min(6, headingBase + Number(tag[1]) - 1);
      parts.push(`${"#".repeat(lvl)} ${inline(el).trim()}`);
    } else if (tag === "p") {
      const t = inline(el).trim();
      if (t) parts.push(t);
    } else if (tag === "ul" || tag === "ol") {
      parts.push(listToMd(el, 0));
    } else if (tag === "table") {
      parts.push(tableToMd(el));
    } else if (tag === "hr") {
      parts.push("---");
    } else if (tag === "blockquote") {
      parts.push(blocksToMd(el, headingBase).split("\n").map((l) => `> ${l}`.trimEnd()).join("\n"));
    } else if (tag === "figure") {
      parts.push(blocksToMd(el, headingBase));
    } else if (tag === "figcaption") {
      const t = inline(el).trim();
      if (t) parts.push(`*${t}*`);
    } else if (tag === "img") {
      parts.push(`![${el.getAttribute("alt") || ""}](${el.getAttribute("src") || ""})`);
    } else if (el.classList.contains("ggse-secret")) {
      // Aparte de GM → callout de Obsidian.
      const inner = blocksToMd(el, headingBase).split("\n").map((l) => `> ${l}`.trimEnd()).join("\n");
      parts.push(`> [!warning]- ${loc("GGSE.Journal.GMOnly")}\n${inner}`);
    } else if (tag === "section" || tag === "div") {
      parts.push(blocksToMd(el, headingBase));
    } else {
      const t = inline(el).trim();
      if (t) parts.push(t);
    }
  }
  return parts.filter(Boolean).join("\n\n");
}

function pageToMd(page, single, journalName) {
  const showTitle = page.showTitle && !(single && page.title === journalName);
  const L = [];
  if (showTitle) L.push(`## ${page.title}`);

  if (page.type === "text") {
    const div = document.createElement("div");
    div.innerHTML = page.html || "";
    // Las cabeceras internas se anidan un nivel bajo el título de capítulo (##).
    L.push(blocksToMd(div, showTitle ? 3 : 2));
  } else if (page.type === "image") {
    if (page.src) L.push(`![${page.caption || page.title}](${page.src})`);
    if (page.caption) L.push(`*${page.caption}*`);
  } else {
    L.push(`*${game.i18n.format("GGSE.Journal.NotExportable", { type: page.pageType })}*`);
  }
  return L.filter(Boolean).join("\n\n");
}

export function journalToMarkdown(d) {
  const single = d.pages.length === 1;
  const L = [];
  L.push(`# ${d.name}`);
  L.push(`> Crónicas Bárdicas · ${d.exportDate}`, "");

  for (const page of d.pages) {
    L.push(pageToMd(page, single, d.name), "");
  }

  L.push("---");
  L.push(`*${loc("GGSE.ExportedWith")} [GG Sheet Export](https://github.com/GegesVTT/gg-sheet-export) · ${loc("GGSE.FooterThanks")} · ${d.exportDate}*`);

  return L.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
