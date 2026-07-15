/**
 * GG Sheet Export — print.mjs (v1.1)
 * Documento de imprenta con layout multicol balanceado, inventario agrupado,
 * elementos jugables (burbujas de espacios, salvaciones de muerte, dados de
 * golpe, PG temporales) y pie de página repetido en cada hoja.
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


/** Cuerpo de Pathfinder 2e. */
function bodyPF2e(d) {
  const subtitle = d.isNPC
    ? [d.rarity, d.size, d.creatureTraits, `${loc("GGSE.Level")} ${d.level}`].filter(Boolean).join(" · ")
    : [d.heritage || d.ancestry, d.classes, `${loc("GGSE.Level")} ${d.level}`, d.background, d.deity]
        .filter(Boolean).join(" · ");

  const traits = [
    [loc("GGSE.Languages"), d.languages],
    [loc("GGSE.Immunities"), d.immune],
    [loc("GGSE.Resistances"), d.resist],
    [loc("GGSE.Vulnerabilities"), d.vuln]
  ].filter(([, v]) => v);

  return `  <header>
    ${d.img ? `<img src="${esc(d.img)}" alt="">` : ""}
    <div>
      <h1>${esc(d.name)}</h1>
      <div class="subtitle">${esc(subtitle)}</div>
    </div>
  </header>

  <section>
    <div class="combat-band">
      <span><b>${loc("GGSE.AC")}</b>${esc(d.ac)}</span>
      <span><b>${loc("GGSE.HP")}</b>${esc(d.hp.value)}/${esc(d.hp.max)}</span>
      <span><b>${loc("GGSE.PF2E.Perception")}</b>${esc(d.perception?.mod)}${d.showRanks ? ` <span class="rank">${esc(d.perception?.rankAbbr)}</span>` : ""}</span>
      <span><b>${loc("GGSE.Initiative")}</b>${esc(d.init)}</span>
      ${d.movement ? `<span><b>${loc("GGSE.Speed")}</b>${esc(d.movement)}</span>` : ""}
      ${d.senses ? `<span><b>${loc("GGSE.Senses")}</b>${esc(d.senses)}</span>` : ""}
      ${d.classDC ? `<span><b>${loc("GGSE.PF2E.ClassDC")}</b>${esc(d.classDC.dc)}</span>` : ""}
    </div>
    ${!d.isNPC ? `<div class="track-band">
      <span><b>${loc("GGSE.PF2E.HeroPoints")}</b><span class="bub">${d.heroPoints?.bubbles ?? ""}</span></span>
      ${d.focus ? `<span><b>${loc("GGSE.PF2E.FocusPoints")}</b><span class="bub">${d.focus.bubbles}</span></span>` : ""}
      <span><b>${loc("GGSE.PF2E.Dying")}</b><span class="bub">${d.dying.bubbles}</span></span>
      <span><b>${loc("GGSE.PF2E.Wounded")}</b><span class="bub">${d.wounded.bubbles}</span></span>
      <span><b>${loc("GGSE.TempHP")}</b><span class="blank">${d.hp.temp ? `&nbsp;${esc(d.hp.temp)}` : ""}</span></span>
      ${d.shield ? `<span><b>${loc("GGSE.PF2E.CatShields")}</b>${esc(d.shield.name)} ${esc(d.shield.ac)} · ${esc(d.shield.hp)}</span>` : ""}
    </div>` : ""}

    <!-- pf2e Remaster no tiene puntuaciones de característica, solo modificadores -->
    <div class="abilities">${d.abilities.map((a) => `
      <div class="ab">
        <div class="ab-abbr">${esc(a.abbr)}</div>
        <div class="ab-mod">${esc(a.mod)}</div>
      </div>`).join("")}</div>

    <!-- las tres salvaciones llevan rango propio: van en fila aparte -->
    <div class="saves3">${d.saves.map((sv) => `
      <div class="save-box">
        <div class="lbl">${esc(sv.label)}</div>
        <div class="val">${esc(sv.mod)}</div>
        ${sv.rankLabel ? `<div class="rk">${esc(sv.rankLabel)}</div>` : ""}
      </div>`).join("")}</div>
    ${d.savesNote ? `<p class="saves-note">${esc(d.savesNote)}</p>` : ""}
  </section>

  <div class="p1-cols">
    <section>
      <h2>${loc("GGSE.Skills")}</h2>
      <table>${d.skills.map((sk) => `
        <tr>${d.showRanks ? `<td class="prof">${esc(sk.rankAbbr)}</td>` : ""}<td>${esc(sk.label)}</td>
        <td class="dim">${esc(sk.ability)}</td><td class="num">${esc(sk.mod)}</td></tr>`).join("")}</table>
      ${d.showRanks ? `<p class="legend">${loc("GGSE.PF2E.LegendRanks")}</p>` : ""}
    </section>
    <div>
      ${traits.length ? `<section class="traits"><h2>${loc("GGSE.Traits")}</h2>
        ${traits.map(([k, v]) => `<p><b>${esc(k)}:</b> ${esc(v)}</p>`).join("")}</section>` : ""}
      ${d.strikes.length ? `<section><h2>${loc("GGSE.PF2E.Strikes")}</h2>
        <ul class="plain">${d.strikes.map((st) => `
        <li><span class="glyph">${st.glyph}</span> <strong>${esc(st.name)}</strong>
          <span class="map">${esc(st.variants)}</span>
          <div class="dim">${esc(st.damage)}${st.traits ? ` · ${esc(st.traits)}` : ""}</div></li>`).join("")}</ul>
        </section>` : ""}
    </div>
  </div>

  ${d.actionGroups?.length ? `<section class="allow-break">
    <h2>${loc("GGSE.PF2E.ActionsSection")}</h2>
    <div class="multicol">${d.actionGroups.map((g) => `
      <div class="block"><h4>${esc(g.label)}</h4>
      <ul class="plain">${g.rows.map((r) => `<li><span class="glyph">${r.glyph}</span> <strong>${esc(r.name)}</strong>${r.uses ? ` <span class="uses">${esc(r.uses)}</span>` : ""}${r.traits ? ` <span class="dim">· ${esc(r.traits)}</span>` : ""}</li>`).join("")}</ul></div>`).join("")}
    </div>
  </section>` : ""}

  ${d.featureGroups?.length ? `<section class="allow-break">
    <h2>${loc("GGSE.Features")}</h2>
    <div class="multicol">${d.featureGroups.map((g) => `
      <div class="block"><h4>${esc(g.label)}</h4>
      <ul class="plain">${g.feats.map((f) => `<li>${f.glyph ? `<span class="glyph">${f.glyph}</span> ` : ""}${esc(f.name)}${f.level ? ` <span class="dim">· ${loc("GGSE.Level")} ${esc(f.level)}</span>` : ""}</li>`).join("")}</ul></div>`).join("")}
    </div>
  </section>` : ""}

  ${d.hasSpells ? `<section class="allow-break">
    <h2>${loc("GGSE.Spells")}</h2>
    <p class="legend">${loc("GGSE.PF2E.LegendSpells")}</p>
    ${d.spellEntries.map((e) => `
    <div class="entry">
      <h3>${esc(e.name)} <span class="dim">· ${esc(e.tradition)} · ${esc(e.mode)}${e.rankLabel ? ` · ${esc(e.rankLabel)}` : ""}</span></h3>
      <p class="entry-meta">${loc("GGSE.PF2E.SpellDC")}: <strong>${esc(e.dc)}</strong>${e.attack ? ` · ${loc("GGSE.PF2E.SpellAttack")}: <strong>${esc(e.attack)}</strong>` : ""}</p>
      <div class="multicol">${e.groups.map((g) => `
        <div class="block"><h4>${esc(g.label)}${g.slots ? ` — ${esc(g.slots)} <span class="bub">${g.bubbles}</span>` : ""}</h4>
        <ul class="plain">${g.spells.map((sp) => `<li>${sp.prepared ? `<span class="bub">${sp.prepared}</span> ` : ""}<span class="${sp.glyphIsText ? "glyph-txt" : "glyph"}">${sp.glyph}</span> <strong>${esc(sp.name)}</strong>${sp.defense || sp.range ? ` <span class="dim">${esc([sp.defense, sp.range].filter(Boolean).join(" · "))}</span>` : ""}</li>`).join("")}</ul></div>`).join("")}
      </div>
    </div>`).join("")}
  </section>` : ""}

  ${d.invGroups?.length ? `<section class="allow-break">
    <h2>${loc("GGSE.Inventory")}</h2>
    ${d.invGroups.map((g) => `
    <div style="break-inside:auto">
      <h4>${esc(g.label)}</h4>
      <table>
        <thead><tr><td></td><td>${loc("GGSE.Item")}</td><td class="num">${loc("GGSE.Qty")}</td><td class="num">${loc("GGSE.PF2E.Bulk")}</td></tr></thead>
        ${g.rows.map((i) => `
        <tr><td class="prof">${i.equipped}${i.invested}</td><td>${esc(i.name)}</td>
        <td class="num">${esc(i.qty)}</td><td class="num">${esc(i.bulk)}</td></tr>`).join("")}
      </table>
    </div>`).join("")}
    <p class="inv-total">
      ${d.currency ? `<strong>${loc("GGSE.Currency")}:</strong> ${esc(d.currency)}` : ""}
      ${d.totalBulk ? ` · <strong>${loc("GGSE.PF2E.Bulk")}:</strong> ${esc(d.totalBulk)}` : ""}
    </p>
  </section>` : ""}
`;
}

/** Cuerpo de D&D 5e (sin cambios respecto de v1.2.4). */
function body5e(d) {
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

  return `  <header>
    ${d.img ? `<img src="${esc(d.img)}" alt="">` : ""}
    <div>
      <h1>${esc(d.name)}</h1>
      <div class="subtitle">${esc(subtitle)}</div>
    </div>
  </header>

  <section>
    <div class="combat-band">
      <span><b>${loc("GGSE.AC")}</b>${esc(d.ac)}</span>
      <span><b>${loc("GGSE.HP")}</b>${esc(d.hp.value)}/${esc(d.hp.max)}</span>
      <span><b>${loc("GGSE.Initiative")}</b>${esc(d.init)}</span>
      <span><b>${loc("GGSE.Proficiency")}</b>${esc(d.prof)}</span>
      ${d.movement ? `<span><b>${loc("GGSE.Speed")}</b>${esc(d.movement)}</span>` : ""}
      ${d.senses ? `<span><b>${loc("GGSE.Senses")}</b>${esc(d.senses)}</span>` : ""}
      ${d.passive ? `<span><b>${loc("GGSE.PassivePerception")}</b>${esc(d.passive)}</span>` : ""}
    </div>
    ${!d.isNPC ? `<div class="track-band">
      <span><b>${loc("GGSE.TempHP")}</b><span class="blank">${d.hp.temp ? `&nbsp;${esc(d.hp.temp)}` : ""}</span></span>
      ${d.hitDice ? `<span><b>${loc("GGSE.HitDice")}</b>${esc(d.hitDice)}</span>` : ""}
      <span><b>${loc("GGSE.DeathSaves")}</b>${loc("GGSE.SuccessAbbr")} <span class="bub">${d.deathSaves.success}</span> · ${loc("GGSE.FailureAbbr")} <span class="bub">${d.deathSaves.failure}</span></span>
      <span><b>${loc("GGSE.Inspiration")}</b><span class="bub">${d.inspiration ? "●" : "○"}</span></span>
    </div>` : ""}
    <div class="abilities">${abilityCards(d)}</div>
  </section>

  <div class="p1-cols">
    <section>
      <h2>${loc("GGSE.Skills")}</h2>
      <table>${d.skills.map((s) => `
        <tr><td class="prof">${s.prof}</td><td>${esc(s.label)}</td>
        <td class="dim">${esc(s.ability)}</td><td class="num">${esc(s.total)}</td></tr>`).join("")}</table>
      <p class="legend">${loc("GGSE.LegendSkills")}</p>
    </section>
    <div>
      ${traits.length ? `<section class="traits"><h2>${loc("GGSE.Traits")}</h2>
        ${traits.map(([k, v]) => `<p><b>${esc(k)}:</b> ${esc(v)}</p>`).join("")}</section>` : ""}
      ${d.attacks.length ? `<section><h2>${loc("GGSE.Attacks")}</h2>
        <table>
          <thead><tr><td></td><td>${loc("GGSE.Weapon")}</td><td class="num">${loc("GGSE.ToHit")}</td><td>${loc("GGSE.Damage")}</td></tr></thead>
          ${d.attacks.map((a) => `
          <tr><td class="prof">${a.equipped}</td><td><strong>${esc(a.name)}</strong>
          ${a.props ? `<span class="dim"> · ${esc(a.props)}</span>` : ""}</td>
          <td class="num">${esc(a.toHit)}</td><td>${esc(a.damage)}</td></tr>`).join("")}
        </table></section>` : ""}
    </div>
  </div>

  ${d.featureGroups?.length ? `<section class="allow-break">
    <h2>${loc("GGSE.Features")}</h2>
    <div class="multicol">${d.featureGroups.map((g) => `
      <div class="block"><h4>${esc(g.label)}</h4>
      <ul class="plain">${g.feats.map((f) => `<li>${esc(f.name)}${f.uses ? ` <span class="uses">${esc(f.uses)}</span>` : ""}</li>`).join("")}</ul></div>`).join("")}
    </div>
  </section>` : ""}

  ${d.hasSpells ? `<section class="allow-break">
    <h2>${loc("GGSE.Spells")}</h2>
    <p class="dim">
      ${d.spellAbility ? `${loc("GGSE.SpellAbility")}: <strong>${esc(d.spellAbility)}</strong> · ` : ""}
      ${d.spellDC ? `${loc("GGSE.SpellDC")}: <strong>${esc(d.spellDC)}</strong> · ` : ""}
      ${d.spellAttack ? `${loc("GGSE.SpellAttack")}: <strong>${esc(d.spellAttack)}</strong>` : ""}
      ${d.pactSlots ? ` · ${loc("GGSE.PactSlots")}: <strong>${esc(d.pactSlots)}</strong>` : ""}
      <span class="legend"> — ${loc("GGSE.LegendSpells")}</span></p>
    <div class="multicol">${d.spellLevels.map((lvl) => `
      <div class="block"><h3>${esc(lvl.label)} ${lvl.bubbles ? `<span class="bub">${lvl.bubbles}</span>` : ""}</h3>
      <ul class="plain">${lvl.spells.map((s) => `<li>${s.prepared} <strong>${esc(s.name)}</strong>
        <span class="dim">${esc(s.school)}${s.conc ? " · C" : ""}${s.ritual ? " · R" : ""}${s.mode ? ` · ${esc(s.mode)}` : ""}</span></li>`).join("")}</ul></div>`).join("")}
    </div>
  </section>` : ""}

  ${d.invGroups?.length ? `<section class="allow-break">
    <h2>${loc("GGSE.Inventory")}</h2>
    ${d.invGroups.map((g) => `
    <div style="break-inside:auto">
      <h4>${esc(g.label)}</h4>
      <table>
        <thead><tr><td></td><td>${loc("GGSE.Item")}</td><td class="num">${loc("GGSE.Qty")}</td><td class="num">${loc("GGSE.Weight")}</td></tr></thead>
        ${g.rows.map((i) => `
        <tr><td class="prof">${i.equipped}</td><td>${esc(i.name)}</td>
        <td class="num">${esc(i.qty)}</td><td class="num">${esc(i.weight)}</td></tr>`).join("")}
      </table>
    </div>`).join("")}
    <p class="inv-total">
      ${d.currency ? `<strong>${loc("GGSE.Currency")}:</strong> ${esc(d.currency)}` : ""}
      ${d.totalWeight ? ` · <strong>${loc("GGSE.TotalWeight")}:</strong> ${esc(Math.round(d.totalWeight * 100) / 100)} lb` : ""}
    </p>
  </section>` : ""}

`;
}

export function buildPrintHTML(d) {
  return `<!DOCTYPE html>
<html lang="${game.i18n.lang || "es"}">
<head>
<meta charset="utf-8">
<title>${esc(d.name)} — GG Sheet Export</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
<style>
  :root { --ink:#241a12; --amber:#a06914; --amber-b:#e0a23c; --wine:#8a2f3f; --rule:#c9b99a; --dim:#6f6151; }
  * { box-sizing:border-box; margin:0; padding:0; }
  html, body { background:#fff; color:var(--ink);
    font-family:"Cormorant Garamond", Georgia, serif; font-size:12.5pt; line-height:1.35; }
  .page { max-width:19cm; margin:0 auto; padding:1cm 0.4cm 1.6cm; }

  h1, h2, h3 { font-family:"Cinzel", Georgia, serif; }
  h1 { font-size:24pt; font-weight:700; letter-spacing:0.02em; }
  .subtitle { font-size:12pt; font-style:italic; color:var(--wine); margin-top:2pt; }
  header { border-bottom:2.5pt solid var(--amber-b); padding-bottom:8pt; margin-bottom:10pt;
    display:flex; gap:14pt; align-items:flex-end; }
  header img { width:68pt; height:68pt; object-fit:cover; border:1.5pt solid var(--amber-b); border-radius:4pt; }

  h2, h3, h4 { break-after:avoid; }
  h2 { font-size:12pt; font-weight:700; letter-spacing:0.12em; text-transform:uppercase;
    color:var(--wine); border-bottom:1pt solid var(--rule); padding-bottom:2pt; margin:12pt 0 6pt; }
  h3 { font-size:11pt; margin:6pt 0 3pt; }
  h4 { font-family:"Cinzel", Georgia, serif; font-size:9.5pt; letter-spacing:0.08em;
    text-transform:uppercase; color:var(--dim); margin:8pt 0 2pt; }

  .combat-band { display:flex; flex-wrap:wrap; gap:4pt 16pt; font-size:11.5pt;
    background:#faf6ee; border:1pt solid var(--rule); border-radius:4pt 4pt 0 0; padding:6pt 10pt; }
  .combat-band b { font-family:"Cinzel", Georgia, serif; font-size:9pt; letter-spacing:0.06em;
    text-transform:uppercase; color:var(--dim); margin-right:3pt; }
  .track-band { display:flex; flex-wrap:wrap; gap:4pt 16pt; font-size:10.5pt; color:var(--dim);
    border:1pt dashed var(--rule); border-top:none; border-radius:0 0 4pt 4pt; padding:4pt 10pt; margin:0 4pt; }
  .track-band b { font-family:"Cinzel", Georgia, serif; font-size:8.5pt; letter-spacing:0.06em;
    text-transform:uppercase; margin-right:3pt; }
  .bub { letter-spacing:2pt; color:var(--amber); }
  .blank { display:inline-block; min-width:38pt; border-bottom:0.75pt solid var(--dim); }

  .abilities { display:grid; grid-template-columns:repeat(6, 1fr); gap:6pt; margin:8pt 0; }
  .ab { text-align:center; border:1pt solid var(--rule); border-radius:5pt; padding:5pt 2pt; }
  .ab-abbr { font-family:"Cinzel", Georgia, serif; font-size:8.5pt; letter-spacing:0.1em; color:var(--dim); }
  .ab-mod { font-size:17pt; font-weight:600; }
  .ab-score { font-size:9.5pt; color:var(--dim); }
  .ab-save { font-size:8.5pt; border-top:0.5pt solid var(--rule); margin-top:3pt; padding-top:2pt; }

  .p1-cols { display:grid; grid-template-columns:1fr 1fr; gap:0 18pt; }
  table { width:100%; border-collapse:collapse; font-size:11pt; }
  thead { display:table-header-group; }
  thead td { font-family:"Cinzel", Georgia, serif; font-size:8pt; letter-spacing:0.08em;
    text-transform:uppercase; color:var(--dim); border-bottom:1pt solid var(--rule); }
  td { padding:1.5pt 3pt; border-bottom:0.5pt solid #eee4d2; vertical-align:top; }
  tr { break-inside:avoid; }
  td.num { text-align:right; white-space:nowrap; font-variant-numeric:tabular-nums; }
  td.prof { width:12pt; color:var(--amber); }
  .dim { color:var(--dim); font-size:10pt; }
  .uses { color:var(--wine); font-size:10pt; }

  .multicol { column-count:2; column-gap:18pt; }
  .block { break-inside:avoid; }
  ul.plain { list-style:none; }
  ul.plain li { padding:1.5pt 0; border-bottom:0.5pt solid #eee4d2; break-inside:avoid; }
  .traits p { margin:2pt 0; }
  .traits b { color:var(--wine); }
  .legend { font-size:9pt; color:var(--dim); margin-top:3pt; }
  .bio p { margin:4pt 0; text-align:justify; hyphens:auto; }
  .bio img { max-width:100%; }
  /* Content-links de Foundry en la biografía: en papel no hay click ni FontAwesome */
  .bio a { color:inherit; text-decoration:none; border-bottom:0.5pt dotted var(--dim); }
  .bio i[class^="fa"], .bio i[class*=" fa"] { display:none; }
  .inv-total { margin-top:5pt; font-size:11pt; }

  .print-footer { position:fixed; bottom:0; left:0; right:0; text-align:center;
    font-size:8.5pt; color:var(--dim); font-style:italic;
    border-top:0.5pt solid var(--rule); padding-top:3pt; background:#fff; }

  /* ---- Pathfinder 2e ---- */
  .glyph { color:var(--amber); font-size:10pt; letter-spacing:-0.5pt; white-space:nowrap; }
  .glyph-txt { color:var(--dim); font-size:9.5pt; font-style:italic; white-space:nowrap; }
  .rank { font-family:"Cinzel", Georgia, serif; font-size:7pt; letter-spacing:0.05em;
    color:var(--dim); text-transform:uppercase; }
  .saves3 { display:grid; grid-template-columns:repeat(3, 1fr); gap:6pt; margin:8pt 0; }
  .save-box { text-align:center; border:1pt solid var(--rule); border-radius:5pt; padding:4pt 2pt; }
  .save-box .lbl { font-family:"Cinzel", Georgia, serif; font-size:8.5pt; letter-spacing:0.08em;
    text-transform:uppercase; color:var(--dim); }
  .save-box .val { font-size:16pt; font-weight:600; font-variant-numeric:tabular-nums; }
  .save-box .rk { font-size:8pt; color:var(--dim); }
  .saves-note { font-size:10pt; font-style:italic; color:var(--dim); margin:-4pt 0 6pt; }
  .map { float:right; font-variant-numeric:tabular-nums; color:var(--dim); font-size:10pt; }
  .entry { border-left:1.5pt solid var(--rule); padding-left:7pt; margin-bottom:8pt; break-inside:avoid; }
  .entry-meta { font-size:10pt; color:var(--dim); margin-bottom:3pt; }

  section { break-inside:avoid; }
  section.allow-break { break-inside:auto; }
  @page { size:A4; margin:1.4cm 1.4cm 1.7cm; }
  @media print { .page { padding:0 0 1cm; max-width:none; } }
</style>
</head>
<body>
<div class="print-footer">${esc(d.name)} · ${loc("GGSE.ExportedWith")} GG Sheet Export · GegesVTT · ${esc(d.exportDate)}</div>
<div class="page">
  ${d.isPF2e ? bodyPF2e(d) : body5e(d)}

  ${d.biography ? `<section class="allow-break bio">
    <h2>${loc("GGSE.Biography")}</h2>
    ${d.biography}
  </section>` : ""}
</div>
<script>
  // Espera a que carguen las fuentes web y las imágenes (con tope de 2.5s)
  // antes de abrir el diálogo de impresión, para que el PDF salga siempre con
  // la tipografía correcta y el retrato del personaje. Funciona igual dentro
  // del iframe oculto (v1.2.4+) que en la ventana emergente de fallback.
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
