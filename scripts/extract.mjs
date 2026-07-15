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
  // Subclases: usamos el getter class.subclass del sistema dnd5e cuando existe
  // (enlaza por classIdentifier de forma canónica). Fallback manual: solo match
  // EXACTO de identifier, sin reutilizar subclases ya asignadas a otra clase.
  // Antes, una subclase sin classIdentifier se enganchaba a cualquier clase
  // (bug reportado: multiclase Wizard/Rogue mostraba "Rogue (Bladesong)").
  // Único caso donde toleramos identifier vacío: una sola clase + una sola
  // subclase (homebrew/traducciones que no completan el campo).
  const classItems = actor.items
    .filter((i) => i.type === "class")
    .sort((a, b) => (b.system?.levels ?? 0) - (a.system?.levels ?? 0));
  const subclassItems = actor.items.filter((i) => i.type === "subclass");
  const usedSubIds = new Set();
  const classes = classItems.map((c) => {
    let sub = null;
    try { sub = c.subclass ?? null; } catch (e) { /* getter ausente en dnd5e viejos */ }
    if (!sub) {
      sub = subclassItems.find(
        (s) => !usedSubIds.has(s.id) && s.system?.classIdentifier && s.system.classIdentifier === c.system?.identifier
      ) ?? null;
    }
    if (!sub && classItems.length === 1 && subclassItems.length === 1 && !subclassItems[0].system?.classIdentifier) {
      sub = subclassItems[0];
    }
    if (sub) usedSubIds.add(sub.id);
    return `${c.name}${sub ? ` (${sub.name})` : ""} ${c.system?.levels ?? ""}`.trim();
  });

  const raceItem = actor.items.find((i) => i.type === "race");
  const bgItem = actor.items.find((i) => i.type === "background");
  const race = raceItem?.name ?? (typeof sys.details?.race === "string" ? sys.details.race : "");
  const background = bgItem?.name ?? (typeof sys.details?.background === "string" ? sys.details.background : "");

  const level = sys.details?.level ?? classItems.reduce((n, c) => n + (c.system?.levels ?? 0), 0);

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
  /* Recorrer attrs.movement a ciegas no sirve: dnd5e 5.x mete ahí valores derivados
     ("speed", "max") que no son formas de desplazarse y salían impresos como
     "Walk 25 ft, speed 25 ft, max 25 ft". Se usa la lista del propio CONFIG, que
     se adapta sola si el sistema agrega tipos nuevos. */
  const MOVE_TYPES = Object.keys(C.movementTypes ?? {}).length
    ? Object.keys(C.movementTypes)
    : ["walk", "burrow", "climb", "fly", "swim"];
  const movement = MOVE_TYPES
    .filter((k) => typeof attrs.movement?.[k] === "number" && attrs.movement[k] > 0)
    .map((k) => `${cfgLabel(C.movementTypes, k)} ${attrs.movement[k]} ${attrs.movement?.units ?? "ft"}`)
    .join(", ");

  const SENSE_TYPES = Object.keys(C.senses ?? {}).length
    ? Object.keys(C.senses)
    : ["blindsight", "darkvision", "tremorsense", "truesight"];
  const senses = Object.entries(attrs.senses ?? {})
    .filter(([k, v]) => SENSE_TYPES.includes(k) && typeof v === "number" && v > 0)
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
  // Algunas fórmulas de daño (ataque desarmado, armas "especiales" como un cuerno
  // natural) llegan con variables sin resolver, ej. "1 + @mod" o "1d6 + @abilities.dex.mod".
  // Foundry las resuelve recién al tirar el dado. Las resolvemos a mano acá con
  // Roll.replaceFormulaData, usando el rollData propio del ítem (incluye el alias "mod"
  // que dnd5e ya calcula para el arma).
  function resolveFormula(formula, item) {
    if (!formula || !formula.includes("@")) return formula;
    try {
      const rollData = item.getRollData?.() ?? actor.getRollData();
      // dnd5e 5.x ya no define el alias "mod" en rollData: sin esto, una fórmula
      // como "1 + @mod" (ataque sin armas) se resolvía a "1 + 0".
      if (rollData && rollData.mod === undefined) {
        const key = item.abilityMod ?? item.system?.ability;
        const m = key ? actor.system?.abilities?.[key]?.mod : null;
        if (typeof m === "number") rollData.mod = m;
      }
      const RollCls = foundry.dice?.Roll ?? globalThis.Roll;
      return RollCls.replaceFormulaData(formula, rollData, { missing: "0" });
    } catch (e) {
      return formula; // si falla, mejor mostrar la fórmula cruda que romper el módulo
    }
  }

  /* Fuente de verdad del daño en dnd5e 4/5: la activity, no el ítem.
     item.labels.damage trae solo el dado base ("1d6"); la activity trae lo que
     muestra la ficha y lo que se tira de verdad ("1d6 + 3 Slashing"), incluidos
     los dados extra de un arma mágica. Se prioriza la activity de tipo "attack". */
  function activityLabels(w) {
    const acts = w.system?.activities;
    const list = acts?.contents ?? (Array.isArray(acts) ? acts : Object.values(acts ?? {}));
    if (!list?.length) return { toHit: "", damage: "" };

    const readDamage = (act) => {
      const ld = act?.labels?.damage;
      if (!ld) return "";
      if (Array.isArray(ld)) {
        // Cada entrada es una parte de daño: {formula, label, damageType}.
        // Un arma con dado extra devuelve varias ("1d8 + 5" y "1d4 fire").
        // Ojo: una activity puede traer el tipo con la fórmula VACÍA (ej. un
        // ataque sin armas mal configurado) y su label sería solo " Bludgeoning".
        // Sin fórmula no hay daño: se descarta y se cae al ítem.
        return ld.map((p) => (p?.formula ? (p.label || p.formula) : "")).filter(Boolean).join(" + ");
      }
      return typeof ld === "string" ? ld.trim() : "";
    };

    // Las armas suelen tener varias activities (attack, save, utility).
    // La que interesa es la de ataque; el resto solo si aquella vino vacía.
    const attacks = list.filter((a) => a?.type === "attack");
    for (const group of [attacks, list]) {
      for (const act of group) {
        const damage = readDamage(act);
        if (damage) return { toHit: act?.labels?.toHit ?? "", damage };
      }
    }
    return { toHit: attacks[0]?.labels?.toHit ?? "", damage: "" };
  }

  const attacks = actor.items
    .filter((i) => i.type === "weapon")
    .map((w) => {
      // La activity manda: el ítem miente por omisión (da el dado sin el modificador).
      let toHit = "";
      let damage = "";
      try {
        const fromActivity = activityLabels(w);
        toHit = fromActivity.toHit;
        damage = fromActivity.damage;
      } catch (e) { /* estructura distinta según versión: caemos al ítem */ }

      toHit ||= w.labels?.toHit ?? "";
      if (!damage) {
        damage = w.labels?.damage ?? "";
        if (!damage && Array.isArray(w.labels?.derivedDamage)) {
          damage = w.labels.derivedDamage.map((d) => `${d.formula} ${d.damageType ?? ""}`.trim()).join(" + ");
        }
        damage = resolveFormula(damage, w);
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
  for (const item of actor.items.filter((i) => i.type === "feat")) {
    const key = ORIGIN_KEYS[item.system?.type?.value] ?? "GGSE.OriginOther";
    const label = loc(key);
    let g = featureGroups.find((x) => x.label === label);
    if (!g) featureGroups.push(g = { label, feats: [] });
    const uses = item.system?.uses;
    g.feats.push({ name: item.name, uses: uses?.max ? `${uses.value ?? 0}/${uses.max}` : "" });
  }

  /* --- inventario ---
     Los ítems guardados dentro de un contenedor llevan system.container con el id
     del contenedor. Antes se ignoraba: una poción dentro de la bolsa de contención
     se listaba igual que una en el cinturón, y el contenedor salía como una línea
     suelta sin contenido. Ahora lo suelto va agrupado por categoría y cada
     contenedor arma su propio bloque. */
  const INV_TYPES = ["weapon", "equipment", "consumable", "tool", "loot", "container"];
  const CAT_KEYS = { weapon: "GGSE.CatWeapons", equipment: "GGSE.CatEquipment", consumable: "GGSE.CatConsumables",
    tool: "GGSE.CatTools", container: "GGSE.CatContainers", loot: "GGSE.CatLoot" };

  const invItems = actor.items.filter((i) => INV_TYPES.includes(i.type));
  const containerOf = (i) => i.system?.container ?? null;

  const toRow = (i) => ({
    name: i.name,
    type: i.type,
    qty: i.system?.quantity ?? 1,
    weight: i.system?.weight?.value ?? (typeof i.system?.weight === "number" ? i.system.weight : "") ?? "",
    equipped: i.system?.equipped ? "●" : ""
  });
  const byEquippedThenName = (a, b) =>
    a.equipped === b.equipped ? a.name.localeCompare(b.name, game.i18n.lang) : a.equipped ? -1 : 1;

  // Suelto = no está dentro de ningún contenedor. Los contenedores tienen bloque propio.
  // Lista plana, por compatibilidad: el Markdown y cualquier consumidor viejo la usan.
  const inventory = invItems.map(toRow);

  const loose = invItems.filter((i) => !containerOf(i) && i.type !== "container");
  const invGroups = INV_TYPES
    .filter((t) => t !== "container")
    .map((t) => ({
      label: loc(CAT_KEYS[t]),
      rows: loose.filter((i) => i.type === t).map(toRow).sort(byEquippedThenName)
    }))
    .filter((g) => g.rows.length);

  // Un bloque por contenedor, con su contenido adentro.
  const containerGroups = [];
  for (const c of invItems.filter((i) => i.type === "container")) {
    const rows = invItems.filter((i) => containerOf(i) === c.id).map(toRow).sort(byEquippedThenName);
    // La bolsa de contención marca su contenido como sin peso: el sistema lo sabe
    // vía properties, y hay que decirlo o el peso listado no cierra con el total.
    const props = c.system?.properties;
    const weightless = props ? (props.has?.("weightlessContents") ?? [...props].includes("weightlessContents")) : false;
    let contentsWeight = null;
    try { contentsWeight = await c.system?.contentsWeight ?? null; } catch { /* según versión */ }
    const cap = c.system?.capacity?.weight?.value ?? null;
    containerGroups.push({
      id: c.id,
      name: c.name,
      weight: c.system?.weight?.value ?? "",
      capacity: cap,
      contentsWeight: typeof contentsWeight === "number" ? Math.round(contentsWeight * 100) / 100 : null,
      weightless,
      parentId: containerOf(c) ?? null,
      parent: containerOf(c) ? (invItems.find((x) => x.id === containerOf(c))?.name ?? "") : "",
      rows
    });
  }

  /* Un contenedor puede vivir dentro de otro (la caja de limosnas va en la mochila).
     Ordenados alfabéticamente quedaban separados de su padre y no se entendía;
     así cada anidado sale inmediatamente después del contenedor que lo lleva. */
  const byName = (a, b) => a.name.localeCompare(b.name, game.i18n.lang);
  const ordered = [];
  const pushWithChildren = (c) => {
    ordered.push(c);
    containerGroups.filter((x) => x.parentId === c.id).sort(byName).forEach(pushWithChildren);
  };
  containerGroups.filter((c) => !c.parentId).sort(byName).forEach(pushWithChildren);
  // Cualquiera cuyo padre no esté en la lista (por si acaso) no se pierde.
  for (const c of containerGroups) if (!ordered.includes(c)) ordered.push(c);
  containerGroups.length = 0;
  containerGroups.push(...ordered);

  /* El peso total lo calcula el sistema: incluye las monedas (0.02 lb c/u) y excluye
     el contenido de los contenedores sin peso. Sumarlo a mano daba mal por los dos
     lados a la vez. Se deja la suma manual solo como respaldo. */
  const enc = sys.attributes?.encumbrance;
  const manualWeight = invItems.reduce(
    (n, i) => n + (Number(i.system?.weight?.value) || 0) * (i.system?.quantity ?? 1), 0);
  const totalWeight = typeof enc?.value === "number" ? enc.value : manualWeight;
  const encumbrance = enc?.thresholds
    ? {
        value: enc.value,
        encumbered: enc.thresholds.encumbered ?? null,
        heavy: enc.thresholds.heavilyEncumbered ?? null,
        max: enc.thresholds.maximum ?? null,
        pct: enc.max ? Math.round((enc.value / enc.max) * 100) : null
      }
    : null;

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
    containerGroups,
    totalWeight,
    encumbrance,
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
