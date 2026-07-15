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



/** CSS compartido entre el PDF y la exportación HTML: identidad visual única. */
const BASE_CSS = `
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
  .container-block { border-left:1.5pt solid var(--rule); padding-left:7pt; margin-bottom:6pt; }
  .container-block h4 { margin-bottom:2pt; }
  /* Los h4 van en mayúsculas por el estilo general, pero los metadatos
     ("en Mochila · 47 lb / 500 · el contenido no pesa") son una frase, no un
     título: en mayúsculas parecen un grito. */
  .container-block h4 .dim { text-transform:none; letter-spacing:0; font-weight:400; }

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
`;

/** Desplegable de descripción. Solo se emite en la exportación HTML: el PDF
 *  pasa opts vacío y esto devuelve "" — la ficha impresa no cambia en nada. */
function desc(opts, texto) {
  if (!opts?.descriptions || !texto) return "";
  return `<details class="ggse-desc"><summary></summary><div class="ggse-desc-body">${texto}</div></details>`;
}

/** Cuerpo de Pathfinder 2e. */
function bodyPF2e(d, opts = {}) {
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
function body5e(d, opts = {}) {
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
          ${a.props ? `<span class="dim"> · ${esc(a.props)}</span>` : ""}${desc(opts, a.description)}</td>
          <td class="num">${esc(a.toHit)}</td><td>${esc(a.damage)}</td></tr>`).join("")}
        </table></section>` : ""}
    </div>
  </div>

  ${d.featureGroups?.length ? `<section class="allow-break">
    <h2>${loc("GGSE.Features")}</h2>
    <div class="multicol">${d.featureGroups.map((g) => `
      <div class="block"><h4>${esc(g.label)}</h4>
      <ul class="plain">${g.feats.map((f) => `<li>${esc(f.name)}${f.uses ? ` <span class="uses">${esc(f.uses)}</span>` : ""}${f.subtitle && f.subtitle !== g.label ? ` <span class="dim">· ${esc(f.subtitle)}</span>` : ""}${desc(opts, f.description)}</li>`).join("")}</ul></div>`).join("")}
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
        <span class="dim">${esc(s.school)}${s.conc ? " · C" : ""}${s.ritual ? " · R" : ""}${s.mode ? ` · ${esc(s.mode)}` : ""}</span>${desc(opts, s.description)}</li>`).join("")}</ul></div>`).join("")}
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
        <tr><td class="prof">${i.equipped}</td><td>${esc(i.name)}${desc(opts, i.description)}</td>
        <td class="num">${esc(i.qty)}</td><td class="num">${esc(i.weight)}</td></tr>`).join("")}
      </table>
    </div>`).join("")}
    <p class="inv-total">
      ${d.currency ? `<strong>${loc("GGSE.Currency")}:</strong> ${esc(d.currency)}` : ""}
      ${d.totalWeight ? ` · <strong>${loc("GGSE.TotalWeight")}:</strong> ${esc(Math.round(d.totalWeight * 100) / 100)} lb` : ""}
      ${d.encumbrance?.encumbered ? ` <span class="dim">(${loc("GGSE.Encumbered")} ${esc(d.encumbrance.encumbered)} · ${loc("GGSE.Max")} ${esc(d.encumbrance.max)})</span>` : ""}
    </p>
  </section>` : ""}

  ${d.containerGroups?.length ? `<section class="allow-break">
    <h2>${loc("GGSE.CatContainers")}</h2>
    ${d.containerGroups.map((c) => `
    <div class="container-block" style="break-inside:auto">
      <h4>${esc(c.name)}
        <span class="dim">${[
          c.parent ? `${loc("GGSE.InsideOf")} ${esc(c.parent)}` : "",
          c.contentsWeight !== null ? `${esc(c.contentsWeight)} lb${c.capacity ? ` / ${esc(c.capacity)}` : ""}` : "",
          c.weightless ? loc("GGSE.Weightless") : ""
        ].filter(Boolean).join(" · ")}</span>
      </h4>
      ${c.rows.length ? `<table>
        <thead><tr><td></td><td>${loc("GGSE.Item")}</td><td class="num">${loc("GGSE.Qty")}</td><td class="num">${loc("GGSE.Weight")}</td></tr></thead>
        ${c.rows.map((i) => `
        <tr><td class="prof">${i.equipped}</td><td>${esc(i.name)}${desc(opts, i.description)}</td>
        <td class="num">${esc(i.qty)}</td><td class="num">${esc(i.weight)}</td></tr>`).join("")}
      </table>` : `<p class="dim">${loc("GGSE.EmptyContainer")}</p>`}
    </div>`).join("")}
  </section>` : ""}

`;
}

export function buildPrintHTML(d, opts = {}) {
  return `<!DOCTYPE html>
<html lang="${game.i18n.lang || "es"}">
<head>
<meta charset="utf-8">
<title>${esc(d.name)} — GG Sheet Export</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
<style>
${BASE_CSS}
  @page { size:A4; margin:1.4cm 1.4cm 1.7cm; }
  @media print { .page { padding:0 0 1cm; max-width:none; } }
</style>
</head>
<body>
<div class="print-footer">${esc(d.name)} · ${loc("GGSE.ExportedWith")} GG Sheet Export · GegesVTT · ${esc(d.exportDate)}</div>
<div class="page">
  ${d.isPF2e ? bodyPF2e(d, opts) : body5e(d, opts)}

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


/* ---------- exportación HTML autónoma ----------
   El PDF lo genera la imprenta del navegador y hornea las imágenes; un .html que
   te descargás, no: <img src="worlds/..."> apunta al servidor de Foundry y se ve
   roto en cuanto abrís el archivo con Foundry apagado o se lo mandás a alguien.
   Por eso el retrato y el logo se incrustan en base64. */

const LOGO_PATHS = [
  `modules/gg-sheet-export/assets/logo.png`,
  `modules/gg-sheet-export/assets/logo.svg`,
  `modules/gg-sheet-export/docs/images/icon.png`
];

/* Logo incrustado (96px, ~8 KB). Es el camino que no puede fallar: en The Forge
   el fetch a rutas del módulo devolvió 404 aunque el resto del fetch funcionaba,
   así que el archivo en disco queda como override opcional y esto como garantía. */
const LOGO_FALLBACK = "data:image/png;base64,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";

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
    // Retrato en una URL externa: CORS puede bloquear el fetch. Mejor sin imagen
    // que con el archivo roto.
    console.warn(`gg-sheet-export | no se pudo incrustar ${url}`, e);
    return "";
  }
}

async function buscarLogo() {
  for (const p of LOGO_PATHS) {
    const data = await aDataURL(p);
    if (data) return data;
  }
  return LOGO_FALLBACK;
}

export async function buildStandaloneHTML(d) {
  // No mutamos el objeto original: el visor lo sigue usando.
  const dd = { ...d, img: (await aDataURL(d.img)) || "" };
  const logo = await buscarLogo();
  const cuerpo = dd.isPF2e ? bodyPF2e(dd, { descriptions: true }) : body5e(dd, { descriptions: true });

  return `<!DOCTYPE html>
<html lang="${esc(game.i18n.lang || "es")}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(dd.name)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
<style>
${BASE_CSS}

/* ---- pantalla ---- */
body { background:#efe9dd; margin:0; padding:16px; }
.page { max-width:900px; margin:0 auto; background:#fff; padding:28px 32px;
  box-shadow:0 2px 18px rgba(0,0,0,0.18); border-radius:4px; }

.ggse-brand { display:flex; align-items:center; justify-content:center; gap:8px;
  margin-bottom:14px; }
.ggse-brand img { height:34px; width:auto; }
.ggse-brand span { font-family:"Cinzel", Georgia, serif; font-size:10pt;
  letter-spacing:0.14em; text-transform:uppercase; color:var(--dim); }

/* ---- desplegables ---- */
.ggse-desc { display:inline; }
.ggse-desc > summary {
  display:inline-block; list-style:none; cursor:pointer;
  width:14px; height:14px; line-height:13px; text-align:center;
  border:1px solid var(--amber); border-radius:50%;
  color:var(--amber); font-size:9pt; font-family:Georgia, serif;
  margin-left:5px; vertical-align:1px; user-select:none;
}
.ggse-desc > summary::-webkit-details-marker { display:none; }
.ggse-desc > summary::after { content:"?"; }
.ggse-desc[open] > summary::after { content:"×"; }
.ggse-desc > summary:hover { background:var(--amber); color:#fff; }
.ggse-desc-body {
  display:block; margin:5pt 0 7pt; padding:6pt 9pt;
  background:rgba(0,0,0,0.03); border-left:2px solid var(--rule);
  border-radius:0 3px 3px 0; font-size:10.5pt; line-height:1.45;
}
.ggse-desc-body :is(h1,h2,h3,h4) { font-size:10.5pt; margin:5pt 0 2pt; border:0; }
.ggse-desc-body p { margin:3pt 0; }
.ggse-desc-body ul, .ggse-desc-body ol { margin:3pt 0 3pt 16pt; padding:0; }
.ggse-desc-body table { width:auto; margin:4pt 0; font-size:9.5pt; }
.ggse-desc-body td, .ggse-desc-body th { border:1px solid var(--rule); padding:1pt 5pt; }

/* Los rasgos van a una columna: un <details> abriéndose dentro de una grilla
   multicolumna reflowea toda la sección y el texto salta de lugar. */
.multicol { column-count:1; }

.ggse-hint { text-align:center; font-size:10pt; color:var(--dim); margin:0 0 12px;
  font-style:italic; }

/* ---- impresión: este mismo archivo, impreso, da la ficha compacta ---- */
@media print {
  body { background:#fff; padding:0; }
  .page { box-shadow:none; max-width:none; padding:0; border-radius:0; }
  .ggse-desc, .ggse-hint { display:none !important; }
  .multicol { column-count:2; }
  @page { size:A4; margin:12mm 12mm 14mm; }
}
</style>
</head>
<body>
<div class="page">
  ${logo ? `<div class="ggse-brand"><img src="${logo}" alt=""><span>Crónicas Bárdicas</span></div>` : ""}
  <p class="ggse-hint">${loc("GGSE.HtmlHint")}</p>
${cuerpo}
  <p class="footer-line">${esc(dd.name)} · ${loc("GGSE.ExportedWith")} GG Sheet Export · GegesVTT · ${esc(dd.exportDate)}</p>
</div>
</body>
</html>`;
}
