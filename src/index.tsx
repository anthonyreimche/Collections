// Collections — entry point. Registers the Collections panel, the active-
// collection grid filter, the Library context-menu actions, the B target-
// collection shortcut, and removal hygiene.

import { initRuntime } from "./runtime";
import type { SafelightAPI } from "./safelight";
import {
  activePredicate,
  cs,
  deactivateCollection,
  disposeCollectionsStore,
  flushPersist,
  initCollectionsStore,
  openAddTo,
  PANEL_ID,
  pruneRemovedPhoto,
  removePhotosFrom,
  setNotify,
  targetIds,
  toggleTargetMembership,
} from "./store.ts";
import { CollectionsPanel } from "./ui/CollectionsPanel.tsx";
import { disposeToast, showToast } from "./ui/toast.ts";

const ID = "com.safelight.collections";
const FILTER_ID = `${ID}.filter`;

export function activate(api: SafelightAPI): void {
  initRuntime(api);
  initCollectionsStore();
  setNotify(showToast);

  api.registerPanel({
    id: PANEL_ID,
    title: "Collections",
    component: CollectionsPanel,
    // Between core's Folders (0) and Filters (1) — the Lightroom arrangement.
    defaultDock: { module: "library", direction: "left", order: 0.5, width: 240 },
  });

  // The grid predicate follows the active collection. Re-registering the same
  // id replaces the entry; membership and rule edits while active re-derive it.
  const syncFilter = () => {
    const predicate = activePredicate();
    api.registerGridFilter({
      id: FILTER_ID,
      test: predicate ?? (() => true),
      onClear: deactivateCollection,
    });
  };
  syncFilter();
  let hadActive = false;
  cs.subscribe((s, prev) => {
    const has = s.activeId !== null;
    if (s.activeId !== prev.activeId || (has && s.revision !== prev.revision) || has !== hadActive) {
      hadActive = has;
      syncFilter();
    }
  });

  api.registerGridMenuItem({
    id: `${ID}.add`,
    order: 13,
    label: (ids) => (ids.length > 1 ? `Add to collection… (${ids.length})` : "Add to collection…"),
    onClick: openAddTo,
  });

  // Targets the ACTIVE collection (the one the grid is showing), so it only
  // lights up while browsing a regular collection with members in the target.
  const activeRegular = () => {
    const s = cs.getState();
    const active = s.collections.find((c) => c.id === s.activeId);
    return active?.kind === "collection" ? active : null;
  };
  api.registerGridMenuItem({
    id: `${ID}.remove`,
    order: 14,
    label: (ids) => {
      const active = activeRegular();
      if (!active) return "Remove from collection";
      return ids.length > 1 ? `Remove from “${active.name}” (${ids.length})` : `Remove from “${active.name}”`;
    },
    enabled: (ids) => {
      const active = activeRegular();
      return active !== null && ids.some((id) => active.memberIds.includes(id));
    },
    onClick: (ids) => {
      const active = activeRegular();
      if (active) removePhotosFrom(active.id, ids);
    },
  });

  api.registerKeybinding({
    id: `${ID}.target`,
    label: "Toggle selection in target collection",
    category: "Library",
    defaultCombo: "B",
    handler: () => toggleTargetMembership(targetIds()),
  });

  api.registerCatalogHooks({
    id: `${ID}.hygiene`,
    async onPhotoRemove({ photo }) {
      pruneRemovedPhoto(photo.id);
    },
  });
}

export function deactivate(): void {
  // Contributions are swept by the host; flush the debounced write so a quick
  // disable can't lose the last edit, then detach core-store listeners and
  // drop the toast's DOM node.
  flushPersist();
  disposeCollectionsStore();
  disposeToast();
}
