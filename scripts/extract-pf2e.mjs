/**
 * GG Sheet Export — extract-pf2e.mjs
 * Convierte un Actor pf2e (character/npc) en un objeto plano y estable,
 * hermano de extract.mjs (dnd5e). Mismo contrato: devuelve un objeto que
 * alimenta el visor, el Markdown y el PDF.
 *
 * Validado contra pf2e 7.12.2 / Foundry 13.351 con Lionel Scaloni (bárbaro 5),
 * Ezren (mago 5, preparado), Seoni (hechicera 5, espontánea), Harsk (explorador 3)
 * y un Dragón de Cobre adulto (PNJ lanzador).
 *
 * Todo con optional chaining: el data model de pf2e cambia entre versiones.
 */

const loc = (k) => (typeof k === "string" && k.startsWith("PF2E.") ? game.i18n.localize(k) : (k ?? ""));

/* ---------- helpers ---------- */

export function fmtMod(n) {
  n = Number(n);
  if (!Number.isFinite(n)) return "—";
  return (n >= 0 ? "+" : "") + n;
}

function cfgLabel(cfg, key) {
  const e = cfg?.[key];
  if (e === undefined || e === null) return key ?? "";
  if (typeof e === "string") return loc(e);
  return loc(e.label ?? e.name) || (key ?? "");
}

/** Los rasgos viven repartidos en varios mapas de CONFIG; algunos legacy (chaotic/good) en ninguno. */
function traitLabel(t) {
  const C = CONFIG.PF2E ?? {};
  for (const map of [C.creatureTraits, C.actionTraits, C.spellTraits, C.featTraits, C.weaponTraits, C.alignmentTraits]) {
    const e = map?.[t];
    if (e) return loc(typeof e === "string" ? e : (e.label ?? e.name));
  }
  return String(t ?? "").replace(/(^|[-\s])(\w)/g, (m, a, b) => a + b.toUpperCase());
}

function bubbles(value, max) {
  const v = Math.max(0, Math.min(Number(value) || 0, Number(max) || 0));
  const m = Math.max(0, Number(max) || 0);
  return "●".repeat(v) + "○".repeat(m - v);
}

/* Símbolos de acción.
   pf2e usa una fuente propia (A/D/T/F/R) que no existe fuera del sistema, así que
   el PDF se abre en una ventana nueva sin esa fuente. Usamos Unicode, que imprime
   igual en cualquier lado y es lo que un jugador espera leer en una ficha. */
const GLYPH = { 1: "◆", 2: "◆◆", 3: "◆◆◆", free: "◇", reaction: "↺", passive: "" };

/** Costo de acciones de una dote/acción: (actionType, actions) → "◆◆" */
function activityGlyph(actionType, actions) {
  const t = actionType?.value ?? actionType;
  if (t === "reaction") return GLYPH.reaction;
  if (t === "free") return GLYPH.free;
  if (t === "passive") return "";
  const n = actions?.value ?? actions;
  return GLYPH[n] ?? (n ? String(n) : "");
}

/** Costo de un conjuro: system.time.value puede ser "2", "1 to 3", "reaction", "10 minutes". */
function spellGlyph(time) {
  const t = String(time?.value ?? time ?? "").trim();
  if (!t) return "";
  if (GLYPH[t]) return GLYPH[t];                       // "1" | "2" | "3"
  if (t === "reaction") return GLYPH.reaction;
  if (t === "free") return GLYPH.free;
  const range = t.match(/^(\d+)\s*(?:to|a|-|–)\s*(\d+)$/i);  // "1 to 3"
  if (range) return `${GLYPH[range[1]] ?? range[1]}–${GLYPH[range[2]] ?? range[2]}`;
  return t;                                            // "10 minutes", "1 minute"…
}

/** Rango de competencia: 0-4 → { rank, label, abbr } */
function profRank(rank) {
  const r = Number(rank) || 0;
  const label = cfgLabel(CONFIG.PF2E?.proficiencyLevels, r) || ["Untrained", "Trained", "Expert", "Master", "Legendary"][r];
  return { rank: r, label, abbr: (label?.[0] ?? "U").toUpperCase() };
}

/** Statistic de pf2e (save, skill, perception, classDC, spell DC) → objeto plano. */
function statOf(stat) {
  if (!stat) return null;
  const p = profRank(stat.rank);
  return {
    slug: stat.slug ?? "",
    label: loc(stat.label) || stat.slug || "",
    mod: fmtMod(stat.mod ?? stat.value ?? stat.totalModifier),
    dc: stat.dc?.value ?? (typeof stat.dc === "number" ? stat.dc : null),
    ability: (stat.attribute ?? "").toUpperCase(),
    rank: p.rank,
    rankLabel: p.label,
    rankAbbr: p.abbr,
    breakdown: stat.breakdown ?? ""
  };
}

/** Immunities / Weaknesses / Resistances: los objetos IWR tienen .label como getter. */
function iwrList(entries) {
  return (entries ?? [])
    .map((e) => {
      const base = e.label ?? cfgLabel(e.typeLabels, e.type) ?? e.type;
      return e.value ? `${base} ${e.value}` : base;
    })
    .filter(Boolean)
    .join(", ");
}

/* ---------- extracción principal ---------- */

export async function extractActorData(actor) {
  const sys = actor.system ?? {};
  const C = CONFIG.PF2E ?? {};
  const isNPC = actor.type === "npc";

  /* --- identidad --- */
  const size = cfgLabel(C.actorSizes, sys.traits?.size?.value);
  const rarity = sys.traits?.rarity && sys.traits.rarity !== "common"
    ? cfgLabel(C.rarityTraits, sys.traits.rarity) : "";
  const creatureTraits = (sys.traits?.value ?? []).map(traitLabel).join(", ");

  const languages = (sys.details?.languages?.value ?? [])
    .map((l) => cfgLabel(C.languages, l) || l)
    .sort((a, b) => a.localeCompare(b, game.i18n.lang))
    .join(", ");

  /* --- características: pf2e (Remaster) expone modificadores, no puntuaciones --- */
  const abilities = Object.entries(sys.abilities ?? {}).map(([key, ab]) => ({
    key,
    label: loc(ab.label) || key,
    abbr: (loc(ab.shortLabel) || key).toUpperCase(),
    mod: fmtMod(ab.mod)
  }));

  /* --- salvaciones: tres, con rango propio (a diferencia de las seis de 5e) --- */
  const saves = ["fortitude", "reflex", "will"]
    .map((k) => statOf(actor.saves?.[k]))
    .filter(Boolean);
  // Los PNJ suelen tener una nota tipo "+1 status a todas las salvaciones vs. magia"
  const savesNote = sys.attributes?.allSaves?.value ?? "";

  const perception = statOf(actor.perception ?? sys.perception);

  // Los PNJ no tienen CD de clase, pero el data model deja un objeto hueco
  // (dc: null) que un {{#if}} toma como verdadero. Se normaliza a null.
  const classDCRaw = isNPC ? null : statOf(sys.attributes?.classDC);
  const classDCStat = classDCRaw?.dc ? classDCRaw : null;

  /* --- iniciativa: statistic propio, NO derivable de Percepción.
     (Scaloni: Percepción +9 pero Iniciativa +11 por la dote Incredible Initiative) --- */
  const initStat = actor.initiative;
  const init = fmtMod(
    initStat?.mod ?? initStat?.check?.mod ?? initStat?.statistic?.mod ?? perception?.mod?.replace("+", "")
  );
  const initLabel = loc(initStat?.statistic?.label ?? initStat?.label ?? "") || perception?.label || "";

  const skills = Object.values(actor.skills ?? {})
    .map((sk) => statOf(sk))
    .filter(Boolean)
    .sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang));

  /* --- velocidades: en 7.x viven en system.movement.speeds, no en attributes --- */
  // Solo los cinco tipos que muestra la ficha nativa: "travel" es derivado y no va.
  const SPEED_TYPES = ["land", "burrow", "climb", "fly", "swim"];
  const ft = (() => {
    const k = game.i18n.localize("GGSE.PF2E.Feet");
    return k.startsWith("GGSE.") ? "ft" : k;   // el módulo puede no estar activo todavía
  })();
  const speeds = sys.movement?.speeds ?? sys.attributes?.speed ?? {};
  const movement = Object.values(speeds)
    .filter((s) => s && typeof s === "object" && SPEED_TYPES.includes(s.type) && (s.value ?? 0) > 0)
    .map((s) => `${traitLabel(cfgLabel(C.speedTypes, s.type) || s.type)} ${s.value} ${ft}`)
    .join(", ");

  const senses = (actor.perception?.senses ?? sys.perception?.senses ?? [])
    .map((s) => s.label ?? cfgLabel(C.senses, s.type) ?? s.type)
    .join(", ");

  /* --- defensas --- */
  const attrs = sys.attributes ?? {};
  const ac = actor.armorClass?.value ?? attrs.ac?.value ?? "";
  const acBreakdown = actor.armorClass?.breakdown ?? attrs.ac?.breakdown ?? "";
  const shield = attrs.shield?.itemId
    ? { name: attrs.shield.name, ac: fmtMod(attrs.shield.ac), hardness: attrs.shield.hardness,
        hp: `${attrs.shield.hp?.value ?? 0}/${attrs.shield.hp?.max ?? 0}`, raised: attrs.shield.raised, broken: attrs.shield.broken }
    : null;

  /* dying.max NO es fijo: Diehard lo sube a 5. Nunca hardcodear en 4. */
  const dying = { value: attrs.dying?.value ?? 0, max: attrs.dying?.max ?? 4,
                  bubbles: bubbles(attrs.dying?.value, attrs.dying?.max ?? 4) };
  const wounded = { value: attrs.wounded?.value ?? 0, max: attrs.wounded?.max ?? 3,
                    bubbles: bubbles(attrs.wounded?.value, attrs.wounded?.max ?? 3) };
  const doomed = { value: attrs.doomed?.value ?? 0, max: attrs.doomed?.max ?? 3 };

  const res = sys.resources ?? {};
  const heroPoints = isNPC ? null
    : { value: res.heroPoints?.value ?? 0, max: res.heroPoints?.max ?? 3,
        bubbles: bubbles(res.heroPoints?.value, res.heroPoints?.max ?? 3) };
  const focus = (res.focus?.max ?? 0) > 0
    ? { value: res.focus.value ?? 0, max: res.focus.max, bubbles: bubbles(res.focus.value, res.focus.max) }
    : null;

  /* --- ataques: variantes de MAP y daño ya resueltos por el sistema --- */
  const strikes = [];
  for (const strike of sys.actions ?? []) {
    if (strike.visible === false) continue;
    let damage = "";
    try { damage = (await strike.damage?.({ getFormula: true })) ?? ""; } catch { damage = ""; }
    // Fallback PNJ: los ítems "melee" traen las tiradas de daño escritas literalmente
    if (!damage) {
      damage = Object.values(strike.item?.system?.damageRolls ?? {})
        .map((d) => `${d.damage} ${cfgLabel(C.damageTypes, d.damageType) || (d.damageType ?? "")}`.trim())
        .join(" + ");
    }
    strikes.push({
      name: strike.label ?? strike.item?.name ?? "",
      glyph: GLYPH[1],                                  // un Golpe siempre cuesta una acción
      mod: fmtMod(strike.totalModifier),
      variants: (strike.variants ?? []).map((v) => v.label).join(" / "),
      damage: damage || "—",
      traits: (strike.traits ?? []).map((t) => loc(t.label) || traitLabel(t.value ?? t)).join(", "),
      ready: strike.ready !== false
    });
  }

  /* --- dotes agrupadas por categoría (ancestría / clase / habilidad / general) --- */
  const FEAT_CATS = ["ancestry", "class", "skill", "general", "bonus", "classfeature", "calling", "curse", "deviant"];
  const featItems = actor.itemTypes?.feat ?? [];
  const featureGroups = [];
  for (const cat of FEAT_CATS) {
    const rows = featItems
      .filter((f) => (f.system?.category ?? f.system?.featType?.value) === cat)
      .map((f) => ({
        name: f.name,
        level: f.system?.level?.value ?? "",
        glyph: activityGlyph(f.system?.actionType, f.system?.actions),
        traits: (f.system?.traits?.value ?? []).map(traitLabel).join(", ")
      }))
      .sort((a, b) => (a.level - b.level) || a.name.localeCompare(b.name, game.i18n.lang));
    if (rows.length) featureGroups.push({ label: cfgLabel(C.featCategories, cat) || cat, feats: rows });
  }
  // Cualquier categoría nueva que aparezca en una versión futura del sistema:
  const known = new Set(FEAT_CATS);
  const orphans = featItems.filter((f) => !known.has(f.system?.category ?? f.system?.featType?.value));
  if (orphans.length) {
    featureGroups.push({
      label: game.i18n.localize("GGSE.OriginOther"),
      feats: orphans.map((f) => ({ name: f.name, level: f.system?.level?.value ?? "",
        glyph: activityGlyph(f.system?.actionType, f.system?.actions), traits: "" }))
    });
  }

  /* --- acciones: la ficha nativa las agrupa por costo, y así se leen en mesa --- */
  // La ficha nativa mezcla acá las dotes con costo de acción (Sudden Charge ◆◆,
  // No Escape ↺). Se repiten en el bloque de dotes a propósito: en combate se
  // buscan por costo, no por origen.
  const actionItems = [
    ...(actor.itemTypes?.action ?? []),
    ...featItems.filter((f) => ["action", "reaction", "free"].includes(f.system?.actionType?.value))
  ];
  const actionBuckets = [
    { key: "action", label: "GGSE.PF2E.Actions" },
    { key: "reaction", label: "GGSE.PF2E.Reactions" },
    { key: "free", label: "GGSE.PF2E.FreeActions" },
    { key: "passive", label: "GGSE.PF2E.PassiveAbilities" }
  ];
  // Ruido a filtrar: "Cast a Spell" es una acción genérica del sistema, no del actor,
  // y la nota de salvaciones del PNJ ya tiene su propio lugar (savesNote).
  const noiseSlugs = new Set(["cast-a-spell"]);
  const isNoise = (a) =>
    noiseSlugs.has(a.system?.slug ?? "") ||
    (savesNote && a.name?.trim().toLowerCase() === savesNote.trim().toLowerCase());

  const actionGroups = actionBuckets
    .map((b) => ({
      label: game.i18n.localize(b.label),
      rows: actionItems
        .filter((a) => !isNoise(a))
        .filter((a) => (a.system?.actionType?.value ?? "passive") === b.key)
        .map((a) => {
          const freq = a.system?.frequency;
          return {
            name: a.name,
            glyph: activityGlyph(a.system?.actionType, a.system?.actions),
            traits: (a.system?.traits?.value ?? []).map(traitLabel).join(", "),
            uses: freq?.max ? `${freq.value ?? freq.max}/${loc(cfgLabel(C.frequencies, freq.per)) || freq.per}` : "",
            fromFeat: a.type === "feat"
          };
        })
        .sort((a, b2) => a.name.localeCompare(b2.name, game.i18n.lang))
    }))
    .filter((g) => g.rows.length);

  /* --- conjuros: cada entrada es autónoma (tradición, DC y ataque propios).
     El Bastón de Fuego de Ezren es una entrada espontánea aparte de su magia preparada. --- */
  const spellEntries = [];
  for (const entry of actor.itemTypes?.spellcastingEntry ?? []) {
    const mode = entry.system?.prepared?.value;                   // prepared|spontaneous|innate|focus
    // El DC de los PJ se calcula en runtime (entry.statistic); los PNJ lo traen escrito.
    const dc = entry.statistic?.dc?.value ?? entry.system?.spelldc?.dc ?? null;
    const attack = entry.statistic?.check?.mod ?? entry.system?.spelldc?.value ?? null;
    const entrySpells = (actor.itemTypes?.spell ?? []).filter((s) => s.system?.location?.value === entry.id);

    const mapSpell = (s, prepared = null) => ({
      name: s.name,
      glyph: spellGlyph(s.system?.time),
      range: loc(s.system?.range?.value) || "",
      defense: s.system?.defense?.save?.statistic
        ? `${s.system.defense.save.basic ? game.i18n.localize("GGSE.PF2E.Basic") + " " : ""}${cfgLabel(C.saves, s.system.defense.save.statistic)}`
        : (s.system?.defense?.passive?.statistic
            ? (s.system.defense.passive.statistic === "ac"
                ? game.i18n.localize("PF2E.ArmorClassShortLabel") || "AC"
                : traitLabel(s.system.defense.passive.statistic))
            : ""),
      traits: (s.system?.traits?.value ?? []).map(traitLabel).join(", "),
      prepared: prepared === null ? "" : (prepared ? "●" : "○")
    });

    const groups = [];
    const maxRank = Math.max(1, Math.ceil((sys.details?.level?.value ?? 1) / 2));

    for (let rank = 0; rank <= 10; rank++) {
      const slot = entry.system?.slots?.[`slot${rank}`];
      let spells = [];
      let slotLabel = "";

      let slotBubbles = "";

      if (mode === "prepared") {
        // Los preparados listan IDs por hueco (los trucos incluidos, en slot0).
        // Ojo: NO usan slot.value; lo que vale es la marca expended de cada conjuro.
        const prep = Array.isArray(slot?.prepared) ? slot.prepared : Object.values(slot?.prepared ?? {});
        spells = prep
          .map((p) => {
            const s = actor.items.get(p?.id);
            // Los trucos no se gastan: no llevan marca.
            return s ? mapSpell(s, rank === 0 ? null : !p.expended) : null;
          })
          .filter(Boolean);
        if (slot?.max && rank === 0) {
          slotLabel = String(slot.max);
        } else if (slot?.max) {
          const ready = prep.filter((p) => !p.expended).length;
          slotLabel = `${ready}/${slot.max}`;
          slotBubbles = "●".repeat(ready) + "○".repeat(Math.max(0, slot.max - ready));
        }
      } else {
        // Espontáneos, focales, innatos y trucos: se listan los conjuros conocidos del rango.
        spells = entrySpells
          .filter((s) => (rank === 0 ? s.isCantrip : !s.isCantrip && (s.system?.level?.value ?? 0) === rank))
          .map((s) => mapSpell(s))
          .sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang));
        if (rank > 0 && slot?.max) {
          slotLabel = `${slot.value ?? 0}/${slot.max}`;
          slotBubbles = bubbles(slot.value, slot.max);
        }
      }

      if (!spells.length && !slot?.max) continue;
      groups.push({
        rank,
        label: rank === 0 ? game.i18n.localize("GGSE.Cantrips") : `${game.i18n.localize("GGSE.PF2E.Rank")} ${rank}`,
        slots: slotLabel,
        bubbles: slotBubbles,
        spells
      });
    }

    spellEntries.push({
      name: entry.name,
      tradition: cfgLabel(C.magicTraditions, entry.system?.tradition?.value),
      mode: cfgLabel(C.preparationType, mode) || mode,
      isPrepared: mode === "prepared",
      ability: (entry.system?.ability?.value ?? "").toUpperCase(),
      dc: dc ?? "—",
      attack: attack === null ? "" : fmtMod(attack),
      rankLabel: profRank(entry.system?.proficiency?.value ?? entry.statistic?.rank).label,
      groups,
      maxRank
    });
  }

  /* --- inventario: pf2e mide Volumen (Bulk), no peso --- */
  const INV_TYPES = ["weapon", "armor", "shield", "equipment", "consumable", "treasure", "backpack"];
  const CAT_KEYS = {
    weapon: "GGSE.CatWeapons", armor: "GGSE.PF2E.CatArmor", shield: "GGSE.PF2E.CatShields",
    equipment: "GGSE.CatEquipment", consumable: "GGSE.CatConsumables",
    treasure: "GGSE.CatLoot", backpack: "GGSE.CatContainers"
  };
  const invGroups = INV_TYPES
    .map((t) => ({
      label: game.i18n.localize(CAT_KEYS[t]),
      rows: (actor.itemTypes?.[t] ?? [])
        // Las monedas ya salen en la línea de moneda; en la lista sobran.
        .filter((i) => !(t === "treasure" && (i.isCoinage || i.system?.stackGroup === "coins")))
        .map((i) => ({
          name: i.name,
          qty: i.system?.quantity ?? 1,
          bulk: (() => {
            const b = i.system?.bulk?.value ?? i.system?.bulk?.heldOrStowed;
            if (b === undefined || b === null) return "";
            if (b === 0) return "—";
            return b < 1 ? "L" : String(b);
          })(),
          equipped: i.system?.equipped?.carryType === "held" || i.system?.equipped?.inSlot ? "●" : "",
          invested: i.system?.equipped?.invested ? "◈" : ""
        }))
        .sort((a, b) => (a.equipped === b.equipped ? a.name.localeCompare(b.name, game.i18n.lang) : a.equipped ? -1 : 1))
    }))
    .filter((g) => g.rows.length);

  // Bulk total y monedas viven en actor.inventory (API del sistema, no del data model).
  let totalBulk = "";
  let currency = "";
  try {
    const b = actor.inventory?.bulk;
    if (b?.value) totalBulk = `${b.value.normal ?? 0}${b.value.light ? `, ${b.value.light}L` : ""}`;
    const coins = actor.inventory?.coins;
    if (coins) {
      currency = ["pp", "gp", "sp", "cp"]
        .filter((k) => coins[k])
        .map((k) => `${coins[k]} ${k.toUpperCase()}`)
        .join(" · ");
    }
  } catch { /* si el sistema cambia la API, el bloque queda vacío en vez de romper */ }

  /* --- biografía --- */
  let biography = "";
  try {
    const TE = foundry.applications?.ux?.TextEditor?.implementation ?? globalThis.TextEditor;
    const raw = isNPC
      ? (sys.details?.publicNotes ?? "")
      : (sys.details?.biography?.backstory ?? sys.details?.biography?.appearance ?? "");
    biography = await TE.enrichHTML(raw, { secrets: actor.isOwner, relativeTo: actor });
  } catch {
    biography = isNPC ? (sys.details?.publicNotes ?? "") : (sys.details?.biography?.backstory ?? "");
  }

  return {
    system: "pf2e",
    isPF2e: true,
    isNPC,
    name: actor.name,
    img: actor.img,
    level: sys.details?.level?.value ?? "",
    xp: isNPC ? "" : (sys.details?.xp?.value ?? ""),

    // identidad
    ancestry: actor.ancestry?.name ?? "",
    heritage: actor.heritage?.name ?? "",
    background: actor.background?.name ?? "",
    classes: actor.class?.name ?? "",
    deity: actor.deity?.name ?? "",
    size,
    rarity,
    creatureTraits,
    languages,

    // defensas
    ac,
    acBreakdown,
    hp: { value: attrs.hp?.value ?? 0, max: attrs.hp?.max ?? 0, temp: attrs.hp?.temp ?? 0 },
    shield,
    dying,
    wounded,
    doomed,
    heroPoints,
    focus,
    immune: iwrList(attrs.immunities),
    resist: iwrList(attrs.resistances),
    vuln: iwrList(attrs.weaknesses),

    // estadísticas
    abilities,
    saves,
    savesNote,
    perception,
    init,
    initLabel,
    skills,
    classDC: classDCStat,
    movement,
    senses,

    // bloques
    strikes,
    actionGroups,
    featureGroups,
    hasSpells: spellEntries.some((e) => e.groups.length),
    spellEntries,
    invGroups,
    totalBulk,
    currency,
    biography,
    exportDate: new Date().toLocaleDateString(game.i18n.lang || "es")
  };
}
