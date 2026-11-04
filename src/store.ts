// Extension state + every action the UI calls. Collections are mutated in
// place via the pure model ops; `revision` is the change signal components
// subscribe to. DOM-free by design (node tests drive it through a fake API):
// user-facing feedback goes through the injected `notify` callback.

import { api } from "./runtime.ts";
import type { StoreHook } from "./safelight";
import type { AnyCollection, Collection, CollectionsFile, Match, Rule, SmartCollection } from "./model/types.ts";
import { EMPTY_FILE, sanitizeFile } from "./model/types.ts";
import { compileRules, type PhotoPredicate } from "./model/rules.ts";
import {
  addMembers,
  createCollection,
  duplicateCollection,
  removeCollection,
  removeMembers,
  renameCollection,
  uniqueName,
  type RenameResult,
} from "./model/collections.ts";

export const PANEL_ID = "com.safelight.collections.panel";

const SETTING_DATA = "data";
const SETTING_TARGET = "targetId";
const SETTING_UI = "ui";
const PERSIST_DELAY_MS = 300;
const PRUNE_DELAY_MS = 100;
const QUICK_NAME = "Quick Collection";

export type DialogState =
  | { kind: "none" }
  | { kind: "addTo"; photoIds: string[] }
  | { kind: "smartEdit"; collectionId: string | null };

export interface CollectionsState {
  revision: number;
  collections: AnyCollection[];
  /** Collection currently shown in the grid (null = none). */
  activeId: string | null;
  /** Collection the `B` shortcut toggles against. */
  targetId: string | null;
  showUnrelated: boolean;
  dialog: DialogState;
  /** Row in inline-rename mode. */
  editingId: string | null;
  confirmDeleteId: string | null;
}

export let cs!: StoreHook<CollectionsState>;

let notify: (message: string) => void = () => {};
let persistTimer: ReturnType<typeof setTimeout> | undefined;
let pruneTimer: ReturnType<typeof setTimeout> | undefined;
let removedIds = new Set<string>();
let ownFolderWrite = false;
let panelMounted = false;
let disposers: (() => void)[] = [];

export function setNotify(cb: (message: string) => void): void {
  notify = cb;
}

export function setPanelMounted(mounted: boolean): void {
  panelMounted = mounted;
}

export function initCollectionsStore(): void {
  const file = sanitizeFile(api.settings.get<unknown>(SETTING_DATA, EMPTY_FILE));
  const storedTarget = api.settings.get<string | null>(SETTING_TARGET, null);
  const ui = api.settings.get<{ showUnrelated?: boolean }>(SETTING_UI, {});

  cs = api.stores.create<CollectionsState>(() => ({
    revision: 0,
    collections: file.collections,
    activeId: null,
    targetId: file.collections.some((c) => c.id === storedTarget) ? storedTarget : null,
    showUnrelated: ui.showUnrelated === true,
    dialog: { kind: "none" },
    editingId: null,
    confirmDeleteId: null,
  }));

  // Another window edited the data: adopt it, dropping session pointers that
  // no longer resolve. Adoption never re-persists (that would echo forever).
  disposers.push(api.settings.onChange((key, value) => {
    if (key === SETTING_DATA) {
      const next = sanitizeFile(value);
      cs.setState((s) => ({
        collections: next.collections,
        activeId: next.collections.some((c) => c.id === s.activeId) ? s.activeId : null,
        targetId: next.collections.some((c) => c.id === s.targetId) ? s.targetId : null,
        revision: s.revision + 1,
      }));
    } else if (key === SETTING_TARGET) {
      const target = typeof value === "string" ? value : null;
      cs.setState((s) => ({
        targetId: s.collections.some((c) => c.id === target) ? target : null,
      }));
    }
  }));

  // Picking a folder switches the grid's source, so it dismisses the active
  // collection (Lightroom semantics) — except our own activation write.
  disposers.push(
    api.stores.useUIStore.subscribe((s, prev) => {
      if (s.activeFolder !== prev.activeFolder && !ownFolderWrite && cs.getState().activeId) {
        deactivateCollection();
      }
    }),
  );
}

/** Detach the core-store and settings listeners on extension disable — they
 *  would otherwise keep firing into an unloaded module. */
export function disposeCollectionsStore(): void {
  for (const dispose of disposers) dispose();
  disposers = [];
}

function bump(): void {
  cs.setState((s) => ({ revision: s.revision + 1 }));
}

function persist(): void {
  if (persistTimer !== undefined) clearTimeout(persistTimer);
  persistTimer = setTimeout(flushPersist, PERSIST_DELAY_MS);
}

export function flushPersist(): void {
  if (persistTimer !== undefined) {
    clearTimeout(persistTimer);
    persistTimer = undefined;
  }
  try {
    const file: CollectionsFile = { version: 1, collections: cs.getState().collections };
    api.settings.set(SETTING_DATA, file);
  } catch (err) {
    console.warn("[collections] failed to persist:", err);
  }
}

function persistTarget(): void {
  try {
    api.settings.set(SETTING_TARGET, cs.getState().targetId);
  } catch (err) {
    console.warn("[collections] failed to persist target:", err);
  }
}

// ── lookups ──────────────────────────────────────────────────────────────────

const byId = (id: string | null): AnyCollection | undefined =>
  id === null ? undefined : cs.getState().collections.find((c) => c.id === id);

export function liveIdSet(): Set<string> {
  return new Set(api.stores.useCatalogStore.getState().photos.map((p) => p.id));
}

/** The photos an action targets: the multi-selection, else the active photo. */
export function targetIds(): string[] {
  const s = api.stores.useCatalogStore.getState();
  if (s.selectedIds.size > 1) return [...s.selectedIds];
  return s.activePhotoId ? [s.activePhotoId] : [];
}

export function smartMatchCount(match: Match, rules: Rule[]): number {
  const pred = compileRules(rules, match, Date.now());
  return api.stores.useCatalogStore.getState().photos.filter(pred).length;
}

// ── activation (grid filter source) ──────────────────────────────────────────

/** The grid predicate for the active collection; null when none is active. */
export function activePredicate(): PhotoPredicate | null {
  const active = byId(cs.getState().activeId);
  if (!active) return null;
  if (active.kind === "smart") return compileRules(active.rules, active.match, Date.now());
  const members = new Set(active.memberIds);
  return (p) => members.has(p.id);
}

export function toggleActive(id: string): void {
  if (cs.getState().activeId === id) {
    deactivateCollection();
    return;
  }
  if (!byId(id)) return;
  cs.setState({ activeId: id });
  // A collection is a source, not a folder refinement: widen to All Photos.
  ownFolderWrite = true;
  try {
    api.stores.useUIStore.getState().setActiveFolder(null);
  } finally {
    ownFolderWrite = false;
  }
}

export function deactivateCollection(): void {
  if (cs.getState().activeId !== null) cs.setState({ activeId: null });
}

// ── collection CRUD ──────────────────────────────────────────────────────────

export function createRegular(name?: string): string {
  const { collections } = cs.getState();
  const entry = createCollection(collections, "collection", name ?? "New Collection", crypto.randomUUID());
  collections.push(entry);
  cs.setState({ editingId: name === undefined ? entry.id : null });
  persist();
  bump();
  return entry.id;
}

export function createSmart(): void {
  cs.setState({ dialog: { kind: "smartEdit", collectionId: null } });
}

export function editSmart(id: string): void {
  cs.setState({ dialog: { kind: "smartEdit", collectionId: id } });
}

export function saveSmart(
  id: string | null,
  name: string,
  match: Match,
  rules: Rule[],
): { ok: boolean; reason?: string } {
  const { collections } = cs.getState();
  const clean = name.trim();
  const cloned = rules.map((r) => ({ ...r }));

  if (id === null) {
    if (clean === "") return { ok: false, reason: "Name can't be empty" };
    const clash = collections.find((c) => c.name.trim().toLowerCase() === clean.toLowerCase());
    if (clash) return { ok: false, reason: `"${clash.name}" already exists` };
    collections.push({ id: crypto.randomUUID(), name: clean, kind: "smart", match, rules: cloned });
  } else {
    const target = byId(id);
    if (!target || target.kind !== "smart") return { ok: false, reason: "Collection no longer exists" };
    const renamed: RenameResult = renameCollection(collections, id, clean);
    if (!renamed.ok) return renamed;
    target.match = match;
    target.rules = cloned;
  }
  cs.setState({ dialog: { kind: "none" } });
  persist();
  bump();
  return { ok: true };
}

export function renameAction(id: string, name: string): RenameResult {
  const result = renameCollection(cs.getState().collections, id, name);
  if (result.ok) {
    cs.setState({ editingId: null });
    persist();
    bump();
  }
  return result;
}

export function duplicateAction(id: string): void {
  if (duplicateCollection(cs.getState().collections, id, crypto.randomUUID())) {
    persist();
    bump();
  }
}

export function deleteAction(id: string): void {
  const { collections } = cs.getState();
  if (!removeCollection(collections, id)) return;
  cs.setState((s) => ({
    activeId: s.activeId === id ? null : s.activeId,
    targetId: s.targetId === id ? null : s.targetId,
    confirmDeleteId: s.confirmDeleteId === id ? null : s.confirmDeleteId,
    editingId: s.editingId === id ? null : s.editingId,
  }));
  if (api.settings.get<string | null>(SETTING_TARGET, null) === id) persistTarget();
  persist();
  bump();
}

export function setTarget(id: string | null): void {
  if (id !== null && byId(id)?.kind !== "collection") return;
  cs.setState({ targetId: id });
  persistTarget();
}

// ── membership ───────────────────────────────────────────────────────────────

export function addPhotosTo(collectionId: string, photoIds: string[]): void {
  const c = byId(collectionId);
  if (c?.kind !== "collection" || photoIds.length === 0) return;
  const added = addMembers(c, photoIds);
  notify(added > 0 ? `Added ${added} to "${c.name}"` : `Already in "${c.name}"`);
  if (added > 0) {
    persist();
    bump();
  }
}

export function removePhotosFrom(collectionId: string, photoIds: string[]): void {
  const c = byId(collectionId);
  if (c?.kind !== "collection" || photoIds.length === 0) return;
  const removed = removeMembers(c, photoIds);
  if (removed > 0) {
    notify(`Removed ${removed} from "${c.name}"`);
    persist();
    bump();
  }
}

/** The `B` shortcut: everything targeted is already in the target collection →
 *  take it out; otherwise complete the membership (Lightroom Quick Collection
 *  semantics). First use with no target creates one. */
export function toggleTargetMembership(photoIds: string[]): void {
  if (photoIds.length === 0) return;
  let target = byId(cs.getState().targetId);
  if (target?.kind !== "collection") {
    const { collections } = cs.getState();
    const entry = createCollection(collections, "collection", uniqueName(collections, QUICK_NAME), crypto.randomUUID()) as Collection;
    collections.push(entry);
    cs.setState({ targetId: entry.id });
    persistTarget();
    target = entry;
  }
  const members = new Set(target.memberIds);
  if (photoIds.every((id) => members.has(id))) {
    removePhotosFrom(target.id, photoIds);
  } else {
    addPhotosTo(target.id, photoIds);
  }
}

/** Core reports a bulk removal one photo at a time, with other extensions'
 *  hooks (file I/O) in between, so removals gather until they go quiet and a
 *  bulk removal prunes, persists and re-derives the grid filter once. */
export function pruneRemovedPhoto(photoId: string): void {
  removedIds.add(photoId);
  if (pruneTimer !== undefined) clearTimeout(pruneTimer);
  pruneTimer = setTimeout(flushRemovedPhotos, PRUNE_DELAY_MS);
}

export function flushRemovedPhotos(): void {
  if (pruneTimer !== undefined) {
    clearTimeout(pruneTimer);
    pruneTimer = undefined;
  }
  if (removedIds.size === 0) return;
  const ids = [...removedIds];
  removedIds = new Set();
  let changed = false;
  for (const c of cs.getState().collections) {
    if (c.kind === "collection" && removeMembers(c, ids) > 0) changed = true;
  }
  if (changed) {
    persist();
    bump();
  }
}

// ── dialogue / panel state ─────────────────────────────────────────────────────

export function openAddTo(photoIds: string[]): void {
  if (photoIds.length === 0) return;
  cs.setState({ dialog: { kind: "addTo", photoIds } });
  if (!panelMounted) api.dock.togglePanel(PANEL_ID);
}

export function closeDialog(): void {
  cs.setState({ dialog: { kind: "none" } });
}

export function setEditing(id: string | null): void {
  cs.setState({ editingId: id });
}

export function setConfirmDelete(id: string | null): void {
  cs.setState({ confirmDeleteId: id });
}

export function toggleShowUnrelated(): void {
  const next = !cs.getState().showUnrelated;
  cs.setState({ showUnrelated: next });
  try {
    api.settings.set(SETTING_UI, { showUnrelated: next });
  } catch (err) {
    console.warn("[collections] failed to persist ui state:", err);
  }
}

export type { AnyCollection, Collection, SmartCollection };
