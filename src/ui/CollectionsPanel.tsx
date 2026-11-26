// The Collections panel: sorted rows with live counts, inline rename and
// delete-confirm, context menu, grid-drop targets, and the two dialogues
// (rendered as fixed-inset overlays from this subtree so they work docked,
// floating, or in a detached window).

import type { CSSProperties, ReactElement } from "react";
import { api, React, ui } from "../runtime.ts";
import type { AnyCollection } from "../model/types.ts";
import { isRelevant, resolveCount, sortedCollections } from "../model/collections.ts";
import { compileRules } from "../model/rules.ts";
import {
  addPhotosTo,
  createRegular,
  createSmart,
  cs,
  deleteAction,
  duplicateAction,
  editSmart,
  renameAction,
  setConfirmDelete,
  setEditing,
  setPanelMounted,
  setTarget,
  toggleActive,
  toggleShowUnrelated,
} from "../store.ts";
import type { ContextMenuItem } from "../safelight";
import { useMenu } from "./menu.tsx";
import { collectionIcon, plusIcon, smartIcon } from "./icons.ts";
import { AddToDialog } from "./AddToDialog.tsx";
import { SmartEditor } from "./SmartEditor.tsx";

const DND_PHOTOS = "application/x-safelight-photos";

export function CollectionsPanel(): ReactElement {
  const revision = cs((s) => s.revision);
  const activeId = cs((s) => s.activeId);
  const targetId = cs((s) => s.targetId);
  const showUnrelated = cs((s) => s.showUnrelated);
  const dialog = cs((s) => s.dialog);
  const photos = api.stores.useCatalogStore((s) => s.photos);
  const { menu, openMenu } = useMenu();

  React.useEffect(() => {
    setPanelMounted(true);
    return () => setPanelMounted(false);
  }, []);

  const live = React.useMemo(() => new Set(photos.map((p) => p.id)), [photos]);

  const counts = React.useMemo(() => {
    const now = Date.now();
    const map = new Map<string, { shown: number; elsewhere: number }>();
    for (const c of cs.getState().collections) {
      map.set(
        c.id,
        resolveCount(c, live, (sc) => photos.filter(compileRules(sc.rules, sc.match, now)).length),
      );
    }
    return map;
    // revision covers collection edits; photos covers catalogue changes.
  }, [revision, photos, live]);

  const sorted = React.useMemo(
    () => sortedCollections(cs.getState().collections),
    [revision],
  );
  const hidden = sorted.filter((c) => !isRelevant(c, live));
  const visible = showUnrelated ? sorted : sorted.filter((c) => isRelevant(c, live));

  const t = ui.tokens;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: 8, fontSize: 11 }}>
      {visible.length === 0 ? (
        <p style={{ padding: "6px 4px", fontSize: 10, color: t.textMuted, lineHeight: 1.5 }}>
          No collections yet. Create one below, then add photos by right-click,
          drag-and-drop, or B for the target collection.
        </p>
      ) : (
        visible.map((c) => (
          <Row
            key={c.id}
            c={c}
            active={activeId === c.id}
            isTarget={targetId === c.id}
            unrelated={!isRelevant(c, live)}
            count={counts.get(c.id) ?? { shown: 0, elsewhere: 0 }}
            openMenu={openMenu}
          />
        ))
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6 }}>
        <ui.Button variant="ghost" size="sm" title="New collection" onClick={() => createRegular()}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            {plusIcon(10)} Collection
          </span>
        </ui.Button>
        <ui.Button variant="ghost" size="sm" title="New smart collection" onClick={() => createSmart()}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            {plusIcon(10)} Smart
          </span>
        </ui.Button>
        {hidden.length > 0 && (
          <button
            onClick={toggleShowUnrelated}
            style={{
              marginLeft: "auto",
              background: "transparent",
              border: "none",
              padding: "2px 4px",
              cursor: "pointer",
              fontSize: 10,
              color: t.textMuted,
            }}
            title="Collections whose photos live in other project folders"
          >
            {showUnrelated ? "Hide other projects" : `Show ${hidden.length} from other projects`}
          </button>
        )}
      </div>

      {menu}
      {dialog.kind === "addTo" && <AddToDialog photoIds={dialog.photoIds} />}
      {dialog.kind === "smartEdit" && (
        <SmartEditor key={dialog.collectionId ?? "new"} collectionId={dialog.collectionId} />
      )}
    </div>
  );
}

interface RowProps {
  c: AnyCollection;
  active: boolean;
  isTarget: boolean;
  unrelated: boolean;
  count: { shown: number; elsewhere: number };
  openMenu(e: { clientX: number; clientY: number }, items: ContextMenuItem[]): void;
}

function Row({ c, active, isTarget, unrelated, count, openMenu }: RowProps): ReactElement {
  const editing = cs((s) => s.editingId) === c.id;
  const confirming = cs((s) => s.confirmDeleteId) === c.id;
  const [hover, setHover] = React.useState(false);
  const [dropHover, setDropHover] = React.useState(false);
  const t = ui.tokens;

  const menuItems = (): ContextMenuItem[] => {
    const items: ContextMenuItem[] = [
      { label: "Rename", onClick: () => setEditing(c.id) },
      { label: "Duplicate", onClick: () => duplicateAction(c.id) },
    ];
    if (c.kind === "collection") {
      items.push(
        isTarget
          ? { label: "Unset as target collection", onClick: () => setTarget(null) }
          : { label: "Set as target collection", onClick: () => setTarget(c.id) },
      );
    } else {
      items.push({ label: "Edit rules…", onClick: () => editSmart(c.id) });
    }
    items.push({ label: "Delete…", danger: true, onClick: () => setConfirmDelete(c.id) });
    return items;
  };

  const acceptsDrop = c.kind === "collection";
  const rowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 6px",
    borderRadius: 4,
    cursor: "pointer",
    userSelect: "none",
    opacity: unrelated ? 0.5 : 1,
    color: t.textPrimary,
    background: active ? t.surface3 : hover ? t.surface2 : "transparent",
    boxShadow: dropHover
      ? `inset 0 0 0 1px ${t.accent}`
      : active
        ? `inset 2px 0 0 0 ${t.accent}`
        : "none",
  };

  return (
    <div>
      <div
        style={rowStyle}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={() => {
          if (!editing) toggleActive(c.id);
        }}
        onDoubleClick={() => setEditing(c.id)}
        onContextMenu={(e) => {
          e.preventDefault();
          openMenu(e, menuItems());
        }}
        onDragOver={
          acceptsDrop
            ? (e) => {
                if (e.dataTransfer.types.includes(DND_PHOTOS)) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "copy";
                  setDropHover(true);
                }
              }
            : undefined
        }
        onDragLeave={acceptsDrop ? () => setDropHover(false) : undefined}
        onDrop={
          acceptsDrop
            ? (e) => {
                setDropHover(false);
                const raw = e.dataTransfer.getData(DND_PHOTOS);
                if (!raw) return;
                e.preventDefault();
                try {
                  const ids = JSON.parse(raw) as unknown;
                  if (Array.isArray(ids) && ids.every((x) => typeof x === "string")) {
                    addPhotosTo(c.id, ids);
                  }
                } catch {
                  // Foreign drag payload under our MIME type — ignore it.
                }
              }
            : undefined
        }
      >
        <span style={{ display: "flex", color: active ? t.accent : t.textMuted }}>
          {c.kind === "smart" ? smartIcon(12) : collectionIcon(12)}
        </span>
        {editing ? (
          <RenameInput id={c.id} initial={c.name} />
        ) : (
          <span
            style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            {c.name}
          </span>
        )}
        {isTarget && (
          <span
            title="Target collection (B adds here)"
            style={{
              fontSize: 9,
              lineHeight: 1,
              padding: "2px 4px",
              borderRadius: 999,
              background: t.surface3,
              color: t.accent,
              fontWeight: 700,
            }}
          >
            +
          </span>
        )}
        <span
          title={count.elsewhere > 0 ? `${count.shown} here · ${count.elsewhere} in other projects` : undefined}
          style={{ fontSize: 10, color: t.textMuted }}
        >
          {count.shown}
          {count.elsewhere > 0 ? "*" : ""}
        </span>
      </div>

      {confirming && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 6px 6px 24px",
            fontSize: 10,
            color: t.textSecondary,
          }}
        >
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            Delete “{c.name}”?
          </span>
          <ui.Button variant="danger" size="sm" onClick={() => deleteAction(c.id)}>
            Delete
          </ui.Button>
          <ui.Button variant="ghost" size="sm" onClick={() => setConfirmDelete(null)}>
            Cancel
          </ui.Button>
        </div>
      )}
    </div>
  );
}

function RenameInput({ id, initial }: { id: string; initial: string }): ReactElement {
  const [value, setValue] = React.useState(initial);
  const ref = React.useRef<HTMLInputElement>(null);
  const t = ui.tokens;

  React.useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const commit = () => {
    if (value.trim() === "" || value.trim() === initial) {
      setEditing(null);
      return;
    }
    if (!renameAction(id, value).ok) ref.current?.focus();
  };

  return (
    <input
      ref={ref}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") commit();
        if (e.key === "Escape") setEditing(null);
      }}
      onBlur={commit}
      style={{
        flex: 1,
        minWidth: 0,
        boxSizing: "border-box",
        borderRadius: 4,
        border: `1px solid ${t.borderSubtle}`,
        background: t.surface2,
        color: t.textPrimary,
        fontSize: 11,
        padding: "2px 6px",
        outline: "none",
      }}
    />
  );
}
