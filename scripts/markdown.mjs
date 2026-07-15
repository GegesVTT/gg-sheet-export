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

export function actorToMarkdown(d) {
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

  // Inventario
  if (d.inventory.length) {
    L.push(`## ${loc("GGSE.Inventory")}`);
    L.push(table(
      ["", loc("GGSE.Item"), loc("GGSE.Qty"), loc("GGSE.Weight")],
      d.inventory.map((i) => [i.equipped, i.name, String(i.qty), String(i.weight)])
    ));
    if (d.currency) L.push(`**${loc("GGSE.Currency")}:** ${d.currency}`, "");
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
