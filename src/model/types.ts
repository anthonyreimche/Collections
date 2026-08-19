// Collection shapes, the rule-field vocabulary, and the persisted-file
// sanitizer. FIELD_DEFS is the single source of truth for both the smart-rule
// editor (which controls to render) and the predicate compiler (what an op
// means) — a field/op pair absent here compiles inert instead of breaking the
// collection, so files written by newer versions still load.

export type Match = "all" | "any";
export type CollectionKind = "collection" | "smart";

export interface Rule {
  field: string;
  op: string;
  value?: string;
  value2?: string;
}

export interface Collection {
  id: string;
  name: string;
  kind: "collection";
  memberIds: string[];
}

export interface SmartCollection {
  id: string;
  name: string;
  kind: "smart";
  match: Match;
  rules: Rule[];
}

export type AnyCollection = Collection | SmartCollection;

export interface CollectionsFile {
  version: 1;
  collections: AnyCollection[];
}

export const EMPTY_FILE: CollectionsFile = { version: 1, collections: [] };

// ── rule-field vocabulary ────────────────────────────────────────────────────

export type ValueKind = "number" | "text" | "enum" | "date" | "none";

export interface OpDef {
  op: string;
  label: string;
  /** Value slots this op needs (0 = none, 2 = a range). */
  values: 0 | 1 | 2;
}

export interface FieldDef {
  field: string;
  label: string;
  kind: ValueKind;
  ops: OpDef[];
  /** Choices for `kind: "enum"` value slots. */
  options?: { value: string; label: string }[];
}

const is = (values: 0 | 1 | 2 = 1): OpDef => ({ op: "is", label: "is", values });
const isnot = (values: 0 | 1 | 2 = 1): OpDef => ({ op: "isnot", label: "is not", values });
const contains: OpDef = { op: "contains", label: "contains", values: 1 };
const ncontains: OpDef = { op: "ncontains", label: "doesn't contain", values: 1 };
const numeric: OpDef[] = [
  is(),
  { op: "atleast", label: "is at least", values: 1 },
  { op: "atmost", label: "is at most", values: 1 },
  { op: "between", label: "is between", values: 2 },
];
const dated: OpDef[] = [
  { op: "lastdays", label: "is in the last (days)", values: 1 },
  { op: "notlastdays", label: "is not in the last (days)", values: 1 },
  { op: "before", label: "is before", values: 1 },
  { op: "after", label: "is after", values: 1 },
  { op: "between", label: "is between", values: 2 },
];

export const FIELD_DEFS: FieldDef[] = [
  {
    field: "rating", label: "Rating", kind: "number",
    ops: [is(), { op: "atleast", label: "is at least", values: 1 }, { op: "atmost", label: "is at most", values: 1 }],
  },
  {
    field: "flag", label: "Flag", kind: "enum", ops: [is(), isnot()],
    options: [
      { value: "pick", label: "picked" },
      { value: "none", label: "unflagged" },
      { value: "reject", label: "rejected" },
    ],
  },
  {
    field: "label", label: "Color label", kind: "enum", ops: [is(), isnot()],
    options: ["none", "red", "yellow", "green", "blue", "purple"].map((value) => ({ value, label: value })),
  },
  { field: "keyword", label: "Keyword", kind: "text", ops: [contains, ncontains, is()] },
  {
    field: "filename", label: "Filename", kind: "text",
    ops: [contains, ncontains, { op: "starts", label: "starts with", values: 1 }, { op: "ends", label: "ends with", values: 1 }],
  },
  {
    field: "folder", label: "Folder", kind: "text",
    ops: [is(), { op: "under", label: "is under", values: 1 }, { op: "notunder", label: "is not under", values: 1 }],
  },
  { field: "filetype", label: "File type", kind: "text", ops: [is(), isnot()] },
  { field: "captured", label: "Capture date", kind: "date", ops: dated },
  { field: "imported", label: "Import date", kind: "date", ops: dated },
  { field: "camera", label: "Camera", kind: "text", ops: [contains, is(), isnot()] },
  { field: "lens", label: "Lens", kind: "text", ops: [contains, is()] },
  { field: "iso", label: "ISO", kind: "number", ops: numeric },
  { field: "focal", label: "Focal length", kind: "number", ops: numeric },
  { field: "aperture", label: "Aperture", kind: "number", ops: numeric },
  {
    field: "shutter", label: "Shutter speed", kind: "number",
    ops: [
      { op: "atleast", label: "is at least (s)", values: 1 },
      { op: "atmost", label: "is at most (s)", values: 1 },
    ],
  },
  {
    field: "orientation", label: "Orientation", kind: "enum", ops: [is()],
    options: [
      { value: "landscape", label: "landscape" },
      { value: "portrait", label: "portrait" },
      { value: "square", label: "square" },
    ],
  },
  {
    field: "gps", label: "GPS location", kind: "none",
    ops: [{ op: "has", label: "is present", values: 0 }, { op: "hasnot", label: "is missing", values: 0 }],
  },
  {
    field: "virtualcopy", label: "Virtual copy", kind: "none",
    ops: [is(0), isnot(0)],
  },
];

export function fieldDef(field: string): FieldDef | undefined {
  return FIELD_DEFS.find((d) => d.field === field);
}

// ── persisted-file sanitizer ─────────────────────────────────────────────────

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function sanitizeRule(raw: unknown): Rule | null {
  if (!isRecord(raw)) return null;
  const { field, op, value, value2 } = raw;
  if (typeof field !== "string" || typeof op !== "string") return null;
  return {
    field,
    op,
    ...(typeof value === "string" ? { value } : {}),
    ...(typeof value2 === "string" ? { value2 } : {}),
  };
}

function sanitizeCollection(raw: unknown): AnyCollection | null {
  if (!isRecord(raw)) return null;
  const { id, name, kind } = raw;
  if (typeof id !== "string" || id === "") return null;
  if (typeof name !== "string" || name.trim() === "") return null;

  if (kind === "collection") {
    const memberIds: string[] = [];
    const seen = new Set<string>();
    if (Array.isArray(raw.memberIds)) {
      for (const m of raw.memberIds) {
        if (typeof m === "string" && !seen.has(m)) {
          seen.add(m);
          memberIds.push(m);
        }
      }
    }
    return { id, name, kind, memberIds };
  }

  if (kind === "smart") {
    const match: Match = raw.match === "any" ? "any" : "all";
    const rules = Array.isArray(raw.rules)
      ? raw.rules.map(sanitizeRule).filter((r): r is Rule => r !== null)
      : [];
    return { id, name, kind, match, rules };
  }

  return null;
}

/** Validate a persisted CollectionsFile defensively: recognizable entries
 *  survive, garbage drops entry-by-entry, anything unrecognizable at the top
 *  level yields a fresh empty file. */
export function sanitizeFile(raw: unknown): CollectionsFile {
  if (!isRecord(raw) || raw.version !== 1 || !Array.isArray(raw.collections)) {
    return { version: 1, collections: [] };
  }
  const collections: AnyCollection[] = [];
  const ids = new Set<string>();
  for (const entry of raw.collections) {
    const c = sanitizeCollection(entry);
    if (c && !ids.has(c.id)) {
      ids.add(c.id);
      collections.push(c);
    }
  }
  return { version: 1, collections };
}
