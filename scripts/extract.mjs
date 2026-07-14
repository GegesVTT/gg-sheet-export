/**
 * GG Sheet Export — extract.mjs
 * Convierte un Actor dnd5e (character/npc) en un objeto plano y estable,
 * pensado para alimentar el visor, el exportador Markdown y el PDF.
 * Todo con optional chaining: los data models de dnd5e cambian seguido.
 */

const loc = (k) => game.i18n.localize(k);

/* ---------- helpers ---------- */

export function fmtMod(n) {
  n = Number(n);
  if (!Number.isFinite(n)) return "—";
  return (n >= 0 ? "+" : "") + n;
}

function cfgLabel(cfg, key) {
  const e = cfg?.[key];
  if (!e) return key ?? "";
  if (typeof e === "string") return e;
  return e.label ?? key;
}

function setToArray(v) {
  if (!v) return [];
  if (v instanceof Set) return [...v];
  if (Array.isArray(v)) return v;
  if (typeof v === "object" && v.value !== undefined) return setToArray(v.value);
  return [v];
}

/** Aplana el config anidado de idiomas de dnd5e moderno { standard: { children: {...} } } */
function flattenLanguages(cfg, out = {}) {
  for (const [k, v] of Object.entries(cfg ?? {})) {
    if (typeof v === "string") out[k] = v;
    else if (v && typeof v === "object") {
      if (v.label) out[k] = v.label;
      if (v.children) flattenLanguages(v.children, out);
    }
  }
  return out;
}

function traitList(trait, configMap) {
  if (!trait) return "";
  const flat = flattenLanguages(configMap);
  const parts = setToArray(trait.value ?? trait).map((k) => flat[k] ?? cfgLabel(configMap, k) ?? k);
  const custom = (trait.custom ?? "").split(";").map((s) => s.trim()).filter(Boolean);
  return [...parts, ...custom].join(", ");
}

function profMarker(p) {
  if (p >= 2) return "◆"; // pericia
  if (p >= 1) return "●"; // competente
  if (p > 0) return "◐";  // media competencia
  return "○";
}

/* ---------- extracción principal ---------- */

export async function extractActorData(actor) {
  const sys = actor.system ?? {};
  const C = CONFIG.DND5E ?? {};
  const isNPC = actor.type === "npc";

  /* --- identidad --- */
  const classes = actor.items
    .filter((i) => i.type === "class")
    .map((c) => {
      const sub = actor.items.find(
        (s) => s.type === "subclass" && (s.system?.classIdentifier === c.system?.identifier || !s.system?.classIdentifier)
      );
      return `${c.name}${sub ? ` (${sub.name})` : ""} ${c.system?.levels ?? ""}`.trim();
    });

  const raceItem = actor.items.find((i) => i.type === "race");
  const bgItem = actor.items.find((i) => i.type === "background");
  const race = raceItem?.name ?? (typeof sys.details?.race === "string" ? sys.details.race : "");
  const background = bgItem?.name ?? (typeof sys.details?.background === "string" ? sys.details.background : "");

  const level = sys.details?.level ?? actor.items
    .filter((i) => i.type === "class")
    .reduce((n, c) => n + (c.system?.levels ?? 0), 0);

  /* --- atributos --- */
  const abilities = Object.entries(sys.abilities ?? {}).map(([key, ab]) => {
    const save = typeof ab.save === "object" ? ab.save?.value : ab.save;
    const saveProf = typeof ab.save === "object" ? (ab.save?.proficient ?? ab.proficient) : ab.proficient;
    return {
      key,
      label: cfgLabel(C.abilities, key),
      abbr: (C.abilities?.[key]?.abbreviation ?? key).toUpperCase(),
      value: ab.value ?? 10,
      mod: fmtMod(ab.mod),
      save: fmtMod(save ?? ab.mod),
      saveProf: profMarker(saveProf ? 1 : 0)
    };
  });

  const skills = Object.entries(sys.skills ?? {})
    .map(([key, sk]) => ({
      key,
      label: cfgLabel(C.skills, key),
      ability: (C.abilities?.[sk.ability]?.abbreviation ?? sk.ability ?? "").toUpperCase(),
      total: fmtMod(sk.total),
      passive: sk.passive ?? "",
      prof: profMarker(sk.proficient ?? 0)
    }))
    .sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang));

  const attrs = sys.attributes ?? {};
  const movement = Object.entries(attrs.movement ?? {})
    .filter(([k, v]) => typeof v === "number" && v > 0)
    .map(([k, v]) => `${cfgLabel(C.movementTypes, k)} ${v} ${attrs.movement?.units ?? "ft"}`)
    .join(", ");

  const senses = Object.entries(attrs.senses ?? {})
    .filter(([k, v]) => typeof v === "number" && v > 0)
    .map(([k, v]) => `${cfgLabel(C.senses, k)} ${v} ${attrs.senses?.units ?? "ft"}`)
    .join(", ");

  /* --- rasgos defensivos e idiomas --- */
  const traits = sys.traits ?? {};
  const languages = traitList(traits.languages, C.languages);
  const resist = traitList(traits.dr, C.damageTypes);
  const immune = traitList(traits.di, C.damageTypes);
  const vuln = traitList(traits.dv, C.damageTypes);
  const condImmune = traitList(traits.ci, C.conditionTypes);

  /* --- ataques (armas) --- */
  const attacks = actor.items
    .filter((i) => i.type === "weapon")
    .map((w) => {
      let toHit = w.labels?.toHit ?? "";
      let damage = w.labels?.damage ?? "";
      if (!damage && Array.isArray(w.labels?.derivedDamage)) {
        damage = w.labels.derivedDamage.map((d) => `${d.formula} ${d.damageType ?? ""}`.trim()).join(" + ");
      }
      // dnd5e 4+: buscar en activities si labels quedó vacío
      if ((!toHit || !damage) && w.system?.activities) {
        try {
          for (const act of w.system.activities) {
            toHit ||= act.labels?.toHit ?? "";
            damage ||= act.labels?.damage ?? "";
          }
        } catch (e) { /* estructura distinta según versión: seguimos */ }
      }
      return {
        name: w.name,
        equipped: w.system?.equipped ? "●" : "○",
        toHit: toHit || "—",
        damage: damage || "—",
        props: w.labels?.properties?.map?.((p) => p.label ?? p).join(", ") ?? ""
      };
    })
    .sort((a, b) => (a.equipped === b.equipped ? 0 : a.equipped === "●" ? -1 : 1));

  /* --- conjuros --- */
  const spellItems = actor.items.filter((i) => i.type === "spell");
  const spellLevels = [];
  for (let lvl = 0; lvl <= 9; lvl++) {
    const spells = spellItems
      .filter((s) => (s.system?.level ?? 0) === lvl)
      .map((s) => {
        // dnd5e 5.1+: system.method + system.prepared. Fallback a la API vieja (preparation.mode/prepared).
        const sd = s.system ?? {};
        let method, isPrepared;
        if (sd.method !== undefined) {
          method = sd.method;
          isPrepared = sd.prepared;
        } else {
          const prep = sd.preparation ?? {};
          method = prep.mode;
          isPrepared = prep.prepared;
        }
        const props = setToArray(sd.properties);
        // El catálogo de modos cambió de spellPreparationModes a spellcasting en 5.1
        const modeMap = C.spellcasting ?? C.spellPreparationModes ?? {};
        const usesPrep = method === "prepared" || method === "spell" || method === undefined;
        return {
          name: s.name,
          school: cfgLabel(C.spellSchools, sd.school),
          prepared: usesPrep ? (isPrepared ? "●" : "○") : "●",
          mode: method && !usesPrep ? cfgLabel(modeMap, method) : "",
          conc: props.includes("concentration") ? "C" : "",
          ritual: props.includes("ritual") ? "R" : ""
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang));
    if (spells.length) {
      const slot = sys.spells?.[`spell${lvl}`];
      const max = slot?.max ?? 0;
      const avail = Math.min(slot?.value ?? 0, max);
      spellLevels.push({
        level: lvl,
        label: lvl === 0 ? loc("GGSE.Cantrips") : `${loc("GGSE.Level")} ${lvl}`,
        slots: lvl > 0 && max ? `${slot.value ?? 0}/${max}` : "",
        bubbles: lvl > 0 && max ? "●".repeat(avail) + "○".repeat(max - avail) : "",
        spells
      });
    }
  }
  const pact = sys.spells?.pact;
  const pactSlots = pact?.max ? `${pact.value ?? 0}/${pact.max} (${loc("GGSE.Level")} ${pact.level ?? "?"})` : "";
  const spellDC = attrs.spelldc ?? sys.attributes?.spell?.dc ?? null;
  const spellAbility = cfgLabel(C.abilities, attrs.spellcasting ?? sys.attributes?.spellcasting);

  /* --- rasgos y dotes --- */
  const features = actor.items
    .filter((i) => i.type === "feat")
    .map((f) => {
      const uses = f.system?.uses;
      return {
        name: f.name,
        subtitle: f.system?.type?.label ?? cfgLabel(C.featureTypes, f.system?.type?.value) ?? "",
        uses: uses?.max ? `${uses.value ?? 0}/${uses.max}` : ""
      };
    });

  /* --- rasgos agrupados por origen --- */
  const ORIGIN_KEYS = { race: "GGSE.OriginRace", class: "GGSE.OriginClass", subclass: "GGSE.OriginClass",
    background: "GGSE.OriginBackground", feat: "GGSE.OriginFeat" };
  const featureGroups = [];
  for (const f of features) { f._origin = null; }
  for (const item of actor.items.filter((i) => i.type === "feat")) {
    const key = ORIGIN_KEYS[item.system?.type?.value] ?? "GGSE.OriginOther";
    const label = loc(key);
    let g = featureGroups.find((x) => x.label === label);
    if (!g) featureGroups.push(g = { label, feats: [] });
    const uses = item.system?.uses;
    g.feats.push({ name: item.name, uses: uses?.max ? `${uses.value ?? 0}/${uses.max}` : "" });
  }

  /* --- inventario agrupado por categoría, equipados primero --- */
  const INV_TYPES = ["weapon", "equipment", "consumable", "tool", "loot", "container"];
  const CAT_KEYS = { weapon: "GGSE.CatWeapons", equipment: "GGSE.CatEquipment", consumable: "GGSE.CatConsumables",
    tool: "GGSE.CatTools", container: "GGSE.CatContainers", loot: "GGSE.CatLoot" };
  const inventory = actor.items
    .filter((i) => INV_TYPES.includes(i.type))
    .map((i) => ({
      name: i.name,
      type: i.type,
      qty: i.system?.quantity ?? 1,
      weight: i.system?.weight?.value || "",
      equipped: i.system?.equipped ? "●" : ""
    }));
  const invGroups = INV_TYPES
    .map((t) => ({
      label: loc(CAT_KEYS[t]),
      rows: inventory
        .filter((i) => i.type === t)
        .sort((a, b) => (a.equipped === b.equipped ? a.name.localeCompare(b.name, game.i18n.lang) : a.equipped ? -1 : 1))
    }))
    .filter((g) => g.rows.length);
  const totalWeight = inventory.reduce((n, i) => n + (Number(i.weight) || 0) * (i.qty ?? 1), 0);

  const currency = Object.entries(sys.currency ?? {})
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${v} ${cfgLabel(C.currencies, k) || k.toUpperCase()}`)
    .join(" · ");

  /* --- biografía enriquecida --- */
  let biography = "";
  try {
    const TE = foundry.applications?.ux?.TextEditor?.implementation ?? globalThis.TextEditor;
    biography = await TE.enrichHTML(sys.details?.biography?.value ?? "", {
      secrets: actor.isOwner,
      relativeTo: actor
    });
  } catch (e) {
    biography = sys.details?.biography?.value ?? "";
  }

  return {
    isNPC,
    name: actor.name,
    img: actor.img,
    classes: classes.join(" / "),
    level,
    race,
    background,
    alignment: sys.details?.alignment ?? "",
    cr: isNPC ? (sys.details?.cr ?? "") : "",
    creatureType: isNPC ? cfgLabel(C.creatureTypes, sys.details?.type?.value) : "",
    xp: sys.details?.xp?.value ?? "",
    prof: fmtMod(attrs.prof),
    ac: attrs.ac?.value ?? "",
    hp: { value: attrs.hp?.value ?? 0, max: attrs.hp?.max ?? 0, temp: attrs.hp?.temp ?? 0 },
    init: fmtMod(attrs.init?.total ?? attrs.init?.mod),
    movement,
    senses,
    inspiration: !!attrs.inspiration,
    hitDice: (() => {
      const hd = attrs.hd;
      if (hd && typeof hd === "object" && hd.max) return `${hd.value ?? 0}/${hd.max}`;
      return "";
    })(),
    deathSaves: {
      success: "●".repeat(attrs.death?.success ?? 0) + "○".repeat(Math.max(0, 3 - (attrs.death?.success ?? 0))),
      failure: "●".repeat(attrs.death?.failure ?? 0) + "○".repeat(Math.max(0, 3 - (attrs.death?.failure ?? 0)))
    },
    passive: sys.skills?.prc?.passive ?? "",
    abilities,
    skills,
    featureGroups,
    invGroups,
    totalWeight,
    languages,
    resist,
    immune,
    vuln,
    condImmune,
    attacks,
    hasSpells: spellLevels.length > 0,
    spellLevels,
    pactSlots,
    spellDC,
    spellAttack: spellDC ? fmtMod(spellDC - 8) : "",
    spellAbility,
    features,
    inventory,
    currency,
    biography,
    exportDate: new Date().toLocaleDateString(game.i18n.lang || "es")
  };
}
