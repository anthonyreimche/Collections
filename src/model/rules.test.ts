// Predicate-compiler coverage: every field and op, malformed values never
// match (and never throw), unknown fields stay inert, all/any composition.
// Run: node --experimental-strip-types src/model/rules.test.ts

import assert from "node:assert";
import type { CatalogPhoto } from "../safelight";
import type { Rule, Match } from "./types.ts";
import {
  compileRule,
  compileRules,
  extensionOf,
  isRawExtension,
  parseDay,
  parseShutterSeconds,
} from "./rules.ts";

const NOW = new Date(2026, 7, 18, 12, 0, 0).getTime(); // local Aug 18 2026 noon
const day = (y: number, m: number, d: number, h = 0) => new Date(y, m - 1, d, h).getTime();

function photo(over: Partial<CatalogPhoto> = {}, exif: Partial<CatalogPhoto["exif"]> = {}): CatalogPhoto {
  return {
    id: "p1",
    filename: "IMG_0001.NEF",
    relPath: "2026/trip/IMG_0001.NEF",
    folder: "2026/trip",
    mimeType: "image/x-nikon-nef",
    rating: 3,
    colorLabel: "none",
    flag: "none",
    keywords: ["Heron", "Wildlife"],
    dateCreated: day(2026, 8, 15, 9),
    dateImported: day(2026, 8, 16, 20),
    width: 6000,
    height: 4000,
    exif: {
      cameraMake: "NIKON",
      cameraModel: "D5300",
      lens: "70-300mm f/4.5-6.3",
      iso: 800,
      aperture: 5.6,
      focalLength: 300,
      shutterSpeed: "1/250",
      gpsLatitude: 49.2,
      gpsLongitude: -123.1,
      ...exif,
    },
    ...over,
  };
}

function matches(rule: Rule, p: CatalogPhoto): boolean {
  const pred = compileRule(rule, NOW);
  assert.notEqual(pred, null, `rule should compile: ${JSON.stringify(rule)}`);
  return pred!(p);
}

// ── parsers ──────────────────────────────────────────────────────────────────

assert.equal(parseShutterSeconds("1/250"), 1 / 250);
assert.equal(parseShutterSeconds("1/250s"), 1 / 250);
assert.equal(parseShutterSeconds("0.5"), 0.5);
assert.equal(parseShutterSeconds("30"), 30);
assert.equal(parseShutterSeconds("30s"), 30);
assert.equal(parseShutterSeconds("2.5s"), 2.5);
assert.equal(parseShutterSeconds(""), null);
assert.equal(parseShutterSeconds("fast"), null);
assert.equal(parseShutterSeconds("1/0"), null);

assert.equal(parseDay("2026-08-18"), day(2026, 8, 18));
assert.equal(parseDay("2026-8-18"), null);
assert.equal(parseDay("2026-13-01"), null);
assert.equal(parseDay("2026-02-30"), null);
assert.equal(parseDay("yesterday"), null);

assert.equal(extensionOf("IMG_0001.NEF"), "nef");
assert.equal(extensionOf("photo.final.JPG"), "jpg");
assert.equal(extensionOf("noext"), "");
assert.ok(isRawExtension("nef"));
assert.ok(isRawExtension("cr3"));
assert.ok(!isRawExtension("jpg"));

// ── rating ───────────────────────────────────────────────────────────────────

assert.ok(matches({ field: "rating", op: "is", value: "3" }, photo()));
assert.ok(!matches({ field: "rating", op: "is", value: "4" }, photo()));
assert.ok(matches({ field: "rating", op: "atleast", value: "3" }, photo()));
assert.ok(!matches({ field: "rating", op: "atleast", value: "4" }, photo()));
assert.ok(matches({ field: "rating", op: "atmost", value: "3" }, photo()));
assert.ok(!matches({ field: "rating", op: "atmost", value: "2" }, photo()));
assert.ok(!matches({ field: "rating", op: "atleast", value: "many" }, photo()));

// ── flag / label ─────────────────────────────────────────────────────────────

assert.ok(matches({ field: "flag", op: "is", value: "none" }, photo()));
assert.ok(matches({ field: "flag", op: "is", value: "pick" }, photo({ flag: "pick" })));
assert.ok(matches({ field: "flag", op: "isnot", value: "reject" }, photo()));
assert.ok(!matches({ field: "flag", op: "isnot", value: "none" }, photo()));
assert.ok(matches({ field: "label", op: "is", value: "red" }, photo({ colorLabel: "red" })));
assert.ok(matches({ field: "label", op: "isnot", value: "red" }, photo()));

// ── keyword ──────────────────────────────────────────────────────────────────

assert.ok(matches({ field: "keyword", op: "contains", value: "her" }, photo()));
assert.ok(matches({ field: "keyword", op: "contains", value: "WILD" }, photo()));
assert.ok(!matches({ field: "keyword", op: "contains", value: "eagle" }, photo()));
assert.ok(matches({ field: "keyword", op: "ncontains", value: "eagle" }, photo()));
assert.ok(!matches({ field: "keyword", op: "ncontains", value: "heron" }, photo()));
assert.ok(matches({ field: "keyword", op: "is", value: "heron" }, photo()));
assert.ok(!matches({ field: "keyword", op: "is", value: "her" }, photo()));
assert.ok(matches({ field: "keyword", op: "ncontains", value: "x" }, photo({ keywords: [] })));

// ── filename ─────────────────────────────────────────────────────────────────

assert.ok(matches({ field: "filename", op: "contains", value: "0001" }, photo()));
assert.ok(matches({ field: "filename", op: "starts", value: "img_" }, photo()));
assert.ok(matches({ field: "filename", op: "ends", value: ".nef" }, photo()));
assert.ok(matches({ field: "filename", op: "ncontains", value: "DSC" }, photo()));
assert.ok(!matches({ field: "filename", op: "contains", value: "" }, photo()));

// ── folder ───────────────────────────────────────────────────────────────────

assert.ok(matches({ field: "folder", op: "is", value: "2026/trip" }, photo()));
assert.ok(matches({ field: "folder", op: "is", value: "2026/Trip" }, photo()));
assert.ok(!matches({ field: "folder", op: "is", value: "2026" }, photo()));
assert.ok(matches({ field: "folder", op: "is", value: "" }, photo({ folder: "" })));
assert.ok(matches({ field: "folder", op: "under", value: "2026" }, photo()));
assert.ok(matches({ field: "folder", op: "under", value: "2026/trip" }, photo()));
assert.ok(matches({ field: "folder", op: "under", value: "" }, photo()));
assert.ok(!matches({ field: "folder", op: "under", value: "2027" }, photo()));
assert.ok(!matches({ field: "folder", op: "under", value: "2026/tri" }, photo()));
assert.ok(matches({ field: "folder", op: "notunder", value: "2027" }, photo()));
assert.ok(!matches({ field: "folder", op: "notunder", value: "" }, photo()));

// ── file type ────────────────────────────────────────────────────────────────

assert.ok(matches({ field: "filetype", op: "is", value: "nef" }, photo()));
assert.ok(matches({ field: "filetype", op: "is", value: "NEF" }, photo()));
assert.ok(matches({ field: "filetype", op: "is", value: "raw" }, photo()));
assert.ok(!matches({ field: "filetype", op: "is", value: "jpg" }, photo()));
assert.ok(matches({ field: "filetype", op: "is", value: "jpg" }, photo({ filename: "a.JPG" })));
assert.ok(!matches({ field: "filetype", op: "is", value: "raw" }, photo({ filename: "a.jpg" })));
assert.ok(matches({ field: "filetype", op: "isnot", value: "jpg" }, photo()));
assert.ok(!matches({ field: "filetype", op: "isnot", value: "raw" }, photo()));

// ── dates (captured / imported) ──────────────────────────────────────────────

assert.ok(matches({ field: "captured", op: "lastdays", value: "7" }, photo()));
assert.ok(!matches({ field: "captured", op: "lastdays", value: "2" }, photo()));
assert.ok(matches({ field: "captured", op: "notlastdays", value: "2" }, photo()));
assert.ok(!matches({ field: "captured", op: "notlastdays", value: "7" }, photo()));
assert.ok(matches({ field: "captured", op: "before", value: "2026-08-16" }, photo()));
assert.ok(!matches({ field: "captured", op: "before", value: "2026-08-15" }, photo()));
assert.ok(matches({ field: "captured", op: "after", value: "2026-08-14" }, photo()));
assert.ok(!matches({ field: "captured", op: "after", value: "2026-08-15" }, photo()));
assert.ok(matches({ field: "captured", op: "between", value: "2026-08-15", value2: "2026-08-15" }, photo()));
assert.ok(matches({ field: "captured", op: "between", value: "2026-08-01", value2: "2026-08-31" }, photo()));
assert.ok(!matches({ field: "captured", op: "between", value: "2026-07-01", value2: "2026-07-31" }, photo()));
assert.ok(matches({ field: "imported", op: "lastdays", value: "3" }, photo()));
assert.ok(!matches({ field: "captured", op: "before", value: "someday" }, photo()));
assert.ok(!matches({ field: "captured", op: "lastdays", value: "soon" }, photo()));

// ── camera / lens ────────────────────────────────────────────────────────────

assert.ok(matches({ field: "camera", op: "contains", value: "d5300" }, photo()));
assert.ok(matches({ field: "camera", op: "contains", value: "nikon" }, photo()));
assert.ok(matches({ field: "camera", op: "is", value: "nikon d5300" }, photo()));
assert.ok(!matches({ field: "camera", op: "is", value: "d5300" }, photo()));
assert.ok(matches({ field: "camera", op: "isnot", value: "canon r5" }, photo()));
assert.ok(matches({ field: "camera", op: "isnot", value: "x" }, photo({}, { cameraMake: undefined, cameraModel: undefined })));
assert.ok(!matches({ field: "camera", op: "contains", value: "nikon" }, photo({}, { cameraMake: undefined, cameraModel: undefined })));
assert.ok(matches({ field: "lens", op: "contains", value: "70-300" }, photo()));
assert.ok(matches({ field: "lens", op: "is", value: "70-300mm f/4.5-6.3" }, photo()));
assert.ok(!matches({ field: "lens", op: "contains", value: "70-300" }, photo({}, { lens: undefined })));

// ── numeric EXIF ─────────────────────────────────────────────────────────────

assert.ok(matches({ field: "iso", op: "is", value: "800" }, photo()));
assert.ok(matches({ field: "iso", op: "atleast", value: "800" }, photo()));
assert.ok(matches({ field: "iso", op: "between", value: "100", value2: "800" }, photo()));
assert.ok(!matches({ field: "iso", op: "between", value: "100", value2: "400" }, photo()));
assert.ok(!matches({ field: "iso", op: "between", value: "800", value2: "100" }, photo()));
assert.ok(!matches({ field: "iso", op: "atleast", value: "100" }, photo({}, { iso: undefined })));
assert.ok(matches({ field: "aperture", op: "is", value: "5.6" }, photo()));
assert.ok(matches({ field: "aperture", op: "is", value: "5.65" }, photo()));
assert.ok(!matches({ field: "aperture", op: "is", value: "5.7" }, photo()));
assert.ok(matches({ field: "focal", op: "atleast", value: "200" }, photo()));
assert.ok(matches({ field: "shutter", op: "atleast", value: "1/500" }, photo()));
assert.ok(!matches({ field: "shutter", op: "atleast", value: "1/125" }, photo()));
assert.ok(matches({ field: "shutter", op: "atmost", value: "1/125" }, photo()));
assert.ok(!matches({ field: "shutter", op: "atmost", value: "junk" }, photo()));
assert.ok(!matches({ field: "shutter", op: "atmost", value: "1" }, photo({}, { shutterSpeed: undefined })));

// ── orientation / gps / virtual copy ─────────────────────────────────────────

assert.ok(matches({ field: "orientation", op: "is", value: "landscape" }, photo()));
assert.ok(matches({ field: "orientation", op: "is", value: "portrait" }, photo({ width: 4000, height: 6000 })));
assert.ok(matches({ field: "orientation", op: "is", value: "square" }, photo({ width: 500, height: 500 })));
assert.ok(!matches({ field: "orientation", op: "is", value: "portrait" }, photo()));
assert.ok(matches({ field: "gps", op: "has" }, photo()));
assert.ok(!matches({ field: "gps", op: "has" }, photo({}, { gpsLatitude: undefined, gpsLongitude: undefined })));
assert.ok(matches({ field: "gps", op: "hasnot" }, photo({}, { gpsLatitude: undefined, gpsLongitude: undefined })));
assert.ok(matches({ field: "virtualcopy", op: "is" }, photo({ copyOf: "master1" })));
assert.ok(matches({ field: "virtualcopy", op: "isnot" }, photo()));
assert.ok(!matches({ field: "virtualcopy", op: "is" }, photo()));

// ── unknown fields / ops are inert (null), not failures ──────────────────────

assert.equal(compileRule({ field: "hologram", op: "is", value: "x" }, NOW), null);
assert.equal(compileRule({ field: "rating", op: "sparkles", value: "3" }, NOW), null);

// ── composition ──────────────────────────────────────────────────────────────

const RULES: Rule[] = [
  { field: "rating", op: "atleast", value: "3" },
  { field: "keyword", op: "contains", value: "heron" },
];
const all = compileRules(RULES, "all", NOW);
const any = compileRules(RULES, "any", NOW);
assert.ok(all(photo()));
assert.ok(!all(photo({ rating: 1 })));
assert.ok(any(photo({ rating: 1 })));
assert.ok(!any(photo({ rating: 1, keywords: [] })));

// Zero effective rules (empty, or all-unknown) matches everything.
assert.ok(compileRules([], "all", NOW)(photo()));
assert.ok(compileRules([{ field: "hologram", op: "is" }], "any", NOW)(photo({ rating: 0, keywords: [] })));

console.log("OK — rules.test.ts");
