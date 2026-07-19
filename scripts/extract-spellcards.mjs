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

/** Mejor esfuerzo para salvación / ataque / daño (labels y, si no, actividades). */
function combatBits(item) {
  const L = item.labels ?? {};
  let save = L.save ?? "";
  let toHit = L.toHit ?? "";
  let damage = L.damage ?? L.damages ?? "";

  const acts = item.system?.activities;
  const first = acts?.contents?.[0] ?? (acts ? [...acts][0] : null);
  if (first?.labels) {
    toHit ||= first.labels.toHit ?? "";
    damage ||= first.labels.damage ?? "";
  }
  if (!save && first?.save) {
    const dc = first.save.dc?.value ?? first.save.dc;
    const ab = first.save.ability;
    const abLabel = Array.isArray(ab)
      ? ab.map((a) => cfgLabel(CONFIG.DND5E?.abilities, a)).join("/")
      : cfgLabel(CONFIG.DND5E?.abilities, ab);
    if (dc) save = `${loc("GGSE.Cards.DC")} ${dc} ${abLabel}`.trim();
  }
  if (Array.isArray(damage)) damage = damage.join(" + ");
  return { save, toHit, damage: typeof damage === "string" ? damage : "" };
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

    // Componentes: "V, S, M" del label o reconstruido desde properties.
    let components = L.components?.vsm ?? (typeof L.components === "string" ? L.components : "");
    if (!components) {
      components = [
        props.includes("vocal") ? "V" : null,
        props.includes("somatic") ? "S" : null,
        props.includes("material") ? "M" : null
      ].filter(Boolean).join(", ");
    }

    const raw = sd.description?.value ?? "";
    let descHTML = "";
    try {
      descHTML = sanitizeCardDesc(await TE.enrichHTML(raw, { secrets: false, relativeTo: s, async: true }));
    } catch (e) {
      descHTML = sanitizeCardDesc(raw);
    }

    const { save, toHit, damage } = combatBits(s);

    return {
      name: s.name,
      level,
      levelLabel: level === 0 ? loc("GGSE.Cantrips") : `${loc("GGSE.Level")} ${level}`,
      school: cfgLabel(C.spellSchools, schoolKey),
      schoolColor: SCHOOL_COLORS[schoolKey] ?? "var(--card-amber)",
      activation: L.activation || "—",
      range: L.range || "—",
      duration: L.duration || "—",
      components: components || "—",
      material: sd.materials?.value ?? "",
      concentration: props.includes("concentration") || !!sd.duration?.concentration,
      ritual: props.includes("ritual"),
      save, toHit, damage,
      descHTML,
      sourceRef: sourceRef(s)
    };
  }));

  spells.sort((a, b) => (a.level - b.level) || a.name.localeCompare(b.name, game.i18n.lang));

  const spellDC = attrs.spelldc ?? actor.system?.attributes?.spell?.dc ?? null;

  return {
    actorName: actor.name,
    spellDC,
    spellAtk: spellDC ? spellDC - 8 : null,
    spellCount: spells.length,
    spells,
    exportDate: new Date().toLocaleDateString(game.i18n.lang || "es")
  };
}
