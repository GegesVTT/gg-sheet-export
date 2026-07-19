/**
 * GG Sheet Export — spellcards-print.mjs
 * Tarjetas de conjuros imprimibles, tamaño póker (63×88 mm), 9 por hoja A4, a
 * doble faz: una hoja de frentes (datos) y otra de dorsos (texto) con las
 * columnas espejadas para que cada dorso caiga detrás de su frente al imprimir
 * doble cara (encuadernado por el lado largo).
 *
 * Hechizos largos (Wish y compañía): el dorso se auto-ajusta y, si aun al mínimo
 * legible no entra, se resume y se muestra la referencia al manual — siempre en
 * una sola tarjeta, como las oficiales.
 *
 * Themes: la estética sale de un tema (colores + fuentes). Hoy va uno solo
 * ("cronicas"); sumar packs de Patreon después es agregar entradas a THEMES.
 */

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const loc = (k) => game.i18n.localize(k);

/* ---------- temas ---------- */
export const THEMES = {
  cronicas: {
    id: "cronicas",
    name: "Crónicas Bárdicas",
    vars: {
      "--card-ink": "#241a12", "--card-amber": "#a06914", "--card-amber-b": "#e0a23c",
      "--card-wine": "#8a2f3f", "--card-rule": "#c9b99a", "--card-dim": "#6f6151",
      "--card-paper": "#fbf7ee", "--card-back": "#f6efe0",
      "--card-title": '"Cinzel", Georgia, serif',
      "--card-body": 'system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    }
  }
};

export function themeStyle(themeId = "cronicas") {
  const t = THEMES[themeId] ?? THEMES.cronicas;
  const vars = Object.entries(t.vars).map(([k, v]) => `${k}:${v};`).join("");
  return `.ggse-cards{${vars}}`;
}

/* ---------- CSS de tarjeta (compartido pantalla + impresión) ---------- */
export const CARDS_CSS = `
.ggse-cards { color:var(--card-ink); }
.ggse-cards * { box-sizing:border-box; }

.ggse-sheet { display:grid; grid-template-columns:repeat(3, 63mm); grid-template-rows:repeat(3, 88mm);
  justify-content:center; align-content:center; }
.ggse-sheet-label { display:none; }

.ggse-card { width:63mm; height:88mm; overflow:hidden; position:relative;
  border:0.12mm solid rgba(0,0,0,0.28); padding:3mm 3.2mm; display:flex; flex-direction:column;
  background:#fff; font-family:var(--card-body); }
.ggse-card.ggse-blank { border-color:rgba(0,0,0,0.10); background:transparent; }

/* ---- frente ---- */
.ggse-front { border-top:3mm solid var(--school, var(--card-amber)); padding-top:2.4mm; }
.ggse-front .c-name { font-family:var(--card-title); font-weight:700; font-size:10.5pt;
  line-height:1.02; color:var(--card-ink); }
.ggse-front .c-sub { font-size:6.6pt; letter-spacing:0.05em; text-transform:uppercase;
  color:var(--school, var(--card-wine)); margin-top:0.6mm; font-weight:600; }
.ggse-front .c-rule { height:0.2mm; background:var(--card-rule); margin:1.6mm 0 1.4mm; }

.ggse-front .c-stats { font-size:7.4pt; line-height:1.28; }
.ggse-front .c-row { display:flex; gap:1.6mm; }
.ggse-front .c-k { flex:0 0 15mm; font-size:6.1pt; letter-spacing:0.04em; text-transform:uppercase;
  color:var(--card-dim); padding-top:0.4pt; }
.ggse-front .c-v { flex:1; font-weight:600; }

.ggse-front .c-combat { margin-top:auto; display:flex; flex-wrap:wrap; gap:1mm; padding-top:1.6mm; }
.ggse-front .cbadge { font-size:6.6pt; font-weight:700; padding:0.5mm 1.4mm; border-radius:1mm;
  border:0.15mm solid var(--card-rule); color:var(--card-ink); background:var(--card-paper); }
.ggse-front .cbadge.atk { border-color:var(--school, var(--card-amber)); }
.ggse-front .cbadge.save { border-color:var(--card-wine); color:var(--card-wine); }

.ggse-front .c-tags { display:flex; gap:1mm; margin-top:1.2mm; }
.ggse-front .tag { font-size:5.9pt; letter-spacing:0.05em; text-transform:uppercase; font-weight:700;
  padding:0.4mm 1.2mm; border-radius:0.8mm; color:#fff; }
.ggse-front .tag.conc { background:var(--card-wine); }
.ggse-front .tag.rit { background:var(--card-amber); }

/* ---- dorso ---- */
.ggse-back { background:var(--card-back); }
.ggse-back .b-head { display:flex; justify-content:space-between; align-items:baseline; gap:1.4mm;
  border-bottom:0.2mm solid var(--card-rule); padding-bottom:1mm; margin-bottom:1.4mm; }
.ggse-back .b-name { font-family:var(--card-title); font-weight:700; font-size:8pt; line-height:1.03;
  color:var(--card-ink); }
.ggse-back .b-sub { font-size:5.8pt; text-transform:uppercase; letter-spacing:0.04em;
  color:var(--card-dim); white-space:nowrap; }
.ggse-back .b-material { font-size:6pt; font-style:italic; color:var(--card-dim); margin-bottom:1mm;
  line-height:1.15; }
.ggse-back .b-desc { flex:1; min-height:0; overflow:hidden; font-size:8pt; line-height:1.24;
  text-align:justify; hyphens:auto; }
.ggse-back .b-desc p { margin:0 0 1.2mm; }
.ggse-back .b-desc ul { margin:0 0 1.2mm 3.4mm; padding:0; }
.ggse-back .b-desc li { margin:0 0 0.4mm; }
.ggse-back .b-ref { display:none; font-size:6.4pt; font-weight:700; color:var(--card-wine);
  border-top:0.2mm solid var(--card-rule); padding-top:1mm; margin-top:1mm; }
`;

/* ---------- constructores ---------- */

function frontCard(sp) {
  const stat = (k, v) => `<div class="c-row"><div class="c-k">${esc(k)}</div><div class="c-v">${esc(v)}</div></div>`;
  const combat = [];
  if (sp.toHit) combat.push(`<span class="cbadge atk">${loc("GGSE.Cards.Attack")} ${esc(sp.toHit)}</span>`);
  if (sp.save) combat.push(`<span class="cbadge save">${esc(sp.save)}</span>`);
  if (sp.damage) combat.push(`<span class="cbadge dmg">${esc(sp.damage)}</span>`);

  const tags = [];
  if (sp.concentration) tags.push(`<span class="tag conc">${loc("GGSE.Cards.Conc")}</span>`);
  if (sp.ritual) tags.push(`<span class="tag rit">${loc("GGSE.Cards.Ritual")}</span>`);

  return `<div class="ggse-card ggse-front" style="--school:${sp.schoolColor}">
    <div class="c-name">${esc(sp.name)}</div>
    <div class="c-sub">${esc(sp.levelLabel)} · ${esc(sp.school)}</div>
    <div class="c-rule"></div>
    <div class="c-stats">
      ${stat(loc("GGSE.Cards.Casting"), sp.activation)}
      ${stat(loc("GGSE.Cards.Range"), sp.range)}
      ${stat(loc("GGSE.Cards.Duration"), sp.duration)}
      ${stat(loc("GGSE.Cards.Components"), sp.components)}
    </div>
    ${combat.length ? `<div class="c-combat">${combat.join("")}</div>` : ""}
    ${tags.length ? `<div class="c-tags">${tags.join("")}</div>` : ""}
  </div>`;
}

function backCard(sp) {
  const refText = sp.sourceRef
    ? `▸ ${esc(sp.sourceRef)}`
    : `▸ ${loc("GGSE.Cards.SeeManual")}`;
  return `<div class="ggse-card ggse-back">
    <div class="b-head"><div class="b-name">${esc(sp.name)}</div><div class="b-sub">${esc(sp.levelLabel)}</div></div>
    ${sp.material ? `<div class="b-material">${loc("GGSE.Cards.Material")}: ${esc(sp.material)}</div>` : ""}
    <div class="b-desc">${sp.descHTML || ""}</div>
    <div class="b-ref">${refText}</div>
  </div>`;
}

const blank = () => `<div class="ggse-card ggse-blank"></div>`;

/** Índice espejado por columnas para doble faz (encuadernado lado largo). */
function mirrorIndex(i) {
  const row = Math.floor(i / 3), col = i % 3;
  return row * 3 + (2 - col);
}

/**
 * Cuerpo completo: hojas de frentes y dorsos intercaladas por grupo de 9.
 * @param {object} data  salida de extractSpellCards
 * @param {string} themeId
 * @param {{ mirror?: boolean }} opts  mirror=true para impresión doble faz;
 *   false para la vista previa (orden natural, más fácil de leer).
 */
export function buildCardsBody(data, themeId = "cronicas", { mirror = true } = {}) {
  const chunks = [];
  for (let i = 0; i < data.spells.length; i += 9) chunks.push(data.spells.slice(i, i + 9));
  if (!chunks.length) return `<div class="ggse-cards"><p style="text-align:center">${loc("GGSE.Cards.NoSpells")}</p></div>`;

  const sheets = chunks.map((group, gi) => {
    const fronts = [];
    const backs = new Array(9).fill(null);
    for (let i = 0; i < 9; i++) {
      const sp = group[i];
      fronts.push(sp ? frontCard(sp) : blank());
      const bi = mirror ? mirrorIndex(i) : i;
      backs[bi] = sp ? backCard(sp) : blank();
    }
    const label = chunks.length > 1 ? ` ${gi + 1}/${chunks.length}` : "";
    return `
      <div class="ggse-sheet-label">${loc("GGSE.Cards.Fronts")}${label}</div>
      <section class="ggse-sheet ggse-fronts">${fronts.join("")}</section>
      <div class="ggse-sheet-label">${loc("GGSE.Cards.Backs")}${label}${mirror ? ` · ${loc("GGSE.Cards.Mirrored")}` : ""}</div>
      <section class="ggse-sheet ggse-backs">${backs.map((b) => b ?? blank()).join("")}</section>`;
  }).join("");

  return `<div class="ggse-cards">${sheets}</div>`;
}

/* ---------- auto-ajuste (puro DOM, se reusa en visor e impresión) ---------- */

export function fitSpellCards(root) {
  // Frentes: achica el nombre si desborda su caja.
  root.querySelectorAll(".ggse-front .c-name").forEach((el) => {
    let pt = 10.5;
    while (el.scrollHeight > el.clientHeight + 1 && pt > 7) { pt -= 0.5; el.style.fontSize = pt + "pt"; }
  });
  // Dorsos: achica la descripción hasta un piso legible; si aun así no entra,
  // muestra la referencia y recorta el texto (resumen).
  root.querySelectorAll(".ggse-back").forEach((card) => {
    const desc = card.querySelector(".b-desc");
    const ref = card.querySelector(".b-ref");
    if (!desc) return;
    const fits = () => desc.scrollHeight <= desc.clientHeight + 1;
    let pt = 8;
    desc.style.fontSize = pt + "pt";
    while (!fits() && pt > 6.5) { pt -= 0.25; desc.style.fontSize = pt + "pt"; }
    if (fits()) return;
    if (ref) ref.style.display = "block"; // reserva espacio antes de recortar
    let guard = 0;
    while (!fits() && desc.childNodes.length && guard++ < 4000) {
      const last = desc.childNodes[desc.childNodes.length - 1];
      if (last.nodeType === 3 || !(last.textContent || "").trim()) { desc.removeChild(last); continue; }
      const words = (last.textContent || "").trim().split(/\s+/);
      if (words.length > 4) { words.pop(); last.textContent = words.join(" ") + "…"; }
      else { desc.removeChild(last); }
    }
  });
}

/* ---------- documento de impresión ---------- */

export function buildCardsPrintHTML(data, themeId = "cronicas") {
  const body = buildCardsBody(data, themeId, { mirror: true });
  return `<!DOCTYPE html>
<html lang="${game.i18n.lang || "es"}">
<head>
<meta charset="utf-8">
<title>${esc(data.actorName)} — ${loc("GGSE.Cards.Title")}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&display=swap" rel="stylesheet">
<style>
${themeStyle(themeId)}
${CARDS_CSS}
  @page { size:A4; margin:16mm 10mm; }
  html, body { margin:0; padding:0; }
  .ggse-sheet { break-after:page; }
  .ggse-cards > .ggse-sheet:last-of-type { break-after:auto; }
</style>
</head>
<body>
${body}
<script>
${fitSpellCards.toString()}
window.addEventListener("load", () => {
  const fonts = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
  const timeout = new Promise((r) => setTimeout(r, 2500));
  Promise.race([fonts, timeout]).then(() => {
    try { fitSpellCards(document); } catch (e) {}
    setTimeout(() => { window.focus(); window.print(); }, 80);
  });
});
</script>
</body>
</html>`;
}
