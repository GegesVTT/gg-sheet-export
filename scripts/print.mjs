/**
 * GG Sheet Export — print.mjs
 * Construye un documento HTML autocontenido con estilo de imprenta (pergamino claro,
 * tipografía serif, cortes de página limpios) y dispara el diálogo de impresión
 * del navegador: "Guardar como PDF" produce un PDF vectorial de alta calidad.
 */

const loc = (k) => game.i18n.localize(k);
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function abilityCards(d) {
  return d.abilities.map((a) => `
    <div class="ab">
      <div class="ab-abbr">${esc(a.abbr)}</div>
      <div class="ab-mod">${esc(a.mod)}</div>
      <div class="ab-score">${esc(a.value)}</div>
      <div class="ab-save">${loc("GGSE.Save")} ${esc(a.save)} ${a.saveProf === "●" ? "●" : ""}</div>
    </div>`).join("");
}

function skillRows(d) {
  return d.skills.map((s) => `
    <tr><td class="prof">${s.prof}</td><td>${esc(s.label)}</td>
    <td class="dim">${esc(s.ability)}</td><td class="num">${esc(s.total)}</td></tr>`).join("");
}

function attackRows(d) {
  return d.attacks.map((a) => `
    <tr><td class="prof">${a.equipped}</td><td><strong>${esc(a.name)}</strong>
    ${a.props ? `<span class="dim"> · ${esc(a.props)}</span>` : ""}</td>
    <td class="num">${esc(a.toHit)}</td><td>${esc(a.damage)}</td></tr>`).join("");
}

function spellBlocks(d) {
  return d.spellLevels.map((lvl) => `
    <div class="spell-level">
      <h3>${esc(lvl.label)}${lvl.slots ? ` <span class="slots">${loc("GGSE.Slots")} ${esc(lvl.slots)}</span>` : ""}</h3>
      <ul class="spell-list">
        ${lvl.spells.map((s) => `<li>${s.prepared} <strong>${esc(s.name)}</strong>
          <span class="dim">${esc(s.school)}${s.conc ? " · C" : ""}${s.ritual ? " · R" : ""}${s.mode ? ` · ${esc(s.mode)}` : ""}</span></li>`).join("")}
      </ul>
    </div>`).join("");
}

function featureItems(d) {
  return d.features.map((f) => `
    <li><strong>${esc(f.name)}</strong>${f.subtitle ? ` <span class="dim">· ${esc(f.subtitle)}</span>` : ""}${f.uses ? ` <span class="uses">${esc(f.uses)}</span>` : ""}</li>`).join("");
}

function inventoryRows(d) {
  return d.inventory.map((i) => `
    <tr><td class="prof">${i.equipped}</td><td>${esc(i.name)}</td>
    <td class="num">${esc(i.qty)}</td><td class="num">${esc(i.weight)}</td></tr>`).join("");
}

export function buildPrintHTML(d) {
  const subtitle = d.isNPC
    ? [d.creatureType, d.cr !== "" ? `CR ${d.cr}` : "", d.alignment].filter(Boolean).join(" · ")
    : [d.race, d.classes, `${loc("GGSE.Level")} ${d.level}`, d.background, d.alignment].filter(Boolean).join(" · ");

  const traits = [
    [loc("GGSE.Languages"), d.languages],
    [loc("GGSE.Resistances"), d.resist],
    [loc("GGSE.Immunities"), d.immune],
    [loc("GGSE.Vulnerabilities"), d.vuln],
    [loc("GGSE.ConditionImmunities"), d.condImmune]
  ].filter(([, v]) => v);

  return `<!DOCTYPE html>
<html lang="${game.i18n.lang || "es"}">
<head>
<meta charset="utf-8">
<title>${esc(d.name)} — GG Sheet Export</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
<style>
  :root {
    --ink: #241a12;
    --paper: #ffffff;
    --amber: #a06914;
    --wine: #8a2f3f;
    --rule: #c9b99a;
    --dim: #6f6151;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: var(--paper); color: var(--ink);
    font-family: "Cormorant Garamond", Georgia, serif; font-size: 12.5pt; line-height: 1.35; }
  .page { max-width: 19cm; margin: 0 auto; padding: 1cm 0.4cm; }

  h1, h2, h3 { font-family: "Cinzel", Georgia, serif; }
  h1 { font-size: 24pt; font-weight: 700; letter-spacing: 0.02em; }
  .subtitle { font-size: 12pt; font-style: italic; color: var(--wine); margin-top: 2pt; }
  header { border-bottom: 2.5pt solid var(--amber); padding-bottom: 8pt; margin-bottom: 10pt;
    display: flex; gap: 14pt; align-items: flex-end; }
  header img { width: 68pt; height: 68pt; object-fit: cover; border: 1.5pt solid var(--amber); border-radius: 4pt; }

  h2 { font-size: 12pt; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--wine); border-bottom: 1pt solid var(--rule); padding-bottom: 2pt; margin: 12pt 0 6pt; }
  h3 { font-size: 11pt; margin: 6pt 0 3pt; }

  .combat-band { display: flex; flex-wrap: wrap; gap: 4pt 18pt; font-size: 11.5pt;
    background: #faf6ee; border: 1pt solid var(--rule); border-radius: 4pt; padding: 6pt 10pt; }
  .combat-band b { font-family: "Cinzel", Georgia, serif; font-size: 9pt; letter-spacing: 0.06em;
    text-transform: uppercase; color: var(--dim); margin-right: 3pt; }

  .abilities { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6pt; margin: 8pt 0; }
  .ab { text-align: center; border: 1pt solid var(--rule); border-radius: 5pt; padding: 5pt 2pt; }
  .ab-abbr { font-family: "Cinzel", Georgia, serif; font-size: 8.5pt; letter-spacing: 0.1em; color: var(--dim); }
  .ab-mod { font-size: 17pt; font-weight: 600; }
  .ab-score { font-size: 9.5pt; color: var(--dim); }
  .ab-save { font-size: 8.5pt; border-top: 0.5pt solid var(--rule); margin-top: 3pt; padding-top: 2pt; }

  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 0 18pt; }
  table { width: 100%; border-collapse: collapse; font-size: 11pt; }
  td { padding: 1.5pt 3pt; border-bottom: 0.5pt solid #eee4d2; vertical-align: top; }
  td.num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  td.prof { width: 12pt; color: var(--amber); }
  .dim { color: var(--dim); font-size: 10pt; }
  .uses { color: var(--wine); font-size: 10pt; }
  .slots { font-family: "Cormorant Garamond", serif; font-size: 10pt; font-weight: 400;
    color: var(--wine); text-transform: none; letter-spacing: 0; }

  ul.plain, ul.spell-list { list-style: none; }
  ul.plain li, ul.spell-list li { padding: 1.5pt 0; border-bottom: 0.5pt solid #eee4d2; }
  .traits p { margin: 2pt 0; }
  .traits b { color: var(--wine); }

  .bio { margin-top: 6pt; }
  .bio p { margin: 4pt 0; text-align: justify; }
  .bio img { max-width: 100%; }

  footer { margin-top: 14pt; padding-top: 5pt; border-top: 1pt solid var(--rule);
    font-size: 9pt; color: var(--dim); text-align: center; font-style: italic; }

  section { break-inside: avoid; }
  section.allow-break { break-inside: auto; }
  @page { size: A4; margin: 1.4cm; }
  @media print {
    .page { padding: 0; max-width: none; }
  }
</style>
</head>
<body>
<div class="page">
  <header>
    ${d.img ? `<img src="${esc(d.img)}" alt="">` : ""}
    <div>
      <h1>${esc(d.name)}</h1>
      <div class="subtitle">${esc(subtitle)}</div>
    </div>
  </header>

  <section>
    <div class="combat-band">
      <span><b>${loc("GGSE.AC")}</b>${esc(d.ac)}</span>
      <span><b>${loc("GGSE.HP")}</b>${esc(d.hp.value)}/${esc(d.hp.max)}${d.hp.temp ? ` (+${esc(d.hp.temp)})` : ""}</span>
      <span><b>${loc("GGSE.Initiative")}</b>${esc(d.init)}</span>
      <span><b>${loc("GGSE.Proficiency")}</b>${esc(d.prof)}</span>
      ${d.movement ? `<span><b>${loc("GGSE.Speed")}</b>${esc(d.movement)}</span>` : ""}
      ${d.senses ? `<span><b>${loc("GGSE.Senses")}</b>${esc(d.senses)}</span>` : ""}
    </div>
    <div class="abilities">${abilityCards(d)}</div>
  </section>

  <div class="cols">
    <section>
      <h2>${loc("GGSE.Skills")}</h2>
      <table>${skillRows(d)}</table>
    </section>
    <div>
      ${traits.length ? `<section class="traits"><h2>${loc("GGSE.Traits")}</h2>
        ${traits.map(([k, v]) => `<p><b>${esc(k)}:</b> ${esc(v)}</p>`).join("")}</section>` : ""}
      ${d.attacks.length ? `<section><h2>${loc("GGSE.Attacks")}</h2>
        <table>${attackRows(d)}</table></section>` : ""}
      ${d.features.length ? `<section class="allow-break"><h2>${loc("GGSE.Features")}</h2>
        <ul class="plain">${featureItems(d)}</ul></section>` : ""}
    </div>
  </div>

  ${d.hasSpells ? `<section class="allow-break">
    <h2>${loc("GGSE.Spells")}</h2>
    <p class="dim">
      ${d.spellAbility ? `${loc("GGSE.SpellAbility")}: <strong>${esc(d.spellAbility)}</strong> · ` : ""}
      ${d.spellDC ? `${loc("GGSE.SpellDC")}: <strong>${esc(d.spellDC)}</strong> · ` : ""}
      ${d.spellAttack ? `${loc("GGSE.SpellAttack")}: <strong>${esc(d.spellAttack)}</strong>` : ""}
      ${d.pactSlots ? ` · ${loc("GGSE.PactSlots")}: <strong>${esc(d.pactSlots)}</strong>` : ""}
    </p>
    <div class="cols">${spellBlocks(d)}</div>
  </section>` : ""}

  ${d.inventory.length ? `<section class="allow-break">
    <h2>${loc("GGSE.Inventory")}</h2>
    <table>${inventoryRows(d)}</table>
    ${d.currency ? `<p style="margin-top:4pt"><strong>${loc("GGSE.Currency")}:</strong> ${esc(d.currency)}</p>` : ""}
  </section>` : ""}

  ${d.biography ? `<section class="allow-break bio">
    <h2>${loc("GGSE.Biography")}</h2>
    ${d.biography}
  </section>` : ""}

  <footer>${loc("GGSE.ExportedWith")} GG Sheet Export · GegesVTT · ${esc(d.exportDate)}</footer>
</div>
<script>
  window.addEventListener("load", () => setTimeout(() => window.print(), 450));
</script>
</body>
</html>`;
}
