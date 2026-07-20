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

import { LOGO_WATERMARK } from "./spellcards-logo.mjs";

/* ---------- íconos de tipo de daño (SVG embebido, sin dependencias) ----------
   Vectoriales: se ven igual en el visor y en el PDF, y no dependen de Font
   Awesome. El texto de la descripción aclara el tipo en palabras. */
const DAMAGE_COLORS = {
  acid: "#6ea82f", bludgeoning: "#8a929c", cold: "#2fa8d6", fire: "#d9463a",
  force: "#6a5bd6", lightning: "#d99e00", necrotic: "#6f6580", piercing: "#8a929c",
  poison: "#3f8b57", psychic: "#c04f96", radiant: "#d99a2b", slashing: "#8a929c",
  thunder: "#7a52c8"
};

const DAMAGE_ICONS = {
  fire: '<path d="M12 2c1.6 3 4 4.6 4 8a4 4 0 1 1-8 0c0-1.4.7-2.7 1.7-3.6C9.3 8.8 10.7 9.4 11 8c.3-1.5-.2-3.6 1-6z"/>',
  cold: '<g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M12 2v20M3.3 7l17.4 10M20.7 7 3.3 17"/></g>',
  lightning: '<path d="M13 2 5 13h5l-2 9 10-13h-6l3-7z"/>',
  thunder: '<path d="M12 2l1.7 4.9 4-2.6-1.4 4.6 4.7.6-3.8 2.9 3.8 2.9-4.7.6 1.4 4.6-4-2.6L12 22l-1.7-4.9-4 2.6 1.4-4.6L3 14.9l3.8-2.9L3 9.1l4.7-.6L6.3 3.9l4 2.6z"/>',
  acid: '<path d="M12 2s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"/>',
  poison: '<path d="M10 2h4v5.2l4 9.1A2 2 0 0 1 16.2 19H7.8A2 2 0 0 1 6 16.3L10 7.2z"/><circle cx="12" cy="14" r="1.5" fill="#fff"/>',
  necrotic: '<path d="M12 3a7 7 0 0 0-7 7c0 2.3 1.1 3.5 2 5v2h2v-2h2v2h2v-2c.9-1.5 2-2.7 2-5a7 7 0 0 0-7-7z"/><circle cx="9.4" cy="10.4" r="1.4" fill="#fff"/><circle cx="14.6" cy="10.4" r="1.4" fill="#fff"/>',
  radiant: '<circle cx="12" cy="12" r="4"/><g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></g>',
  psychic: '<path fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" d="M12 12a1.4 1.4 0 1 1-1.1-1.4 3.4 3.4 0 1 1 2.9 3.7 5.5 5.5 0 1 1-5.3-6.5"/>',
  force: '<path d="M12 2l2 8 8 2-8 2-2 8-2-8-8-2 8-2z"/>',
  bludgeoning: '<rect x="6" y="4" width="10" height="5" rx="1"/><rect x="9.5" y="9" width="3" height="11" rx="1"/>',
  piercing: '<path d="M12 2l5 8h-3.2v10h-3.6V10H7z"/>',
  slashing: '<path d="M5 19 17 5l2.2 2.2L7.2 21.2z"/>'
};

export function damageIcon(type) {
  const inner = DAMAGE_ICONS[type];
  if (!inner) return "";
  const color = DAMAGE_COLORS[type] || "var(--card-ink)";
  return `<svg class="dmg-ico" viewBox="0 0 24 24" fill="currentColor" style="color:${color}">${inner}</svg>`;
}
export const THEMES = {
  cronicas: {
    id: "cronicas",
    name: "Crónicas Bárdicas",
    watermark: LOGO_WATERMARK,
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

/* Marca de agua: logo grande, desfasado del centro (abajo-derecha, sangrando
   del borde) y casi imperceptible. Es un <img> real —no background— para que
   la impresión nativa siempre lo incluya. El contenido apila por encima. */
.ggse-card .c-wm { position:absolute; right:-9mm; bottom:-11mm; height:64mm; width:auto;
  opacity:0.05; pointer-events:none; user-select:none; z-index:0; }
.ggse-card.ggse-blank .c-wm { display:none; }
.ggse-card > *:not(.c-wm) { position:relative; z-index:1; }

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

.ggse-front .c-combat { margin-top:1.6mm; display:flex; flex-wrap:wrap; gap:1mm; align-items:center; }
.ggse-front .cbadge { display:inline-flex; align-items:center; gap:0.6mm; font-size:6.6pt; font-weight:700;
  padding:0.5mm 1.4mm; border-radius:1mm; border:0.15mm solid var(--card-rule);
  color:var(--card-ink); background:var(--card-paper); }
.ggse-front .cbadge.atk { border-color:var(--school, var(--card-amber)); }
.ggse-front .cbadge.save { border-color:var(--card-wine); color:var(--card-wine); }
.ggse-front .dmg-ico { width:8pt; height:8pt; display:inline-block; flex:0 0 auto; }

.ggse-front .c-scaling { display:flex; flex-wrap:wrap; gap:0 2.4mm; margin-top:1.2mm;
  font-size:6.3pt; color:var(--card-dim); }
.ggse-front .c-scaling b { color:var(--card-ink); font-weight:700; }

.ggse-front .c-tags { display:flex; gap:1mm; margin-top:1.2mm; }
.ggse-front .tag { font-size:5.9pt; letter-spacing:0.05em; text-transform:uppercase; font-weight:700;
  padding:0.4mm 1.2mm; border-radius:0.8mm; color:#fff; }
.ggse-front .tag.conc { background:var(--card-wine); }
.ggse-front .tag.rit { background:var(--card-amber); }

/* Descripción que arranca en el frente (solo hechizos largos; la llena el JS). */
.ggse-front .c-desc { flex:1 1 auto; min-height:0; overflow:hidden; margin-top:1.8mm;
  font-size:8pt; line-height:1.24; text-align:justify; hyphens:auto; color:var(--card-ink);
  border-top:0.2mm solid transparent; }
.ggse-front .c-desc:not(:empty) { border-top-color:var(--card-rule); padding-top:1.4mm; }
.ggse-front .c-desc p { margin:0 0 1.2mm; }
.ggse-front .c-desc ul { margin:0 0 1.2mm 3.4mm; padding:0; }

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

function watermark(themeId) {
  const src = (THEMES[themeId] ?? THEMES.cronicas).watermark;
  return src ? `<img class="c-wm" src="${src}" alt="">` : "";
}

function frontCard(sp, id, themeId) {
  const stat = (k, v) => `<div class="c-row"><div class="c-k">${esc(k)}</div><div class="c-v">${esc(v)}</div></div>`;
  const combat = [];
  if (sp.toHit) combat.push(`<span class="cbadge atk">${loc("GGSE.Cards.Attack")} ${esc(sp.toHit)}</span>`);
  if (sp.save) combat.push(`<span class="cbadge save">${esc(sp.save)}</span>`);
  for (const d of sp.damageParts || []) {
    combat.push(`<span class="cbadge dmg">${esc(d.formula)}${damageIcon(d.type)}</span>`);
  }

  const tags = [];
  if (sp.concentration) tags.push(`<span class="tag conc">${loc("GGSE.Cards.Conc")}</span>`);
  if (sp.ritual) tags.push(`<span class="tag rit">${loc("GGSE.Cards.Ritual")}</span>`);

  // Escalado: trucos por nivel de pj (N5/N11/N17); con nivel, incremento/espacio.
  let scaling = "";
  const N = loc("GGSE.Cards.LvlAbbr");
  if (sp.scaling?.cantrip) {
    scaling = `<div class="c-scaling">${["5", "11", "17"].map((lv, i) =>
      `<span><b>${N}${lv}</b> ${esc(sp.scaling.cantrip[i])}</span>`).join("")}</div>`;
  } else if (sp.scaling?.upcast) {
    scaling = `<div class="c-scaling"><span>${loc("GGSE.Cards.PerSlot")} +${esc(sp.scaling.upcast)}</span></div>`;
  }

  return `<div class="ggse-card ggse-front" style="--school:${sp.schoolColor}">
    ${watermark(themeId)}
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
    ${scaling}
    ${tags.length ? `<div class="c-tags">${tags.join("")}</div>` : ""}
    <div class="c-desc" data-spell="${id}"></div>
  </div>`;
}

function backCard(sp, id, themeId) {
  const refText = sp.sourceRef
    ? `▸ ${esc(sp.sourceRef)}`
    : `▸ ${loc("GGSE.Cards.SeeManual")}`;
  return `<div class="ggse-card ggse-back">
    ${watermark(themeId)}
    <div class="b-head"><div class="b-name">${esc(sp.name)}</div><div class="b-sub">${esc(sp.levelLabel)}</div></div>
    ${sp.material ? `<div class="b-material">${loc("GGSE.Cards.Material")}: ${esc(sp.material)}</div>` : ""}
    <div class="b-desc" data-spell="${id}">${sp.descHTML || ""}</div>
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
      const gid = gi * 9 + i;
      fronts.push(sp ? frontCard(sp, gid, themeId) : blank());
      const bi = mirror ? mirrorIndex(i) : i;
      backs[bi] = sp ? backCard(sp, gid, themeId) : blank();
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

  // Descripciones: cada dorso se empareja con el frente por data-spell.
  root.querySelectorAll(".ggse-back .b-desc").forEach((back) => {
    const id = back.getAttribute("data-spell");
    const card = back.closest(".ggse-card");
    const ref = card ? card.querySelector(".b-ref") : null;
    const front = id != null ? root.querySelector(`.ggse-front .c-desc[data-spell="${id}"]`) : null;

    const fitsBack = () => back.scrollHeight <= back.clientHeight + 1;

    // 1) ¿Entra todo en el dorso a tamaño base? → corto/medio, frente limpio.
    back.style.fontSize = "8pt";
    if (fitsBack()) return;

    // 2) LARGO: la descripción arranca en el frente y sigue en el dorso.
    if (front) {
      front.style.fontSize = "8pt";
      const fitsFront = () => front.scrollHeight <= front.clientHeight + 1;
      let guard = 0;
      while (fitsFront() && back.firstChild && guard++ < 4000) {
        front.appendChild(back.firstChild);
      }
      // El último nodo hizo desbordar el frente: devolvelo al inicio del dorso.
      if (!fitsFront() && front.lastChild) back.insertBefore(front.lastChild, back.firstChild);
    }

    // 3) El resto va al dorso: achicar y, si no entra, resumir + referencia.
    let pt = 8;
    back.style.fontSize = pt + "pt";
    while (!fitsBack() && pt > 6.5) { pt -= 0.25; back.style.fontSize = pt + "pt"; }
    if (fitsBack()) return;
    if (ref) ref.style.display = "block";
    let g = 0;
    while (!fitsBack() && back.childNodes.length && g++ < 4000) {
      const last = back.childNodes[back.childNodes.length - 1];
      if (last.nodeType === 3 || !(last.textContent || "").trim()) { back.removeChild(last); continue; }
      const words = (last.textContent || "").trim().split(/\s+/);
      if (words.length > 4) { words.pop(); last.textContent = words.join(" ") + "…"; }
      else { back.removeChild(last); }
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
