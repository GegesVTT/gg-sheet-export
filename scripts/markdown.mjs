/**
 * GG Sheet Export — markdown.mjs
 * Convierte el objeto extraído en un .md limpio, pensado para Obsidian/notas.
 */

const loc = (k) => game.i18n.localize(k);

/** Conversión mínima de HTML (biografía) a texto Markdown-ish. */
function htmlToMd(html) {
  if (!html) return "";
  let s = String(html)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/(h1|h2|h3|h4|h5|h6)>/gi, "\n\n")
    .replace(/<h1[^>]*>/gi, "## ")
    .replace(/<h2[^>]*>/gi, "### ")
    .replace(/<h3[^>]*>/gi, "#### ")
    .replace(/<h[456][^>]*>/gi, "##### ")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<(strong|b)[^>]*>/gi, "**")
    .replace(/<\/(strong|b)>/gi, "**")
    .replace(/<(em|i)[^>]*>/gi, "*")
    .replace(/<\/(em|i)>/gi, "*")
    .replace(/<[^>]+>/g, "");
  // decodificar entidades
  const ta = document.createElement("textarea");
  ta.innerHTML = s;
  s = ta.value;
  return s.replace(/\n{3,}/g, "\n\n").trim();
}

function table(headers, rows) {
  if (!rows.length) return "";
  const head = `| ${headers.join(" | ")} |`;
  const sep = `|${headers.map(() => "---").join("|")}|`;
  const body = rows.map((r) => `| ${r.join(" | ")} |`).join("\n");
  return `${head}\n${sep}\n${body}\n`;
}


/** Markdown de Pathfinder 2e. */
function pf2eToMarkdown(d) {
  const L = [];

  L.push(`# ${d.name}`);
  const sub = d.isNPC
    ? [d.rarity, d.size, d.creatureTraits, `${loc("GGSE.Level")} ${d.level}`]
    : [d.heritage || d.ancestry, d.classes, `${loc("GGSE.Level")} ${d.level}`, d.background, d.deity];
  L.push(`> ${sub.filter(Boolean).join(" · ")}`, "");

  // Combate
  L.push(`## ${loc("GGSE.Combat")}`);
  L.push(`- **${loc("GGSE.AC")}:** ${d.ac}`);
  L.push(`- **${loc("GGSE.HP")}:** ${d.hp.value}/${d.hp.max}${d.hp.temp ? ` (+${d.hp.temp} temp)` : ""}`);
  L.push(`- **${loc("GGSE.PF2E.Perception")}:** ${d.perception?.mod}${d.perception?.rankLabel ? ` (${d.perception.rankLabel})` : ""}`);
  L.push(`- **${loc("GGSE.Initiative")}:** ${d.init}`);
  if (d.movement) L.push(`- **${loc("GGSE.Speed")}:** ${d.movement}`);
  if (d.senses) L.push(`- **${loc("GGSE.Senses")}:** ${d.senses}`);
  if (d.classDC) L.push(`- **${loc("GGSE.PF2E.ClassDC")}:** ${d.classDC.dc}`);
  if (!d.isNPC) {
    L.push(`- **${loc("GGSE.PF2E.HeroPoints")}:** ${d.heroPoints.value}/${d.heroPoints.max}`);
    if (d.focus) L.push(`- **${loc("GGSE.PF2E.FocusPoints")}:** ${d.focus.value}/${d.focus.max}`);
  }
  L.push("");

  // Características (pf2e: solo modificadores)
  L.push(`## ${loc("GGSE.Abilities")}`);
  L.push(table(d.abilities.map((a) => a.abbr), [d.abilities.map((a) => a.mod)]));

  // Salvaciones
  L.push(`## ${loc("GGSE.PF2E.Saves")}`);
  L.push(d.showRanks
    ? table([loc("GGSE.Save"), loc("GGSE.Bonus"), "CD", loc("GGSE.Proficiency")],
        d.saves.map((s2) => [s2.label, s2.mod, String(s2.dc ?? ""), s2.rankLabel]))
    : table([loc("GGSE.Save"), loc("GGSE.Bonus"), "CD"],
        d.saves.map((s2) => [s2.label, s2.mod, String(s2.dc ?? "")])));
  if (d.savesNote) L.push(`*${d.savesNote}*`, "");

  // Habilidades
  L.push(`## ${loc("GGSE.Skills")}`);
  L.push(d.showRanks
    ? table([loc("GGSE.Skill"), "", loc("GGSE.Bonus"), loc("GGSE.Proficiency")],
        d.skills.map((s2) => [s2.label, s2.ability, s2.mod, s2.rankLabel]))
    : table([loc("GGSE.Skill"), "", loc("GGSE.Bonus")],
        d.skills.map((s2) => [s2.label, s2.ability, s2.mod])));

  // Rasgos defensivos
  const def = [];
  if (d.languages) def.push(`- **${loc("GGSE.Languages")}:** ${d.languages}`);
  if (d.immune) def.push(`- **${loc("GGSE.Immunities")}:** ${d.immune}`);
  if (d.resist) def.push(`- **${loc("GGSE.Resistances")}:** ${d.resist}`);
  if (d.vuln) def.push(`- **${loc("GGSE.Vulnerabilities")}:** ${d.vuln}`);
  if (def.length) { L.push(`## ${loc("GGSE.Traits")}`); L.push(...def, ""); }

  // Golpes
  if (d.strikes.length) {
    L.push(`## ${loc("GGSE.PF2E.Strikes")}`);
    L.push(table(
      [loc("GGSE.Weapon"), "MAP", loc("GGSE.Damage"), loc("GGSE.Properties")],
      d.strikes.map((st) => [`${st.glyph} **${st.name}**`, st.variants, st.damage, st.traits])
    ));
  }

  // Acciones
  for (const g of d.actionGroups ?? []) {
    L.push(`## ${g.label}`);
    for (const r of g.rows) {
      const extra = [r.uses, r.traits].filter(Boolean).join(" · ");
      L.push(`- ${r.glyph ? `${r.glyph} ` : ""}**${r.name}**${extra ? ` — ${extra}` : ""}`);
    }
    L.push("");
  }

  // Dotes
  if (d.featureGroups?.length) {
    L.push(`## ${loc("GGSE.Features")}`);
    for (const g of d.featureGroups) {
      L.push(`### ${g.label}`);
      for (const f of g.feats) {
        L.push(`- ${f.glyph ? `${f.glyph} ` : ""}**${f.name}**${f.level ? ` — ${loc("GGSE.Level")} ${f.level}` : ""}`);
      }
      L.push("");
    }
  }

  // Conjuros: una sección por entrada, cada una con su CD
  if (d.hasSpells) {
    L.push(`## ${loc("GGSE.Spells")}`);
    for (const e of d.spellEntries) {
      L.push(`### ${e.name}`);
      const meta = [`**${loc("GGSE.PF2E.Tradition")}:** ${e.tradition}`, `**${loc("GGSE.PF2E.SpellDC")}:** ${e.dc}`];
      if (e.attack) meta.push(`**${loc("GGSE.PF2E.SpellAttack")}:** ${e.attack}`);
      meta.push(e.rankLabel ? `${e.mode} · ${e.rankLabel}` : e.mode);
      L.push(`> ${meta.join(" · ")}`, "");
      for (const g of e.groups) {
        L.push(`#### ${g.label}${g.slots ? ` — ${g.slots} ${g.bubbles}` : ""}`);
        for (const sp of g.spells) {
          const tags = [sp.defense, sp.range].filter(Boolean).join(" · ");
          L.push(`- ${sp.prepared ? `${sp.prepared} ` : ""}${sp.glyph} **${sp.name}**${tags ? ` — *${tags}*` : ""}`);
        }
        L.push("");
      }
    }
  }

  // Inventario
  if (d.invGroups?.length) {
    L.push(`## ${loc("GGSE.Inventory")}`);
    for (const g of d.invGroups) {
      L.push(`### ${g.label}`);
      L.push(table(
        ["", loc("GGSE.Item"), loc("GGSE.Qty"), loc("GGSE.PF2E.Bulk")],
        g.rows.map((i) => [`${i.equipped}${i.invested}`, i.name, String(i.qty), String(i.bulk)])
      ));
    }
    const tot = [];
    if (d.currency) tot.push(`**${loc("GGSE.Currency")}:** ${d.currency}`);
    if (d.totalBulk) tot.push(`**${loc("GGSE.PF2E.Bulk")}:** ${d.totalBulk}`);
    if (tot.length) L.push(tot.join(" · "), "");
  }

  const bio = htmlToMd(d.biography);
  if (bio) { L.push(`## ${loc("GGSE.Biography")}`); L.push(bio, ""); }

  L.push("---");
  L.push(`*${loc("GGSE.ExportedWith")} GG Sheet Export · ${d.exportDate}*`);
  return L.join("\n");
}

export function actorToMarkdown(d) {
  if (d.isPF2e) return pf2eToMarkdown(d);
  const L = [];

  // Encabezado
  L.push(`# ${d.name}`);
  const sub = d.isNPC
    ? [d.creatureType, d.cr !== "" ? `CR ${d.cr}` : "", d.alignment]
    : [`${d.race}`, d.classes, `${loc("GGSE.Level")} ${d.level}`, d.background, d.alignment];
  L.push(`> ${sub.filter(Boolean).join(" · ")}`);
  L.push("");

  // Combate
  L.push(`## ${loc("GGSE.Combat")}`);
  L.push(`- **${loc("GGSE.AC")}:** ${d.ac}`);
  L.push(`- **${loc("GGSE.HP")}:** ${d.hp.value}/${d.hp.max}${d.hp.temp ? ` (+${d.hp.temp} temp)` : ""}`);
  L.push(`- **${loc("GGSE.Initiative")}:** ${d.init}`);
  if (d.movement) L.push(`- **${loc("GGSE.Speed")}:** ${d.movement}`);
  if (d.senses) L.push(`- **${loc("GGSE.Senses")}:** ${d.senses}`);
  L.push(`- **${loc("GGSE.Proficiency")}:** ${d.prof}`);
  L.push("");

  // Características
  L.push(`## ${loc("GGSE.Abilities")}`);
  L.push(table(
    d.abilities.map((a) => a.abbr),
    [
      d.abilities.map((a) => `${a.value} (${a.mod})`),
      d.abilities.map((a) => `${loc("GGSE.Save")} ${a.save} ${a.saveProf === "●" ? "●" : ""}`.trim())
    ]
  ));

  // Habilidades
  L.push(`## ${loc("GGSE.Skills")}`);
  L.push(table(
    [loc("GGSE.Skill"), "", loc("GGSE.Bonus"), loc("GGSE.Passive")],
    d.skills.map((s) => [`${s.prof} ${s.label}`, s.ability, s.total, s.passive])
  ));

  // Rasgos defensivos e idiomas
  const defensas = [];
  if (d.languages) defensas.push(`- **${loc("GGSE.Languages")}:** ${d.languages}`);
  if (d.resist) defensas.push(`- **${loc("GGSE.Resistances")}:** ${d.resist}`);
  if (d.immune) defensas.push(`- **${loc("GGSE.Immunities")}:** ${d.immune}`);
  if (d.vuln) defensas.push(`- **${loc("GGSE.Vulnerabilities")}:** ${d.vuln}`);
  if (d.condImmune) defensas.push(`- **${loc("GGSE.ConditionImmunities")}:** ${d.condImmune}`);
  if (defensas.length) {
    L.push(`## ${loc("GGSE.Traits")}`);
    L.push(...defensas, "");
  }

  // Ataques
  if (d.attacks.length) {
    L.push(`## ${loc("GGSE.Attacks")}`);
    L.push(table(
      ["", loc("GGSE.Weapon"), loc("GGSE.ToHit"), loc("GGSE.Damage"), loc("GGSE.Properties")],
      d.attacks.map((a) => [a.equipped, a.name, a.toHit, a.damage, a.props])
    ));
  }

  // Conjuros
  if (d.hasSpells) {
    L.push(`## ${loc("GGSE.Spells")}`);
    const meta = [];
    if (d.spellAbility) meta.push(`**${loc("GGSE.SpellAbility")}:** ${d.spellAbility}`);
    if (d.spellDC) meta.push(`**${loc("GGSE.SpellDC")}:** ${d.spellDC}`);
    if (d.spellAttack) meta.push(`**${loc("GGSE.SpellAttack")}:** ${d.spellAttack}`);
    if (d.pactSlots) meta.push(`**${loc("GGSE.PactSlots")}:** ${d.pactSlots}`);
    if (meta.length) L.push(`> ${meta.join(" · ")}`, "");
    for (const lvl of d.spellLevels) {
      L.push(`### ${lvl.label}${lvl.slots ? ` — ${loc("GGSE.Slots")} ${lvl.slots}` : ""}`);
      for (const s of lvl.spells) {
        const tags = [s.conc, s.ritual, s.mode].filter(Boolean).join(", ");
        L.push(`- ${s.prepared} **${s.name}** — ${s.school}${tags ? ` *(${tags})*` : ""}`);
      }
      L.push("");
    }
  }

  // Rasgos y dotes
  if (d.features.length) {
    L.push(`## ${loc("GGSE.Features")}`);
    for (const f of d.features) {
      const extra = [f.subtitle, f.uses ? `${loc("GGSE.Uses")}: ${f.uses}` : ""].filter(Boolean).join(" · ");
      L.push(`- **${f.name}**${extra ? ` — ${extra}` : ""}`);
    }
    L.push("");
  }

  // Inventario: lo suelto por categoría, y un bloque por contenedor
  if (d.invGroups?.length || d.containerGroups?.length) {
    L.push(`## ${loc("GGSE.Inventory")}`);
    for (const g of d.invGroups ?? []) {
      L.push(`### ${g.label}`);
      L.push(table(
        ["", loc("GGSE.Item"), loc("GGSE.Qty"), loc("GGSE.Weight")],
        g.rows.map((i) => [i.equipped, i.name, String(i.qty), String(i.weight)])
      ));
    }
    for (const c of d.containerGroups ?? []) {
      const meta = [];
      if (c.parent) meta.push(`${loc("GGSE.InsideOf")} ${c.parent}`);
      if (c.contentsWeight !== null && c.contentsWeight !== undefined) {
        meta.push(`${c.contentsWeight} lb${c.capacity ? ` / ${c.capacity}` : ""}`);
      }
      if (c.weightless) meta.push(`*${loc("GGSE.Weightless")}*`);
      L.push(`### ${c.name}${meta.length ? ` — ${meta.join(" · ")}` : ""}`);
      if (!c.rows.length) { L.push(`*${loc("GGSE.EmptyContainer")}*`, ""); continue; }
      L.push(table(
        ["", loc("GGSE.Item"), loc("GGSE.Qty"), loc("GGSE.Weight")],
        c.rows.map((i) => [i.equipped, i.name, String(i.qty), String(i.weight)])
      ));
    }
    const tot = [];
    if (d.currency) tot.push(`**${loc("GGSE.Currency")}:** ${d.currency}`);
    if (d.totalWeight) tot.push(`**${loc("GGSE.TotalWeight")}:** ${Math.round(d.totalWeight * 100) / 100} lb`);
    if (tot.length) L.push(tot.join(" · "), "");
  }

  // Biografía
  const bio = htmlToMd(d.biography);
  if (bio) {
    L.push(`## ${loc("GGSE.Biography")}`);
    L.push(bio, "");
  }

  L.push("---");
  L.push(`*${loc("GGSE.ExportedWith")} GG Sheet Export · ${d.exportDate}*`);

  return L.join("\n");
}
