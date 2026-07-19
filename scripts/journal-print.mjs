/**
 * GG Sheet Export — journal-print.mjs
 * Presentación de journals con identidad visual propia: un "tomo" / manuscrito,
 * distinto de la ficha de personaje. Comparte la paleta y las fuentes de la
 * marca (Cinzel + Cormorant Garamond, ámbar/vino/tinta) pero con un layout de
 * libro: portada, índice, capítulos con capitular y cortes de página limpios.
 *
 * Reutilizable en tres salidas: buildJournalBody (visor en pantalla y PDF),
 * buildJournalPrintHTML (PDF por impresión nativa) y buildJournalStandaloneHTML
 * (.html autónomo con imágenes incrustadas en base64).
 */

const loc = (k) => game.i18n.localize(k);
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** CSS del tomo, compartido entre PDF y HTML autónomo. */
export const JOURNAL_CSS = `
  :root { --ink:#241a12; --amber:#a06914; --amber-b:#e0a23c; --wine:#8a2f3f;
    --rule:#c9b99a; --dim:#6f6151; --paper:#fbf7ee; }
  * { box-sizing:border-box; }
  html, body { margin:0; padding:0; }
  body { background:#fff; color:var(--ink);
    font-family:"Cormorant Garamond", Georgia, serif; font-size:13pt; line-height:1.5; }

  .ggse-jrnl { max-width:19cm; margin:0 auto; padding:1cm 0.4cm 1.6cm; }

  /* ---- portada ---- */
  .ggse-cover { text-align:center; padding:14pt 0 10pt; margin-bottom:6pt;
    border-bottom:2.5pt solid var(--amber-b); }
  .ggse-cover .kicker { font-family:"Cinzel", Georgia, serif; font-size:9pt;
    letter-spacing:0.28em; text-transform:uppercase; color:var(--amber); }
  .ggse-cover h1 { font-family:"Cinzel", Georgia, serif; font-size:30pt; font-weight:700;
    letter-spacing:0.02em; margin:6pt 0 4pt; line-height:1.1; }
  .ggse-cover .meta { font-size:11pt; font-style:italic; color:var(--dim); }
  .ggse-orn { color:var(--amber); font-size:13pt; margin:6pt 0; letter-spacing:0.3em; }

  /* ---- índice ---- */
  .ggse-toc { margin:12pt auto 4pt; max-width:15cm; }
  .ggse-toc h2 { font-family:"Cinzel", Georgia, serif; font-size:11pt; letter-spacing:0.16em;
    text-transform:uppercase; color:var(--wine); text-align:center; border:0; margin:0 0 6pt; }
  .ggse-toc ol { list-style:none; margin:0; padding:0; }
  .ggse-toc li { padding:2pt 0; border-bottom:0.5pt dotted var(--rule); font-size:12pt; }
  .ggse-toc li.lvl-2 { padding-left:16pt; font-size:11pt; color:var(--dim); }
  .ggse-toc li.lvl-3 { padding-left:32pt; font-size:10.5pt; color:var(--dim); }

  /* ---- capítulos ---- */
  .ggse-chapter { break-inside:auto; }
  .ggse-chapter + .ggse-chapter { break-before:page; }
  .ggse-chapter-title { font-family:"Cinzel", Georgia, serif; font-size:18pt; font-weight:700;
    color:var(--wine); text-align:center; letter-spacing:0.02em; margin:14pt 0 3pt;
    break-after:avoid; }
  .ggse-chapter-title::after { content:""; display:block; width:64pt; height:1.5pt;
    background:var(--amber-b); margin:6pt auto 12pt; }

  .ggse-body { text-align:justify; hyphens:auto; }
  .ggse-body > p:first-of-type::first-letter {
    font-family:"Cinzel", Georgia, serif; float:left; font-size:44pt; line-height:0.82;
    padding:2pt 6pt 0 0; color:var(--amber); font-weight:700; }
  .ggse-body p { margin:0 0 6pt; }
  .ggse-body p + p { text-indent:1.1em; }
  .ggse-body h1, .ggse-body h2, .ggse-body h3, .ggse-body h4 {
    font-family:"Cinzel", Georgia, serif; break-after:avoid; }
  .ggse-body h1, .ggse-body h2 { font-size:12pt; font-weight:700; letter-spacing:0.1em;
    text-transform:uppercase; color:var(--wine); border-bottom:1pt solid var(--rule);
    padding-bottom:2pt; margin:12pt 0 5pt; }
  .ggse-body h3 { font-size:11pt; color:var(--amber); margin:9pt 0 3pt; letter-spacing:0.04em; }
  .ggse-body h4 { font-size:9.5pt; letter-spacing:0.08em; text-transform:uppercase;
    color:var(--dim); margin:8pt 0 2pt; }
  .ggse-body ul, .ggse-body ol { margin:4pt 0 8pt 20pt; padding:0; }
  .ggse-body li { margin:2pt 0; break-inside:avoid; }
  .ggse-body strong, .ggse-body b { color:var(--ink); }
  .ggse-body em, .ggse-body i { color:var(--ink); }

  .ggse-body blockquote { border-left:2.5pt solid var(--amber-b); margin:8pt 0; padding:2pt 0 2pt 12pt;
    font-style:italic; color:var(--dim); break-inside:avoid; }
  .ggse-body hr { width:38%; margin:14pt auto; border:0; border-top:1pt solid var(--rule); }

  .ggse-body table { width:100%; border-collapse:collapse; font-size:11.5pt; margin:8pt 0;
    break-inside:avoid; }
  .ggse-body thead th, .ggse-body thead td { font-family:"Cinzel", Georgia, serif; font-size:8.5pt;
    letter-spacing:0.06em; text-transform:uppercase; color:var(--dim); text-align:left;
    border-bottom:1.5pt solid var(--rule); padding:3pt 5pt; }
  .ggse-body tbody td, .ggse-body tbody th { padding:3pt 5pt; border-bottom:0.5pt solid #eee4d2;
    vertical-align:top; }
  .ggse-body tbody tr:nth-child(even) { background:#faf6ee; }

  .ggse-body img { max-width:100%; height:auto; display:block; margin:8pt auto; }
  .ggse-link { border-bottom:0.5pt dotted var(--amber); color:inherit; }

  /* aparte de GM (bloques secretos, solo si se piden) */
  .ggse-secret { border:1pt dashed var(--wine); background:rgba(138,47,63,0.05);
    border-radius:4pt; padding:6pt 10pt 4pt; margin:10pt 0; break-inside:avoid; }
  .ggse-secret::before { content:attr(data-ggse-label); display:block;
    font-family:"Cinzel", Georgia, serif; font-size:7.5pt; letter-spacing:0.14em;
    text-transform:uppercase; color:var(--wine); margin-bottom:3pt; }

  /* imagen como página completa */
  .ggse-figure { text-align:center; margin:12pt 0; break-inside:avoid; }
  .ggse-figure img { max-width:100%; height:auto; border:1pt solid var(--rule); border-radius:3pt; }
  .ggse-figure figcaption { font-style:italic; color:var(--dim); font-size:10.5pt; margin-top:5pt; }
  .ggse-muted { color:var(--dim); font-style:italic; }

  .ggse-jrnl-footer { position:fixed; bottom:0; left:0; right:0; text-align:center;
    font-size:8.5pt; color:var(--dim); font-style:italic;
    border-top:0.5pt solid var(--rule); padding-top:3pt; background:#fff; }
`;

/** Heading HTML del título de un capítulo. */
function chapterTitle(page) {
  return `<h2 class="ggse-chapter-title">${esc(page.title)}</h2>`;
}

/** Cuerpo de una página según su tipo. */
function pageBody(page) {
  if (page.type === "text") return `<div class="ggse-body">${page.html || ""}</div>`;
  if (page.type === "image") {
    return `<figure class="ggse-figure">
      ${page.src ? `<img src="${esc(page.src)}" alt="${esc(page.caption || page.title)}">` : ""}
      ${page.caption ? `<figcaption>${esc(page.caption)}</figcaption>` : ""}
    </figure>`;
  }
  return `<p class="ggse-muted">${game.i18n.format("GGSE.Journal.NotExportable", { type: page.pageType })}</p>`;
}

/**
 * Cuerpo completo del tomo: portada + índice + capítulos.
 * Se usa igual en el visor y en el PDF (las imágenes quedan con su ruta de
 * Foundry; el .html autónomo las incrusta aparte).
 */
export function buildJournalBody(d) {
  const single = d.pages.length === 1;

  // El título de capítulo se muestra salvo que la página lo oculte, o que sea
  // la única página y su título repita el del tomo (evita el eco en la portada).
  const showsChapterTitle = (p) => p.showTitle && !(single && p.title === d.name);

  const tocItems = d.pages.filter((p) => showsChapterTitle(p));
  const toc = tocItems.length > 1
    ? `<nav class="ggse-toc">
        <h2>${loc("GGSE.Journal.Index")}</h2>
        <ol>${tocItems.map((p) => `<li class="lvl-${Math.min(p.level, 3)}">${esc(p.title)}</li>`).join("")}</ol>
      </nav>`
    : "";

  const chapters = d.pages.map((p) => `
    <section class="ggse-chapter">
      ${showsChapterTitle(p) ? chapterTitle(p) : ""}
      ${pageBody(p)}
    </section>`).join("");

  return `
  <div class="ggse-cover">
    <div class="kicker">Crónicas Bárdicas</div>
    <h1>${esc(d.name)}</h1>
    <div class="ggse-orn">❧</div>
    <div class="meta">${esc(d.exportDate)}</div>
  </div>
  ${toc}
  ${chapters}`;
}

/** PDF por impresión nativa (mismo mecanismo que la ficha). */
export function buildJournalPrintHTML(d) {
  return `<!DOCTYPE html>
<html lang="${game.i18n.lang || "es"}">
<head>
<meta charset="utf-8">
<title>${esc(d.name)} — GG Sheet Export</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
<style>
${JOURNAL_CSS}
  @page { size:A4; margin:1.5cm 1.5cm 1.7cm; }
  @media print { .ggse-jrnl { padding:0 0 1cm; max-width:none; } }
</style>
</head>
<body>
<div class="ggse-jrnl-footer">${esc(d.name)} · ${loc("GGSE.ExportedWith")} GG Sheet Export · GegesVTT · ${esc(d.exportDate)}</div>
<div class="ggse-jrnl">
${buildJournalBody(d)}
</div>
<script>
  // Espera fuentes web e imágenes (tope 2.5s) antes de imprimir, para que el
  // PDF salga con la tipografía correcta y las ilustraciones cargadas.
  window.addEventListener("load", () => {
    const imgs = Array.from(document.images)
      .filter((i) => !i.complete)
      .map((i) => new Promise((res) => { i.onload = i.onerror = res; }));
    const fonts = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
    const timeout = new Promise((res) => setTimeout(res, 2500));
    Promise.race([Promise.all([fonts, ...imgs]), timeout]).then(() => {
      setTimeout(() => { window.focus(); window.print(); }, 60);
    });
  });
</script>
</body>
</html>`;
}

/* ---------- exportación HTML autónoma ----------
   Igual que en la ficha: un .html que te descargás no puede apuntar a
   worlds/... del servidor de Foundry, así que incrustamos cada imagen en
   base64 recorriendo el DOM ya armado. */

async function aDataURL(url) {
  if (!url || url.startsWith("data:")) return url ?? "";
  try {
    const res = await fetch(url);
    if (!res.ok) return "";
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(new Error("read"));
      fr.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn(`gg-sheet-export | no se pudo incrustar ${url}`, e);
    return "";
  }
}

export async function buildJournalStandaloneHTML(d) {
  // Armamos el cuerpo, incrustamos todas las imágenes y re-serializamos.
  const holder = document.createElement("div");
  holder.innerHTML = buildJournalBody(d);
  await Promise.all(Array.from(holder.querySelectorAll("img")).map(async (img) => {
    const data = await aDataURL(img.getAttribute("src"));
    if (data) img.setAttribute("src", data);
    else img.remove();
  }));
  const body = holder.innerHTML;

  return `<!DOCTYPE html>
<html lang="${esc(game.i18n.lang || "es")}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(d.name)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
<style>
${JOURNAL_CSS}

/* ---- pantalla: pergamino ---- */
body { background:#e9e1d1; margin:0; padding:18px; }
.ggse-jrnl { max-width:820px; margin:0 auto; background:var(--paper);
  padding:34px 44px 40px; box-shadow:0 3px 22px rgba(0,0,0,0.22); border-radius:4px; }
.ggse-chapter + .ggse-chapter { border-top:1pt solid var(--rule); margin-top:18px; padding-top:6px; }

/* ---- impresión del propio archivo: vuelve al corte por página ---- */
@media print {
  body { background:#fff; padding:0; }
  .ggse-jrnl { box-shadow:none; max-width:none; padding:0; background:#fff; border-radius:0; }
  .ggse-chapter + .ggse-chapter { border-top:0; margin-top:0; padding-top:0; break-before:page; }
  @page { size:A4; margin:14mm 14mm 16mm; }
}
</style>
</head>
<body>
<div class="ggse-jrnl">
${body}
  <p class="ggse-muted" style="text-align:center; border-top:0.5pt solid var(--rule); margin-top:16pt; padding-top:6pt; font-size:9.5pt;">
    ${esc(d.name)} · ${loc("GGSE.ExportedWith")}
    <a class="ggse-link" href="https://github.com/GegesVTT/gg-sheet-export" target="_blank" rel="noopener">GG Sheet Export</a>
    · ${loc("GGSE.FooterThanks")} · ${esc(d.exportDate)}
  </p>
</div>
</body>
</html>`;
}
