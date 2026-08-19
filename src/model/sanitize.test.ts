// Persisted-shape validation: a corrupt entry is dropped field-by-field, never
// the whole file. Run: node --experimental-strip-types src/model/sanitize.test.ts

import assert from "node:assert";
import { EMPTY_FILE, sanitizeFile } from "./types.ts";

const regular = { id: "c1", name: "Best of 2026", kind: "collection", memberIds: ["p1", "p2"] };
const smart = {
  id: "s1",
  name: "Keepers",
  kind: "smart",
  match: "all",
  rules: [{ field: "rating", op: "atleast", value: "4" }],
};

// Valid file round-trips untouched.
{
  const file = sanitizeFile({ version: 1, collections: [regular, smart] });
  assert.deepEqual(file, { version: 1, collections: [regular, smart] });
}

// Junk entries are dropped individually; good ones survive.
{
  const file = sanitizeFile({
    version: 1,
    collections: [
      null,
      42,
      "nope",
      { id: "x" },                                    // no kind
      { id: "y", name: "Ghost", kind: "album" },      // unknown kind
      { name: "No id", kind: "collection", memberIds: [] },
      { id: "z", name: "", kind: "collection", memberIds: [] },   // empty name
      { id: "w", name: "  ", kind: "collection", memberIds: [] }, // blank name
      regular,
    ],
  });
  assert.deepEqual(file.collections, [regular]);
}

// Junk rules drop from a smart collection without dropping the collection;
// unknown FIELDS are kept (they compile inert — forward compatibility).
{
  const file = sanitizeFile({
    version: 1,
    collections: [
      {
        id: "s2",
        name: "Mixed",
        kind: "smart",
        match: "any",
        rules: [
          { field: "rating", op: "is", value: "5" },
          { field: "hologram", op: "is", value: "yes" },  // unknown field: kept
          { field: 7, op: "is" },                          // non-string field: dropped
          "garbage",
          null,
          { op: "is" },                                    // missing field: dropped
          { field: "iso", op: "between", value: "100", value2: "800" },
        ],
      },
    ],
  });
  assert.equal(file.collections.length, 1);
  const rules = (file.collections[0] as { rules: unknown[] }).rules;
  assert.deepEqual(rules, [
    { field: "rating", op: "is", value: "5" },
    { field: "hologram", op: "is", value: "yes" },
    { field: "iso", op: "between", value: "100", value2: "800" },
  ]);
}

// A smart collection with a bogus match falls back to "all"; missing rules
// array becomes empty.
{
  const file = sanitizeFile({
    version: 1,
    collections: [{ id: "s3", name: "Odd", kind: "smart", match: "some" }],
  });
  assert.deepEqual(file.collections, [{ id: "s3", name: "Odd", kind: "smart", match: "all", rules: [] }]);
}

// memberIds: non-strings filtered, duplicates deduped, order preserved.
{
  const file = sanitizeFile({
    version: 1,
    collections: [
      { id: "c2", name: "Trip", kind: "collection", memberIds: ["a", 1, "b", null, "a", "c"] },
    ],
  });
  assert.deepEqual(
    (file.collections[0] as { memberIds: string[] }).memberIds,
    ["a", "b", "c"],
  );
}

// Duplicate collection ids: first wins.
{
  const file = sanitizeFile({
    version: 1,
    collections: [regular, { ...regular, name: "Impostor" }],
  });
  assert.equal(file.collections.length, 1);
  assert.equal(file.collections[0].name, "Best of 2026");
}

// Unrecognizable input → a fresh empty file (never a shared instance).
for (const bad of [null, undefined, "x", 9, [], { version: 2, collections: [] }, { collections: [regular] }, { version: 1 }]) {
  const file = sanitizeFile(bad);
  assert.deepEqual(file, EMPTY_FILE);
  assert.notEqual(file, EMPTY_FILE);
  assert.notEqual(file.collections, EMPTY_FILE.collections);
}

console.log("OK — sanitize.test.ts");
