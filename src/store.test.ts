// Store behaviour against a fake SafelightAPI: persistence, activation
// semantics (folder-null + guarded deactivation), target-collection B-flow,
// removal hygiene, cross-window adoption.
// Run: node --experimental-strip-types src/store.test.ts

import assert from "node:assert";
import { initRuntime } from "./runtime.ts";
import {
  activePredicate,
  addPhotosTo,
  createRegular,
  cs,
  deactivateCollection,
  deleteAction,
  disposeCollectionsStore,
  flushPersist,
  flushRemovedPhotos,
  initCollectionsStore,
  openAddTo,
  pruneRemovedPhoto,
  removePhotosFrom,
  saveSmart,
  setPanelMounted,
  setTarget,
  smartMatchCount,
  targetIds,
  toggleActive,
  toggleTargetMembership,
} from "./store.ts";
import type { Collection, SmartCollection } from "./model/types.ts";

// ── mini zustand ─────────────────────────────────────────────────────────────

function makeStore(init: unknown): any {
  let state: any;
  const listeners = new Set<(s: any, p: any) => void>();
  const set = (partial: any) => {
    const patch = typeof partial === "function" ? partial(state) : partial;
    const prev = state;
    state = { ...state, ...patch };
    listeners.forEach((l) => l(state, prev));
  };
  const get = () => state;
  state = typeof init === "function" ? (init as any)(set, get) : init;
  const hook: any = () => state;
  hook.getState = get;
  hook.setState = set;
  hook.subscribe = (l: (s: any, p: any) => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  };
  return hook;
}

// ── fake api ─────────────────────────────────────────────────────────────────

const photo = (id: string, rating: number) => ({
  id,
  filename: `${id}.NEF`,
  relPath: `${id}.NEF`,
  folder: "",
  mimeType: "image/x-nikon-nef",
  rating,
  colorLabel: "none",
  flag: "none",
  keywords: [],
  dateCreated: 0,
  dateImported: 0,
  width: 3,
  height: 2,
  exif: {},
});

const useCatalogStore = makeStore({
  photos: [photo("p1", 5), photo("p2", 2), photo("p3", 4)],
  selectedIds: new Set<string>(),
  activePhotoId: null as string | null,
});

const folderWrites: (string | null)[] = [];
const useUIStore = makeStore((set: any) => ({
  activeFolder: "2026/trip" as string | null,
  setActiveFolder(path: string | null) {
    folderWrites.push(path);
    set({ activeFolder: path });
  },
}));

const settingsMap = new Map<string, unknown>();
const settingsListeners = new Set<(key: string, value: unknown) => void>();
const fireSettings = (key: string, value: unknown) => {
  settingsMap.set(key, value);
  settingsListeners.forEach((cb) => cb(key, value));
};

const dockToggles: string[] = [];

// Stored file from a "previous run", including one junk entry to sanitize out.
settingsMap.set("data", {
  version: 1,
  collections: [
    { id: "seed", name: "Seeded", kind: "collection", memberIds: ["p1", "gone"] },
    { id: "junk" },
  ],
});
settingsMap.set("targetId", "seed");

initRuntime({
  version: 1,
  extensionId: "com.safelight.collections",
  react: {} as never,
  ui: { tokens: {} } as never,
  stores: { useCatalogStore, useUIStore, create: makeStore } as never,
  dock: { togglePanel: (id: string) => dockToggles.push(id) },
  settings: {
    get: <T,>(k: string, fb: T): T => (settingsMap.has(k) ? (settingsMap.get(k) as T) : fb),
    set: (k: string, v: unknown) => settingsMap.set(k, v),
    onChange: (cb: (key: string, value: unknown) => void) => {
      settingsListeners.add(cb);
      return () => settingsListeners.delete(cb);
    },
  },
} as never);

initCollectionsStore();

// ── init: loads, sanitizes, adopts persisted target ──────────────────────────

assert.deepEqual(
  cs.getState().collections.map((c) => c.id),
  ["seed"],
  "junk entry dropped on load",
);
assert.equal(cs.getState().targetId, "seed");

// ── targetIds: multi-selection else active photo ─────────────────────────────

assert.deepEqual(targetIds(), []);
useCatalogStore.setState({ activePhotoId: "p2", selectedIds: new Set(["p2"]) });
assert.deepEqual(targetIds(), ["p2"]);
useCatalogStore.setState({ selectedIds: new Set(["p1", "p3"]) });
assert.deepEqual(targetIds().sort(), ["p1", "p3"]);

// ── activation: predicate + folder null + guarded subscription ───────────────

assert.equal(activePredicate(), null);
toggleActive("seed");
assert.equal(cs.getState().activeId, "seed");
assert.deepEqual(folderWrites, [null], "activating nulls the folder source");
const pred = activePredicate();
assert.ok(pred, "active predicate exists");
assert.ok(pred!(photo("p1", 5) as never));
assert.ok(!pred!(photo("p2", 2) as never));

// Our own folder write didn't deactivate; an external one does.
assert.equal(cs.getState().activeId, "seed");
useUIStore.getState().setActiveFolder("2027");
assert.equal(cs.getState().activeId, null, "picking a folder deactivates");
assert.equal(activePredicate(), null);

// Toggle on, toggle off.
toggleActive("seed");
assert.equal(cs.getState().activeId, "seed");
toggleActive("seed");
assert.equal(cs.getState().activeId, null);

// ── smart collections: save, activate, live count ────────────────────────────

const saved = saveSmart(null, "Keepers", "all", [{ field: "rating", op: "atleast", value: "4" }]);
assert.equal(saved.ok, true);
const keepers = cs.getState().collections.find((c) => c.name === "Keepers") as SmartCollection;
assert.equal(keepers.kind, "smart");
assert.equal(saveSmart(null, "keepers", "all", []).ok, false, "name collision rejected");
assert.equal(saveSmart(null, "   ", "all", []).ok, false, "blank name rejected");

assert.equal(smartMatchCount("all", keepers.rules), 2, "p1 and p3 rate ≥ 4");

toggleActive(keepers.id);
const smartPred = activePredicate()!;
assert.ok(smartPred(photo("x", 4) as never));
assert.ok(!smartPred(photo("x", 3) as never));

// Editing the active smart collection re-derives the predicate on next read.
saveSmart(keepers.id, "Keepers", "all", [{ field: "rating", op: "atleast", value: "5" }]);
assert.ok(!activePredicate()!(photo("x", 4) as never));

// ── membership actions ───────────────────────────────────────────────────────

addPhotosTo("seed", ["p2", "p1"]);
const seed = () => cs.getState().collections.find((c) => c.id === "seed") as Collection;
assert.deepEqual(seed().memberIds, ["p1", "gone", "p2"], "dedup keeps existing order");
removePhotosFrom("seed", ["p1"]);
assert.deepEqual(seed().memberIds, ["gone", "p2"]);

// ── B-flow: no target → Quick Collection; all-members toggle removes ─────────

setTarget(null);
toggleTargetMembership([]);
assert.equal(
  cs.getState().collections.some((c) => c.name === "Quick Collection"),
  false,
  "empty targets never create anything",
);
toggleTargetMembership(["p1", "p3"]);
const quick = () => cs.getState().collections.find((c) => c.name === "Quick Collection") as Collection;
assert.ok(quick(), "Quick Collection created on first use");
assert.equal(cs.getState().targetId, quick().id);
assert.deepEqual(quick().memberIds, ["p1", "p3"]);
toggleTargetMembership(["p1"]);
assert.deepEqual(quick().memberIds, ["p3"], "all-members selection toggles off");
toggleTargetMembership(["p1", "p3"]);
assert.deepEqual(quick().memberIds, ["p3", "p1"], "partial selection completes membership");

// ── persistence: debounced, flushable ────────────────────────────────────────

flushPersist();
const persisted = settingsMap.get("data") as { collections: { id: string }[] };
assert.ok(
  persisted.collections.some((c) => c.id === quick().id),
  "flush writes the current file",
);
assert.equal(settingsMap.get("targetId"), quick().id);

// ── dialogues: add-to opens the panel only when unmounted ──────────────────────

setPanelMounted(false);
openAddTo(["p1"]);
assert.deepEqual(cs.getState().dialog, { kind: "addTo", photoIds: ["p1"] });
assert.equal(dockToggles.length, 1);
setPanelMounted(true);
openAddTo(["p2"]);
assert.equal(dockToggles.length, 1, "mounted panel isn't toggled again");

// ── removal hygiene ──────────────────────────────────────────────────────────

pruneRemovedPhoto("p3");
flushRemovedPhotos();
assert.deepEqual(quick().memberIds, ["p1"]);
assert.deepEqual(seed().memberIds, ["gone", "p2"], "other ids untouched");

// Core reports a bulk removal one photo at a time, awaiting each extension's
// hook (other extensions may do file I/O in between): one prune, one bump.
const bulk = Array.from({ length: 1000 }, (_, i) => `bulk${i}`);
addPhotosTo("seed", bulk);
let bumps = 0;
const stopCounting = cs.subscribe((s, prev) => {
  if (s.revision !== prev.revision) bumps += 1;
});
for (const [i, id] of bulk.entries()) {
  pruneRemovedPhoto(id);
  await (i % 100 === 0 ? new Promise((r) => setTimeout(r, 0)) : Promise.resolve());
}
await new Promise((r) => setTimeout(r, 300));
stopCounting();
assert.equal(bumps, 1, "1,000 removals bump once");
assert.deepEqual(seed().memberIds, ["gone", "p2"], "every removed id pruned");

// ── delete: active + target fall back ────────────────────────────────────────

toggleActive(quick().id);
setTarget(quick().id);
deleteAction(quick().id);
assert.equal(cs.getState().activeId, null, "deleting the active collection deactivates");
assert.equal(cs.getState().targetId, null, "deleting the target clears it");
assert.equal(cs.getState().collections.some((c) => c.name === "Quick Collection"), false);

// ── cross-window adoption ────────────────────────────────────────────────────

toggleActive("seed");
setTarget("seed");
fireSettings("data", {
  version: 1,
  collections: [{ id: "other", name: "From another window", kind: "collection", memberIds: [] }],
});
assert.deepEqual(cs.getState().collections.map((c) => c.id), ["other"]);
assert.equal(cs.getState().activeId, null, "vanished active drops");
assert.equal(cs.getState().targetId, null, "vanished target drops");

fireSettings("targetId", "other");
assert.equal(cs.getState().targetId, "other");

// createRegular auto-name + inline rename state.
const newId = createRegular();
assert.equal(cs.getState().editingId, newId);
assert.ok(cs.getState().collections.some((c) => c.id === newId && c.name === "New Collection"));

deactivateCollection();
assert.equal(cs.getState().activeId, null);

// ── dispose: detached listeners stop reacting ────────────────────────────────

toggleActive("other");
assert.equal(cs.getState().activeId, "other");
disposeCollectionsStore();
useUIStore.getState().setActiveFolder("2028");
assert.equal(cs.getState().activeId, "other", "disposed folder listener no longer deactivates");
fireSettings("data", { version: 1, collections: [] });
assert.equal(cs.getState().collections.length, 2, "disposed settings listener no longer adopts");

console.log("OK — store.test.ts");
