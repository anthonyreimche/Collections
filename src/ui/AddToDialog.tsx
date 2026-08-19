// "Add photos to collection" chooser: tri-state membership checkboxes over the
// regular collections, plus an inline create-and-add row. Toggles apply
// immediately (the dialog is a live view, not a form).

import type { ReactElement } from "react";
import { React, ui } from "../runtime.ts";
import type { Collection } from "../model/types.ts";
import { sortedCollections } from "../model/collections.ts";
import { Overlay } from "./Overlay.tsx";
import {
  addPhotosTo,
  closeDialog,
  createRegular,
  cs,
  removePhotosFrom,
} from "../store.ts";

export function AddToDialog({ photoIds }: { photoIds: string[] }): ReactElement {
  const revision = cs((s) => s.revision);
  const [newName, setNewName] = React.useState("");
  const t = ui.tokens;

  const regulars = React.useMemo(
    () =>
      sortedCollections(cs.getState().collections).filter(
        (c): c is Collection => c.kind === "collection",
      ),
    [revision],
  );

  const createAndAdd = () => {
    const name = newName.trim();
    if (name === "") return;
    const id = createRegular(name);
    addPhotosTo(id, photoIds);
    setNewName("");
  };

  return (
    <Overlay
      title={`Add ${photoIds.length} ${photoIds.length === 1 ? "photo" : "photos"} to collection`}
      width={380}
      onClose={closeDialog}
      footer={
        <ui.Button variant="primary" size="sm" onClick={closeDialog}>
          Done
        </ui.Button>
      }
    >
      {regulars.length === 0 && (
        <p style={{ fontSize: 10, color: t.textMuted }}>No collections yet — create one below.</p>
      )}
      {regulars.map((c) => (
        <CheckRow key={c.id} c={c} photoIds={photoIds} />
      ))}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
        <ui.TextInput
          value={newName}
          onChange={setNewName}
          placeholder="New collection…"
          onKeyDown={(e) => {
            if (e.key === "Enter") createAndAdd();
          }}
        />
        <ui.Button variant="secondary" size="sm" onClick={createAndAdd} disabled={newName.trim() === ""}>
          Create
        </ui.Button>
      </div>
    </Overlay>
  );
}

function CheckRow({ c, photoIds }: { c: Collection; photoIds: string[] }): ReactElement {
  const t = ui.tokens;
  const [hover, setHover] = React.useState(false);
  const members = new Set(c.memberIds);
  const inCount = photoIds.filter((id) => members.has(id)).length;
  const checked = inCount === photoIds.length && photoIds.length > 0;
  const indeterminate = inCount > 0 && !checked;

  const boxRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (boxRef.current) boxRef.current.indeterminate = indeterminate;
  }, [indeterminate]);

  const toggle = () => {
    if (checked) removePhotosFrom(c.id, photoIds);
    else addPhotosTo(c.id, photoIds);
  };

  return (
    <label
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "4px 6px",
        borderRadius: 4,
        cursor: "pointer",
        background: hover ? t.surface2 : "transparent",
      }}
    >
      <input
        ref={boxRef}
        type="checkbox"
        checked={checked}
        onChange={toggle}
        style={{ accentColor: t.accent, margin: 0 }}
      />
      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {c.name}
      </span>
      <span style={{ fontSize: 10, color: t.textMuted }}>{c.memberIds.length}</span>
    </label>
  );
}
