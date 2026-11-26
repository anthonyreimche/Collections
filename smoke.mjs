// Smoke test against the built bundle: run `npm run smoke` (builds first).
// Mocks the SafelightAPI, drives activate() and the registered contributions,
// and checks registration shape, the B target-collection flow, removal
// hygiene, cross-window adoption, and teardown flushing. Activation semantics
// (grid predicate, folder handoff) are covered in depth by src/store.test.ts.
import assert from "node:assert";

globalThis.window ??= globalThis;

// ── mini zustand ─────────────────────────────────────────────────────────────
function makeStore(init) {
  let state;
  const listeners = new Set();
  const set = (partial) => {
    const patch = typeof partial === "function" ? partial(state) : partial;
    const prev = state;
    state = { ...state, ...patch };
    listeners.forEach((l) => l(state, prev));
  };
  const get = () => state;
  state = typeof init === "function" ? init(set, get) : init;
  const hook = () => state;
  hook.getState = get;
  hook.setState = set;
  hook.subscribe = (l) => {
    listeners.add(l);
    return () => listeners.delete(l);
  };
  return hook;
}

// ── mocked catalogue / ui stores ───────────────────────────────────────────────
const photo = (id) => ({
  id,
  filename: `${id}.NEF`,
  relPath: `${id}.NEF`,
  folder: "",
  mimeType: "image/x-nikon-nef",
  rating: 3,
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
  photos: [photo("p1"), photo("p2")],
  selectedIds: new Set(),
  activePhotoId: null,
});
const useUIStore = makeStore((set) => ({
  activeFolder: null,
  setActiveFolder: (path) => set({ activeFolder: path }),
}));

// ── mocked settings / registry ───────────────────────────────────────────────
const settingsMap = new Map();
const settingsListeners = new Set();
const registered = { menus: new Map() };
const dockToggles = [];
const notices = [];
// core's api.catalog.targetIds: the selection, else the active photo.
let targets = [];
const api = {
  version: 1,
  extensionId: "com.safelight.collections",
  react: { createElement: () => null, Fragment: Symbol("Fragment") },
  ui: { tokens: {}, notify: (n) => notices.push(n) },
  catalog: { targetIds: () => targets },
  stores: { useCatalogStore, useUIStore, create: makeStore },
  dock: { togglePanel: (id) => dockToggles.push(id) },
  settings: {
    get: (k, fb) => (settingsMap.has(k) ? settingsMap.get(k) : fb),
    set: (k, v) => settingsMap.set(k, v),
    onChange: (cb) => {
      settingsListeners.add(cb);
      return () => settingsListeners.delete(cb);
    },
  },
  registerPanel: (c) => (registered.panel = c),
  registerGridFilter: (c) => (registered.filter = c),
  registerGridMenuItem: (c) => registered.menus.set(c.id, c),
  registerCatalogHooks: (c) => (registered.hooks = c),
  registerKeybinding: (c) => (registered.key = c),
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const mod = await import("./index.js");
assert.equal(typeof mod.activate, "function", "exports activate()");
assert.equal(typeof mod.deactivate, "function", "exports deactivate()");

mod.activate(api);

// Registrations.
assert.equal(registered.panel?.title, "Collections");
assert.deepEqual(registered.panel?.defaultDock, { module: "library", direction: "left", order: 0.5, width: 240 });
assert.ok(registered.filter, "grid filter registered");
assert.ok(registered.hooks?.onPhotoRemove, "remove hook registered");
assert.equal(registered.key?.defaultCombo, "B");
assert.equal(registered.key?.category, "Library");
const addItem = registered.menus.get("com.safelight.collections.add");
const removeItem = registered.menus.get("com.safelight.collections.remove");
assert.ok(addItem && removeItem, "both grid menu items registered");
assert.equal(addItem.label(["a"]), "Add to collection…");
assert.equal(addItem.label(["a", "b"]), "Add to collection… (2)");

// Idle filter passes everything; remove item is disabled with nothing active.
assert.equal(registered.filter.test(photo("p1")), true);
assert.equal(removeItem.enabled(["p1"]), false);
assert.equal(removeItem.label(["p1"]), "Remove from collection");

// "Add to collection…" opens the (unmounted) panel.
addItem.onClick(["p2"]);
assert.deepEqual(dockToggles, ["com.safelight.collections.panel"]);

// B with nothing selected: safe no-op, nothing created.
registered.key.handler();
assert.equal(settingsMap.has("data"), false, "no-op writes nothing");

// Select p1 → B creates the Quick Collection and adds it, and says so.
targets = ["p1"];
registered.key.handler();
assert.deepEqual(notices, ['Added 1 to "Quick Collection"']);
await sleep(400);
let file = settingsMap.get("data");
const quick = file.collections.find((c) => c.name === "Quick Collection");
assert.ok(quick, "Quick Collection persisted after the debounce");
assert.deepEqual(quick.memberIds, ["p1"]);
assert.equal(settingsMap.get("targetId"), quick.id);

// B again toggles p1 back out.
registered.key.handler();
await sleep(400);
file = settingsMap.get("data");
assert.deepEqual(file.collections.find((c) => c.id === quick.id).memberIds, []);

// Membership hygiene on photo removal.
registered.key.handler(); // re-add p1
await registered.hooks.onPhotoRemove({ photo: photo("p1") });
await sleep(400);
file = settingsMap.get("data");
assert.deepEqual(file.collections.find((c) => c.id === quick.id).memberIds, []);

// Cross-window adoption replaces the list; the next flush writes it through.
settingsListeners.forEach((cb) =>
  cb("data", {
    version: 1,
    collections: [{ id: "other", name: "From elsewhere", kind: "collection", memberIds: ["p2"] }],
  }),
);
targets = ["p2"];
registered.key.handler(); // target vanished with the adoption → a fresh Quick Collection
mod.deactivate(); // flushes the pending write synchronously
file = settingsMap.get("data");
assert.ok(file.collections.some((c) => c.id === "other"), "adopted collection survives the flush");
const newQuick = file.collections.find((c) => c.name === "Quick Collection");
assert.ok(newQuick && newQuick.id !== quick.id, "fresh target after adoption dropped the old one");
assert.deepEqual(newQuick.memberIds, ["p2"]);

console.log("OK — all Collections smoke assertions passed");
