import { PI_TYPES_MAP, PI_SCHEMATICS, EXTRACTOR_TYPE_IDS } from "@/const";

// Parses and analyses EVE Online Planetary Interaction *templates* — the
// client's native planet-setup export format (abbreviated keys). Reference
// library: https://github.com/DalShooth/EVE_PI_Templates (fetched live).

export interface TemplatePin {
  T: number; // structure type_id
  La: number; // latitude
  Lo: number; // longitude
  H?: number; // extractor heads
  S?: number | null; // for factories: the produced product type_id
}

export interface TemplateLink {
  S: number; // source pin index (1-based)
  D: number; // destination pin index
  Lv: number; // link level
}

export interface TemplateRoute {
  P: number[]; // pin index path
  Q: number; // quantity
  T: number; // commodity type_id
}

export interface PiTemplate {
  CmdCtrLv: number;
  Cmt?: string;
  Diam?: number;
  Pln: number; // planet type_id
  P: TemplatePin[];
  L: TemplateLink[];
  R: TemplateRoute[];
}

export const PLANET_TYPES: Record<number, { key: string; name: string }> = {
  11: { key: "temperate", name: "Temperate" },
  12: { key: "ice", name: "Ice" },
  13: { key: "gas", name: "Gas" },
  2014: { key: "oceanic", name: "Oceanic" },
  2015: { key: "lava", name: "Lava" },
  2016: { key: "barren", name: "Barren" },
  2017: { key: "storm", name: "Storm" },
  2063: { key: "plasma", name: "Plasma" },
};

// ---- GitHub template library --------------------------------------------

const REPO = "DalShooth/EVE_PI_Templates";
const DIR = "PlanetaryInteractionTemplates";
const LIST_CACHE_KEY = "pi_template_list_v1";
const LIST_TTL_MS = 24 * 60 * 60 * 1000;

export interface TemplateListItem {
  name: string; // file name without extension
  category: "Factory" | "Miner" | "Other";
  variant?: string; // e.g. "00" (null-sec) or "LS" (low-sec)
  product: string;
  path: string;
  downloadUrl: string;
}

const parseFileName = (
  fileName: string,
  downloadUrl: string,
  path: string,
): TemplateListItem => {
  const base = fileName.replace(/\.json$/i, "");
  const parts = base.split(" - ");
  const category =
    parts[0] === "Factory"
      ? "Factory"
      : parts[0] === "Miner"
        ? "Miner"
        : "Other";
  let variant: string | undefined;
  let product = base;
  if (category === "Miner" && parts.length >= 3) {
    variant = parts[1]; // "00" | "LS"
    product = parts.slice(2).join(" - ");
  } else if (category === "Factory" && parts.length >= 2) {
    product = parts.slice(1).join(" - ");
  }
  return { name: base, category, variant, product, path, downloadUrl };
};

export const listTemplates = async (): Promise<TemplateListItem[]> => {
  if (typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem(LIST_CACHE_KEY);
      if (cached) {
        const { at, items } = JSON.parse(cached);
        if (Date.now() - at < LIST_TTL_MS && Array.isArray(items)) return items;
      }
    } catch {
      /* ignore */
    }
  }

  const res = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${DIR}`,
    { headers: { Accept: "application/vnd.github+json" } },
  );
  if (!res.ok) {
    throw new Error(
      res.status === 403
        ? "GitHub rate limit reached — try again later or paste a template below."
        : `Failed to list templates (${res.status})`,
    );
  }
  const data: Array<{
    name: string;
    path: string;
    type: string;
    download_url: string;
  }> = await res.json();
  const items = data
    .filter((f) => f.type === "file" && f.name.endsWith(".json"))
    .map((f) => parseFileName(f.name, f.download_url, f.path))
    .sort(
      (a, b) =>
        a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
    );

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(
        LIST_CACHE_KEY,
        JSON.stringify({ at: Date.now(), items }),
      );
    } catch {
      /* ignore */
    }
  }
  return items;
};

export const fetchTemplate = async (downloadUrl: string): Promise<PiTemplate> => {
  const res = await fetch(downloadUrl);
  if (!res.ok) throw new Error(`Failed to fetch template (${res.status})`);
  return parseTemplate(await res.text());
};

export const parseTemplate = (input: string | unknown): PiTemplate => {
  const obj = typeof input === "string" ? JSON.parse(input) : input;
  if (
    !obj ||
    typeof obj !== "object" ||
    !Array.isArray((obj as PiTemplate).P) ||
    typeof (obj as PiTemplate).Pln !== "number"
  ) {
    throw new Error("Not a valid PI template (missing Pln / P).");
  }
  const t = obj as PiTemplate;
  return {
    CmdCtrLv: t.CmdCtrLv ?? 0,
    Cmt: t.Cmt,
    Diam: t.Diam,
    Pln: t.Pln,
    P: t.P,
    L: t.L ?? [],
    R: t.R ?? [],
  };
};

// ---- Analysis ------------------------------------------------------------

export interface StructureCount {
  label: string;
  count: number;
}

export interface SchematicSummary {
  schematicId: number;
  name: string;
  count: number;
  outputTypeIds: number[];
  inputTypeIds: number[];
}

export interface CommodityRef {
  typeId: number;
  name: string;
}

export interface TemplateAnalysis {
  planet?: { id: number; key: string; name: string };
  ccLevel: number;
  diameter?: number;
  comment?: string;
  pinCount: number;
  extractorHeads: number;
  structures: StructureCount[];
  schematics: SchematicSummary[];
  finalOutputs: CommodityRef[];
  requiredInputs: CommodityRef[];
}

const typeName = (id: number): string => PI_TYPES_MAP[id]?.name ?? `#${id}`;

const classifyStructure = (typeId: number): string => {
  if (EXTRACTOR_TYPE_IDS.includes(typeId)) return "Extractor Control Unit";
  const info = PI_TYPES_MAP[typeId];
  if (!info) return `#${typeId}`;
  const { group_id, name } = info;
  if (group_id === 1028) {
    if (name.includes("High-Tech")) return "High-Tech Production Plant";
    if (name.includes("Advanced")) return "Advanced Industry Facility";
    return "Basic Industry Facility";
  }
  if (group_id === 1029) return "Storage Facility";
  if (group_id === 1030) return "Launchpad";
  if (group_id === 1027) return "Command Center";
  return name;
};

const schematicByOutput = (productTypeId: number) =>
  PI_SCHEMATICS.find((s) => s.outputs.some((o) => o.type_id === productTypeId));

export const analyzeTemplate = (t: PiTemplate): TemplateAnalysis => {
  // Structure counts + extractor heads
  const structureCounts = new Map<string, number>();
  let extractorHeads = 0;
  t.P.forEach((pin) => {
    const label = classifyStructure(pin.T);
    structureCounts.set(label, (structureCounts.get(label) ?? 0) + 1);
    if (EXTRACTOR_TYPE_IDS.includes(pin.T)) extractorHeads += pin.H ?? 0;
  });

  // Schematics: factory pins carry the produced product type_id in S
  const schematicCounts = new Map<number, SchematicSummary>();
  t.P.forEach((pin) => {
    if (pin.S == null) return;
    const schematic = schematicByOutput(pin.S);
    if (!schematic) return;
    const existing = schematicCounts.get(schematic.schematic_id);
    if (existing) {
      existing.count += 1;
    } else {
      schematicCounts.set(schematic.schematic_id, {
        schematicId: schematic.schematic_id,
        name: schematic.name,
        count: 1,
        outputTypeIds: schematic.outputs.map((o) => o.type_id),
        inputTypeIds: schematic.inputs.map((i) => i.type_id),
      });
    }
  });
  const schematics = Array.from(schematicCounts.values());

  const producedTypes = new Set(schematics.flatMap((s) => s.outputTypeIds));
  const consumedTypes = new Set(schematics.flatMap((s) => s.inputTypeIds));

  // Extracted P0 types (routed but not produced by a schematic here)
  const routedTypes = new Set(t.R.map((r) => r.T));

  const finalOutputs: CommodityRef[] = Array.from(producedTypes)
    .filter((id) => !consumedTypes.has(id))
    .map((id) => ({ typeId: id, name: typeName(id) }));

  const requiredInputs: CommodityRef[] = Array.from(consumedTypes)
    .filter((id) => !producedTypes.has(id) && !routedTypes.has(id))
    .map((id) => ({ typeId: id, name: typeName(id) }));

  return {
    planet: PLANET_TYPES[t.Pln]
      ? { id: t.Pln, ...PLANET_TYPES[t.Pln] }
      : undefined,
    ccLevel: t.CmdCtrLv,
    diameter: t.Diam,
    comment: t.Cmt,
    pinCount: t.P.length,
    extractorHeads,
    structures: Array.from(structureCounts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    schematics,
    finalOutputs,
    requiredInputs,
  };
};
