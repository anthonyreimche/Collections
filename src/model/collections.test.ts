// Pure list-op coverage: naming, membership, relevance, counts, sorting.
// Run: node --experimental-strip-types src/model/collections.test.ts

import assert from "node:assert";
import type { AnyCollection, Collection, SmartCollection } from "./types.ts";
import {
  addMembers,
  createCollection,
  duplicateCollection,
  isRelevant,
  removeCollection,
  removeMembers,
  renameCollection,
  resolveCount,
  sortedCollections,
  uniqueName,
} from "./collections.ts";

const regular = (id: string, name: string, memberIds: string[] = []): Collection => ({
  id, name, kind: "collection", memberIds,
});
const smart = (id: string, name: string): SmartCollection => ({
  id, name, kind: "smart", match: "all", rules: [{ field: "rating", op: "atleast", value: "4" }],
});

// ── uniqueName ───────────────────────────────────────────────────────────────

{
  const list: AnyCollection[] = [regular("a", "Trip"), regular("b", "trip 2")];
  assert.equal(uniqueName(list, "Keepers"), "Keepers");
  assert.equal(uniqueName(list, "Trip"), "Trip 3");
  assert.equal(uniqueName(list, "TRIP"), "TRIP 3");
  assert.equal(uniqueName([], "Quick Collection"), "Quick Collection");
}

// ── createCollection ─────────────────────────────────────────────────────────

{
  const list: AnyCollection[] = [regular("a", "New Collection")];
  const c = createCollection(list, "collection", "New Collection", "id2");
  assert.deepEqual(c, { id: "id2", name: "New Collection 2", kind: "collection", memberIds: [] });
  assert.equal(list.length, 1, "createCollection does not insert");
  const s = createCollection(list, "smart", "New Smart Collection", "id3");
  assert.deepEqual(s, { id: "id3", name: "New Smart Collection", kind: "smart", match: "all", rules: [] });
}

// ── renameCollection ─────────────────────────────────────────────────────────

{
  const list: AnyCollection[] = [regular("a", "Trip"), regular("b", "Keepers")];
  assert.deepEqual(renameCollection(list, "a", "Best"), { ok: true });
  assert.equal(list[0].name, "Best");
  assert.equal(renameCollection(list, "a", "keepers").ok, false);
  assert.equal(list[0].name, "Best", "collision leaves the name unchanged");
  assert.deepEqual(renameCollection(list, "a", "BEST"), { ok: true }, "case change of itself is fine");
  assert.equal(list[0].name, "BEST");
  assert.equal(renameCollection(list, "a", "   ").ok, false);
  assert.equal(renameCollection(list, "missing", "X").ok, false);
  assert.deepEqual(renameCollection(list, "a", "  Padded  "), { ok: true });
  assert.equal(list[0].name, "Padded", "names are trimmed");
}

// ── duplicateCollection ──────────────────────────────────────────────────────

{
  const list: AnyCollection[] = [regular("a", "Trip", ["p1", "p2"]), smart("s", "Keepers")];
  const copy = duplicateCollection(list, "a", "a2") as Collection;
  assert.deepEqual(copy, { id: "a2", name: "Trip 2", kind: "collection", memberIds: ["p1", "p2"] });
  assert.equal(list.length, 3, "duplicate inserts the copy");
  copy.memberIds.push("p3");
  assert.deepEqual((list[0] as Collection).memberIds, ["p1", "p2"], "members don't alias");

  const sCopy = duplicateCollection(list, "s", "s2") as SmartCollection;
  assert.equal(sCopy.name, "Keepers 2");
  sCopy.rules.push({ field: "gps", op: "has" });
  assert.equal((list[1] as SmartCollection).rules.length, 1, "rules don't alias");

  assert.equal(duplicateCollection(list, "missing", "x"), null);
}

// ── removeCollection ─────────────────────────────────────────────────────────

{
  const list: AnyCollection[] = [regular("a", "Trip"), regular("b", "Keepers")];
  assert.equal(removeCollection(list, "a"), true);
  assert.deepEqual(list.map((c) => c.id), ["b"]);
  assert.equal(removeCollection(list, "a"), false);
}

// ── membership ───────────────────────────────────────────────────────────────

{
  const c = regular("a", "Trip", ["p1"]);
  assert.equal(addMembers(c, ["p1", "p2", "p2", "p3"]), 2);
  assert.deepEqual(c.memberIds, ["p1", "p2", "p3"]);
  assert.equal(addMembers(c, ["p1"]), 0);
  assert.equal(removeMembers(c, ["p2", "px"]), 1);
  assert.deepEqual(c.memberIds, ["p1", "p3"]);
  assert.equal(removeMembers(c, []), 0);
}

// ── relevance ────────────────────────────────────────────────────────────────

{
  const live = new Set(["p1", "p2"]);
  assert.ok(isRelevant(smart("s", "Keepers"), live), "smart is always relevant");
  assert.ok(isRelevant(regular("a", "Empty"), live), "empty regular is relevant");
  assert.ok(isRelevant(regular("b", "Here", ["px", "p2"]), live));
  assert.ok(!isRelevant(regular("c", "Elsewhere", ["px", "py"]), live));
}

// ── resolveCount ─────────────────────────────────────────────────────────────

{
  const live = new Set(["p1", "p2"]);
  assert.deepEqual(resolveCount(regular("a", "T", ["p1", "px"]), live, () => 99), { shown: 1, elsewhere: 1 });
  assert.deepEqual(resolveCount(regular("b", "E"), live, () => 99), { shown: 0, elsewhere: 0 });
  assert.deepEqual(resolveCount(smart("s", "K"), live, (c) => c.rules.length * 7), { shown: 7, elsewhere: 0 });
}

// ── sortedCollections ────────────────────────────────────────────────────────

{
  const list: AnyCollection[] = [regular("1", "zebra"), smart("2", "Alpha"), regular("3", "beta"), regular("4", "Beta")];
  assert.deepEqual(sortedCollections(list).map((c) => c.id), ["2", "3", "4", "1"]);
  assert.deepEqual(list.map((c) => c.id), ["1", "2", "3", "4"], "input order untouched");
}

console.log("OK — collections.test.ts");
