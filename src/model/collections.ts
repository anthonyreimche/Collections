// Pure collection-list operations. Names are unique case-insensitively (the
// flat panel has no other disambiguator); mutating ops work in place on the
// structures the store owns — the store bumps its revision and persists.

import type { AnyCollection, Collection, CollectionKind, SmartCollection } from "./types.ts";

const nameKey = (name: string) => name.trim().toLowerCase();

/** "Base", else "Base 2", "Base 3", … until free (case-insensitive). */
export function uniqueName(list: AnyCollection[], base: string): string {
  const taken = new Set(list.map((c) => nameKey(c.name)));
  if (!taken.has(nameKey(base))) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base} ${n}`;
    if (!taken.has(nameKey(candidate))) return candidate;
  }
}

/** Build a new, uniquely named collection. The caller inserts it. */
export function createCollection(
  list: AnyCollection[],
  kind: CollectionKind,
  baseName: string,
  id: string,
): AnyCollection {
  const name = uniqueName(list, baseName);
  return kind === "collection"
    ? { id, name, kind, memberIds: [] }
    : { id, name, kind, match: "all", rules: [] };
}

export type RenameResult = { ok: true } | { ok: false; reason: string };

export function renameCollection(list: AnyCollection[], id: string, name: string): RenameResult {
  const target = list.find((c) => c.id === id);
  if (!target) return { ok: false, reason: "Collection no longer exists" };
  const clean = name.trim();
  if (clean === "") return { ok: false, reason: "Name can't be empty" };
  const clash = list.find((c) => c.id !== id && nameKey(c.name) === nameKey(clean));
  if (clash) return { ok: false, reason: `"${clash.name}" already exists` };
  target.name = clean;
  return { ok: true };
}

/** Deep-copy a collection under a fresh unique name and append it. */
export function duplicateCollection(
  list: AnyCollection[],
  id: string,
  newId: string,
): AnyCollection | null {
  const source = list.find((c) => c.id === id);
  if (!source) return null;
  const name = uniqueName(list, source.name);
  const copy: AnyCollection =
    source.kind === "collection"
      ? { id: newId, name, kind: "collection", memberIds: [...source.memberIds] }
      : { id: newId, name, kind: "smart", match: source.match, rules: source.rules.map((r) => ({ ...r })) };
  list.push(copy);
  return copy;
}

export function removeCollection(list: AnyCollection[], id: string): boolean {
  const idx = list.findIndex((c) => c.id === id);
  if (idx === -1) return false;
  list.splice(idx, 1);
  return true;
}

/** Append the ids not already present. Returns how many were added. */
export function addMembers(c: Collection, ids: string[]): number {
  const have = new Set(c.memberIds);
  let added = 0;
  for (const id of ids) {
    if (!have.has(id)) {
      have.add(id);
      c.memberIds.push(id);
      added++;
    }
  }
  return added;
}

/** Remove the given ids. Returns how many were actually members. */
export function removeMembers(c: Collection, ids: string[]): number {
  const drop = new Set(ids);
  const before = c.memberIds.length;
  c.memberIds = c.memberIds.filter((id) => !drop.has(id));
  return before - c.memberIds.length;
}

/** Whether the panel lists this collection for the open catalog: smart
 *  collections are queries (always), regular ones when empty or when at least
 *  one member resolves here. Hidden ones stay intact — their photos live in
 *  another project folder. */
export function isRelevant(c: AnyCollection, liveIds: ReadonlySet<string>): boolean {
  if (c.kind === "smart") return true;
  return c.memberIds.length === 0 || c.memberIds.some((id) => liveIds.has(id));
}

export interface ResolvedCount {
  /** Members resolving in the open catalog (or live smart matches). */
  shown: number;
  /** Members held in other projects. */
  elsewhere: number;
}

export function resolveCount(
  c: AnyCollection,
  liveIds: ReadonlySet<string>,
  smartCount: (c: SmartCollection) => number,
): ResolvedCount {
  if (c.kind === "smart") return { shown: smartCount(c), elsewhere: 0 };
  const shown = c.memberIds.filter((id) => liveIds.has(id)).length;
  return { shown, elsewhere: c.memberIds.length - shown };
}

/** Alphabetical, case-insensitive, stable; the input is left untouched. */
export function sortedCollections(list: AnyCollection[]): AnyCollection[] {
  return [...list].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
}
