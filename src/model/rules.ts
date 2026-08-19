// Smart-collection predicate compiler. Pure and synchronous — rules compile
// once per change into a closure evaluated over the loaded photos array.
// Contract: an unknown field/op compiles to null (inert — forward
// compatibility with files from newer versions); a known op whose value is
// malformed or missing compiles to never-match, and never throws.

import type { CatalogPhoto } from "../safelight";
import type { Match, Rule } from "./types.ts";

export type PhotoPredicate = (p: CatalogPhoto) => boolean;

/** Compile a rule list. Zero effective rules matches everything (an inert
 *  collection lists all photos rather than none). */
export function compileRules(rules: Rule[], match: Match, now: number): PhotoPredicate {
  const clauses = rules
    .map((r) => compileRule(r, now))
    .filter((c): c is PhotoPredicate => c !== null);
  if (clauses.length === 0) return () => true;
  return match === "all"
    ? (p) => clauses.every((c) => c(p))
    : (p) => clauses.some((c) => c(p));
}

export function compileRule(rule: Rule, now: number): PhotoPredicate | null {
  const value = rule.value ?? "";
  switch (rule.field) {
    case "rating":
      return numberRule(rule, (p) => p.rating);
    case "flag":
      return enumRule(rule.op, value, (p) => p.flag);
    case "label":
      return enumRule(rule.op, value, (p) => p.colorLabel);
    case "keyword":
      return keywordRule(rule.op, value);
    case "filename":
      return textRule(rule.op, value, (p) => p.filename);
    case "folder":
      return folderRule(rule.op, value);
    case "filetype":
      return filetypeRule(rule.op, value);
    case "captured":
      return dateRule(rule, now, (p) => p.dateCreated);
    case "imported":
      return dateRule(rule, now, (p) => p.dateImported);
    case "camera":
      return textRule(rule.op, value, cameraText);
    case "lens":
      return textRule(rule.op, value, (p) => p.exif.lens);
    case "iso":
      return numberRule(rule, (p) => p.exif.iso);
    case "focal":
      return numberRule(rule, (p) => p.exif.focalLength);
    case "aperture":
      return numberRule(rule, (p) => p.exif.aperture);
    case "shutter":
      return shutterRule(rule.op, value);
    case "orientation":
      return orientationRule(rule.op, value);
    case "gps":
      return gpsRule(rule.op);
    case "virtualcopy":
      return copyRule(rule.op);
    default:
      return null;
  }
}

// ── parsers ──────────────────────────────────────────────────────────────────

/** "1/250", "0.5", "30", each with an optional trailing "s" → seconds. */
export function parseShutterSeconds(s: string): number | null {
  const m = s.trim().match(/^(\d+(?:\.\d+)?)(?:\/(\d+(?:\.\d+)?))?s?$/);
  if (!m) return null;
  const num = Number(m[1]);
  if (m[2] === undefined) return num;
  const den = Number(m[2]);
  return den > 0 ? num / den : null;
}

/** Strict local "YYYY-MM-DD" → ms at that day's 00:00, or null. */
export function parseDay(s: string): number | null {
  const m = s.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  // Date rolls invalid components over (Feb 30 → Mar 2) — reject those.
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return date.getTime();
}

export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot > 0 ? filename.slice(dot + 1).toLowerCase() : "";
}

const RAW_EXTENSIONS = new Set([
  "nef", "nrw", "cr2", "cr3", "crw", "arw", "srf", "sr2", "raf", "orf",
  "rw2", "dng", "pef", "srw", "x3f", "kdc", "dcr", "3fr", "fff", "iiq",
  "erf", "mrw", "mef", "raw", "rwl",
]);

export function isRawExtension(ext: string): boolean {
  return RAW_EXTENSIONS.has(ext.toLowerCase());
}

// ── per-kind compilers ───────────────────────────────────────────────────────

// The boundary is inclusive; the 1e-9 slack absorbs float representation
// error (5.65 - 5.6 is a hair over 0.05 in doubles).
const NUM_EPSILON = 0.05 + 1e-9;
const DAY_MS = 86_400_000;
const never: PhotoPredicate = () => false;

function numberRule(rule: Rule, get: (p: CatalogPhoto) => number | undefined): PhotoPredicate | null {
  const v = Number(rule.value);
  const test = (cmp: (n: number) => boolean): PhotoPredicate =>
    Number.isNaN(v)
      ? never
      : (p) => {
          const n = get(p);
          return n !== undefined && cmp(n);
        };
  switch (rule.op) {
    case "is":
      return test((n) => Math.abs(n - v) <= NUM_EPSILON);
    case "atleast":
      return test((n) => n >= v);
    case "atmost":
      return test((n) => n <= v);
    case "between": {
      const hi = Number(rule.value2);
      if (Number.isNaN(v) || Number.isNaN(hi) || v > hi) return never;
      return (p) => {
        const n = get(p);
        return n !== undefined && n >= v && n <= hi;
      };
    }
    default:
      return null;
  }
}

function enumRule(op: string, value: string, get: (p: CatalogPhoto) => string): PhotoPredicate | null {
  const v = value.toLowerCase();
  switch (op) {
    case "is":
      return v === "" ? never : (p) => get(p) === v;
    case "isnot":
      return v === "" ? never : (p) => get(p) !== v;
    default:
      return null;
  }
}

/** Text ops over an optional field. Negated ops match a photo lacking the
 *  field entirely ("lens doesn't contain X" is true of a photo with no lens);
 *  an empty rule value is degenerate and never matches either way. */
function textRule(
  op: string,
  value: string,
  get: (p: CatalogPhoto) => string | undefined,
): PhotoPredicate | null {
  const v = value.toLowerCase();
  const has = (p: CatalogPhoto, test: (s: string) => boolean): boolean => {
    const s = get(p);
    return s !== undefined && test(s.toLowerCase());
  };
  if (v === "") {
    return ["contains", "ncontains", "is", "isnot", "starts", "ends"].includes(op) ? never : null;
  }
  switch (op) {
    case "contains":
      return (p) => has(p, (s) => s.includes(v));
    case "ncontains":
      return (p) => !has(p, (s) => s.includes(v));
    case "is":
      return (p) => has(p, (s) => s === v);
    case "isnot":
      return (p) => !has(p, (s) => s === v);
    case "starts":
      return (p) => has(p, (s) => s.startsWith(v));
    case "ends":
      return (p) => has(p, (s) => s.endsWith(v));
    default:
      return null;
  }
}

function keywordRule(op: string, value: string): PhotoPredicate | null {
  const v = value.toLowerCase();
  if (v === "") return ["contains", "ncontains", "is"].includes(op) ? never : null;
  switch (op) {
    case "contains":
      return (p) => p.keywords.some((k) => k.toLowerCase().includes(v));
    case "ncontains":
      return (p) => !p.keywords.some((k) => k.toLowerCase().includes(v));
    case "is":
      return (p) => p.keywords.some((k) => k.toLowerCase() === v);
    default:
      return null;
  }
}

/** Folder paths compare case-insensitively; "" is the project root, and
 *  everything is under it. */
function folderRule(op: string, value: string): PhotoPredicate | null {
  const v = value.toLowerCase().replace(/[\\/]+$/, "");
  switch (op) {
    case "is":
      return (p) => p.folder.toLowerCase() === v;
    case "under":
      return v === ""
        ? () => true
        : (p) => {
            const f = p.folder.toLowerCase();
            return f === v || f.startsWith(v + "/");
          };
    case "notunder": {
      const under = folderRule("under", value)!;
      return (p) => !under(p);
    }
    default:
      return null;
  }
}

function filetypeRule(op: string, value: string): PhotoPredicate | null {
  const v = value.toLowerCase().replace(/^\./, "");
  if (v === "") return op === "is" || op === "isnot" ? never : null;
  const hit: PhotoPredicate =
    v === "raw"
      ? (p) => isRawExtension(extensionOf(p.filename))
      : (p) => extensionOf(p.filename) === v;
  switch (op) {
    case "is":
      return hit;
    case "isnot":
      return (p) => !hit(p);
    default:
      return null;
  }
}

function dateRule(rule: Rule, now: number, get: (p: CatalogPhoto) => number): PhotoPredicate | null {
  const value = rule.value ?? "";
  switch (rule.op) {
    case "lastdays":
    case "notlastdays": {
      const days = Number(value);
      if (!Number.isFinite(days) || value.trim() === "") return never;
      const cutoff = now - days * DAY_MS;
      return rule.op === "lastdays" ? (p) => get(p) >= cutoff : (p) => get(p) < cutoff;
    }
    case "before": {
      const day = parseDay(value);
      return day === null ? never : (p) => get(p) < day;
    }
    case "after": {
      const day = parseDay(value);
      return day === null ? never : (p) => get(p) >= day + DAY_MS;
    }
    case "between": {
      const lo = parseDay(value);
      const hi = parseDay(rule.value2 ?? "");
      if (lo === null || hi === null || lo > hi) return never;
      return (p) => {
        const t = get(p);
        return t >= lo && t < hi + DAY_MS;
      };
    }
    default:
      return null;
  }
}

function cameraText(p: CatalogPhoto): string | undefined {
  const s = [p.exif.cameraMake, p.exif.cameraModel].filter(Boolean).join(" ");
  return s === "" ? undefined : s;
}

function shutterRule(op: string, value: string): PhotoPredicate | null {
  const v = parseShutterSeconds(value);
  const test = (cmp: (s: number) => boolean): PhotoPredicate =>
    v === null
      ? never
      : (p) => {
          const s = p.exif.shutterSpeed !== undefined ? parseShutterSeconds(p.exif.shutterSpeed) : null;
          return s !== null && cmp(s);
        };
  switch (op) {
    case "atleast":
      return test((s) => s >= v!);
    case "atmost":
      return test((s) => s <= v!);
    default:
      return null;
  }
}

function orientationRule(op: string, value: string): PhotoPredicate | null {
  if (op !== "is") return null;
  switch (value) {
    case "landscape":
      return (p) => p.width > p.height;
    case "portrait":
      return (p) => p.width < p.height;
    case "square":
      return (p) => p.width === p.height;
    default:
      return never;
  }
}

function gpsRule(op: string): PhotoPredicate | null {
  const has: PhotoPredicate = (p) =>
    p.exif.gpsLatitude !== undefined && p.exif.gpsLongitude !== undefined;
  switch (op) {
    case "has":
      return has;
    case "hasnot":
      return (p) => !has(p);
    default:
      return null;
  }
}

function copyRule(op: string): PhotoPredicate | null {
  switch (op) {
    case "is":
      return (p) => p.copyOf !== undefined;
    case "isnot":
      return (p) => p.copyOf === undefined;
    default:
      return null;
  }
}
