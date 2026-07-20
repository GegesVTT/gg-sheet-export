/**
 * GG Sheet Export — extract-spellcards.mjs
 * Extrae los conjuros de un actor de D&D 5e a un modelo plano pensado para
 * tarjetas imprimibles (frente con datos, dorso con texto).
 *
 * Se apoya en item.labels.* (que el sistema ya localiza: tiempo de lanzamiento,
 * alcance, duración, componentes, salvación, ataque, daño) y cae a system.* solo
 * cuando el label no está. Los números de salvación/ataque salen del propio
 * personaje, así que las tarjetas quedan con los valores reales de esa mesa.
 *
 * Solo D&D 5e por ahora. La estética/tema es responsabilidad de spellcards-print.
 */

const loc = (k) => game.i18n.localize(k);

function getTextEditor() {
  return foundry.applications?.ux?.TextEditor?.implementation ?? globalThis.TextEditor;
}

/** Acepta config viejo (string) y nuevo ({ label }). */
function cfgLabel(cfg, key) {
  const e = cfg?.[key];
  if (!e) return key ?? "";
  return (typeof e === "object" ? (e.label ?? e.name) : e) ?? key ?? "";
}

function setToArray(v) {
  if (!v) return [];
  if (v instanceof Set) return [...v];
  if (Array.isArray(v)) return v;
  if (typeof v === "object") return Object.keys(v).filter((k) => v[k]);
  return [];
}

// Acento de color por escuela (clave abreviada de dnd5e).
const SCHOOL_COLORS = {
  abj: "#3f6fb0", con: "#c98a2c", div: "#7f8b99", enc: "#c65a9c",
  evo: "#c0433b", ill: "#7b52b8", nec: "#4b8b57", trs: "#3f9d9d"
};

/** Descripción para el dorso: se conservan párrafos, listas y negritas; se
 *  quitan tablas, imágenes y enlaces (una tarjeta no es lugar para eso). */
function sanitizeCardDesc(html) {
  if (!html) return "";
  const div = document.createElement("div");
  div.innerHTML = html;
  div.querySelectorAll("script, style, img, iframe, audio, video").forEach((el) => el.remove());
  div.querySelectorAll("table").forEach((el) => {
    const p = document.createElement("p");
    p.innerHTML = `<em>[${loc("GGSE.Cards.TableOmitted")}]</em>`;
    el.replaceWith(p);
  });
  div.querySelectorAll("a").forEach((a) => {
    const span = document.createElement("span");
    span.textContent = a.textContent ?? "";
    a.replaceWith(span);
  });
  div.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((h) => {
    const p = document.createElement("p");
    p.innerHTML = `<strong>${h.textContent}</strong>`;
    h.replaceWith(p);
  });
  div.querySelectorAll("*").forEach((el) => {
    for (const attr of [...el.attributes]) el.removeAttribute(attr.name);
  });
  return div.innerHTML.trim();
}

/** Referencia de manual/página desde system.source (dnd5e 3.x+). */
function sourceRef(item) {
  const s = item.system?.source;
  if (!s) return "";
  if (typeof s === "string") return s;
  const page = s.page ? `${loc("GGSE.Cards.Page")} ${s.page}` : "";
  const book = s.book || s.custom || s.label || s.value || "";
  return [book, page].filter(Boolean).join(" ").trim();
}

/** Abreviatura de característica en mayúsculas (DEX, CON…), con fallbacks. */
function abilityLabel(a) {
  const e = CONFIG.DND5E?.abilities?.[a];
  if (!e) return String(a ?? "").toUpperCase();
  const s = (typeof e === "object" ? (e.abbreviation ?? e.label) : e) ?? a;
  return String(s).toUpperCase();
}

/** Lista de características (Set | array | string) → "DEX" o "DEX/CON". */
function abilityList(ab) {
  if (!ab) return "";
  const arr = ab instanceof Set ? [...ab] : (Array.isArray(ab) ? ab : [ab]);
  return arr.map(abilityLabel).filter(Boolean).join("/");
}

/** Una parte de daño (DamageData del sistema u objeto de labels) → "8d6 fuego". */
function partFormula(p) {
  if (typeof p === "string") return p;
  if (!p) return "";
  let f = p.formula || p.custom?.formula || "";
  if (!f && (p.number || p.denomination)) {
    f = p.number && p.denomination ? `${p.number}d${p.denomination}` : (p.denomination ? `d${p.denomination}` : `${p.number ?? ""}`);
    if (p.bonus) f += ` + ${p.bonus}`;
  }
  if (!f && p.label) f = p.label;
  return f;
}

function partType(p) {
  if (!p || typeof p === "string") return "";
  return p.damageType ?? p.type ?? (p.types instanceof Set ? [...p.types][0] : (Array.isArray(p.types) ? p.types[0] : "")) ?? "";
}

/** Etiqueta de tiempo de lanzamiento reconstruida desde system.activation. */
function activationLabel(a) {
  if (!a?.type) return "";
  const cfg = CONFIG.DND5E?.activityActivationTypes ?? CONFIG.DND5E?.abilityActivationTypes ?? {};
  const base = cfgLabel(cfg, a.type) || a.type;
  return a.value && a.value > 1 ? `${a.value} ${base}` : base;
}

/** Salvación / ataque / daño / escalado. dnd5e 5.x los guarda en actividades:
 *  la habilidad de salvación es un Set y el daño son objetos con su tipo. */
function combatBits(item, level) {
  const L = item.labels ?? {};
  const acts = item.system?.activities;
  const first = acts?.contents?.[0] ?? (acts ? [...acts][0] : null);

  // Ataque: el label del sistema ya viene como "+7".
  const toHit = (typeof first?.labels?.toHit === "string" && first.labels.toHit)
    || (typeof L.toHit === "string" ? L.toHit : "") || "";

  // Salvación: CD + característica (Set → "DEX").
  let save = "";
  const sv = first?.save ?? item.system?.save;
  if (sv) {
    const dc = sv.dc?.value ?? (typeof sv.dc === "number" ? sv.dc : null);
    const ab = abilityList(sv.ability);
    if (dc) save = `${loc("GGSE.Cards.DC")} ${dc}${ab ? " " + ab : ""}`;
  }
  if (!save && typeof L.save === "string") save = L.save;

  // Daño: fórmula + tipo por parte (el ícono sale del tipo, el texto de la desc).
  let parts = first?.damage?.parts ?? first?.system?.damage?.parts ?? null;
  if (!Array.isArray(parts) || !parts.length) {
    parts = Array.isArray(L.damages) ? L.damages : (Array.isArray(L.damage) ? L.damage : null);
  }
  const damageParts = Array.isArray(parts)
    ? parts.map((p) => ({ formula: partFormula(p), type: partType(p) })).filter((d) => d.formula)
    : (typeof L.damage === "string" && L.damage ? [{ formula: L.damage, type: "" }] : []);

  // Escalado. Trucos: dados por nivel de personaje (N5/N11/N17). Conjuros con
  // nivel: incremento por espacio si el sistema lo expone.
  let scaling = null;
  const base = damageParts[0]?.formula || "";
  const m = /^(\d+)d(\d+)$/.exec(base);
  if (level === 0 && m) {
    const n = +m[1], x = m[2];
    scaling = { cantrip: [2, 3, 4].map((t) => `${n * t}d${x}`) };
  } else if (level > 0 && Array.isArray(parts) && parts[0]) {
    const sc = parts[0].scaling ?? parts[0].system?.scaling;
    const f = sc?.formula || (sc?.number && m ? `${sc.number}d${m[2]}` : "");
    if (f) scaling = { upcast: f };
  }

  return { save, toHit, damageParts, scaling };
}

export async function extractSpellCards(actor) {
  const C = CONFIG.DND5E ?? {};
  const TE = getTextEditor();
  const attrs = actor.system?.attributes ?? {};
  const spellItems = actor.items.filter((i) => i.type === "spell");

  const spells = await Promise.all(spellItems.map(async (s) => {
    const sd = s.system ?? {};
    const L = s.labels ?? {};
    const props = setToArray(sd.properties);
    const level = Number(sd.level ?? 0);
    const schoolKey = sd.school ?? "";

    // Componentes: "V, S, M" del label, o reconstruido desde properties (5.x)
    // o desde el objeto system.components (formato viejo / imports SRD).
    let components = L.components?.vsm ?? (typeof L.components === "string" ? L.components : "");
    if (!components) {
      const legacy = sd.components ?? {};
      const has = (k, lk) => props.includes(k) || legacy[lk];
      components = [
        has("vocal", "vocal") ? "V" : null,
        has("somatic", "somatic") ? "S" : null,
        has("material", "material") ? "M" : null
      ].filter(Boolean).join(", ");
    }

    const raw = sd.description?.value ?? "";
    let descHTML = "";
    try {
      descHTML = sanitizeCardDesc(await TE.enrichHTML(raw, { secrets: false, relativeTo: s, async: true }));
    } catch (e) {
      descHTML = sanitizeCardDesc(raw);
    }

    const { save, toHit, damageParts, scaling } = combatBits(s, level);

    // Algunos conjuros (p.ej. Counterspell en 5.x) traen el tiempo de
    // lanzamiento en la actividad, no en el item → fallbacks encadenados.
    const acts = sd.activities;
    const firstAct = acts?.contents?.[0] ?? (acts ? [...acts][0] : null);
    const activation = L.activation || firstAct?.labels?.activation || activationLabel(sd.activation) || "—";
    const range = L.range || firstAct?.labels?.range || "—";
    const duration = L.duration || firstAct?.labels?.duration || "—";

    return {
      name: s.name,
      level,
      levelLabel: level === 0 ? loc("GGSE.Cards.Cantrip") : `${loc("GGSE.Level")} ${level}`,
      school: cfgLabel(C.spellSchools, schoolKey),
      schoolColor: SCHOOL_COLORS[schoolKey] ?? "var(--card-amber)",
      activation,
      range,
      duration,
      components: components || "—",
      material: sd.materials?.value ?? "",
      concentration: props.includes("concentration") || !!sd.duration?.concentration,
      ritual: props.includes("ritual"),
      save, toHit, damageParts, scaling,
      descHTML,
      sourceRef: sourceRef(s)
    };
  }));

  spells.sort((a, b) => (a.level - b.level) || a.name.localeCompare(b.name, game.i18n.lang));

  // Deduplicado opcional (mismo nombre + nivel), apagado por defecto.
  let outSpells = spells;
  try {
    if (game.settings.get("gg-sheet-export", "spellCardDedupe")) {
      const seen = new Set();
      outSpells = spells.filter((s) => {
        const k = `${s.level}|${(s.name || "").toLowerCase()}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    }
  } catch (e) { /* ajuste no registrado: sin deduplicado */ }

  const spellDC = attrs.spelldc ?? actor.system?.attributes?.spell?.dc ?? null;

  return {
    actorName: actor.name,
    spellDC,
    spellAtk: spellDC ? spellDC - 8 : null,
    spellCount: outSpells.length,
    spells: outSpells,
    exportDate: new Date().toLocaleDateString(game.i18n.lang || "es")
  };
}
