// Smart-collection rule editor. FIELD_DEFS drives every control (field → ops →
// value slots), so the editor can never build a rule the compiler doesn't
// understand. The count line previews the current rules live before saving.

import type { ReactElement } from "react";
import { api, React, ui } from "../runtime.ts";
import type { FieldDef, Match, Rule, SmartCollection } from "../model/types.ts";
import { FIELD_DEFS, fieldDef } from "../model/types.ts";
import { compileRules } from "../model/rules.ts";
import { closeDialog, cs, saveSmart } from "../store.ts";
import { Overlay } from "./Overlay.tsx";
import { plusIcon } from "./icons.ts";

const STARTER_RULE: Rule = { field: "rating", op: "atleast", value: "3" };

/** A fresh rule for a field: its first op, enum value preseeded so the rule is
 *  well-formed from the moment it appears. */
function freshRule(def: FieldDef): Rule {
  const op = def.ops[0];
  const rule: Rule = { field: def.field, op: op.op };
  if (op.values >= 1 && def.kind === "enum" && def.options) rule.value = def.options[0].value;
  return rule;
}

export function SmartEditor({ collectionId }: { collectionId: string | null }): ReactElement | null {
  const revision = cs((s) => s.revision);
  const existing = React.useMemo(
    () =>
      collectionId === null
        ? null
        : ((cs.getState().collections.find((c) => c.id === collectionId && c.kind === "smart") as
            | SmartCollection
            | undefined) ?? null),
    [collectionId, revision],
  );

  const [name, setName] = React.useState(existing?.name ?? "");
  const [match, setMatch] = React.useState<Match>(existing?.match ?? "all");
  const [rules, setRules] = React.useState<Rule[]>(
    existing && existing.rules.length > 0 ? existing.rules.map((r) => ({ ...r })) : [{ ...STARTER_RULE }],
  );
  const [error, setError] = React.useState<string | null>(null);
  const photos = api.stores.useCatalogStore((s) => s.photos);
  const t = ui.tokens;

  const matchCount = React.useMemo(
    () => photos.filter(compileRules(rules, match, Date.now())).length,
    [rules, match, photos],
  );

  // The collection vanished under us (deleted in another window).
  const vanished = collectionId !== null && existing === null;
  React.useEffect(() => {
    if (vanished) closeDialog();
  }, [vanished]);
  if (vanished) return null;

  const patchRule = (i: number, next: Rule) => {
    setRules(rules.map((r, idx) => (idx === i ? next : r)));
  };

  const save = () => {
    const result = saveSmart(collectionId, name, match, rules);
    if (!result.ok) setError(result.reason ?? "Couldn't save");
  };

  return (
    <Overlay
      title={collectionId === null ? "New smart collection" : "Edit smart collection"}
      width={560}
      onClose={closeDialog}
      footer={
        <>
          {error && <span style={{ marginRight: "auto", fontSize: 10, color: t.labelRed }}>{error}</span>}
          <span style={{ marginRight: error ? 0 : "auto", fontSize: 10, color: t.textMuted }}>
            Matches {matchCount} of {photos.length} photos
          </span>
          <ui.Button variant="ghost" size="sm" onClick={closeDialog}>
            Cancel
          </ui.Button>
          <ui.Button variant="primary" size="sm" onClick={save}>
            Save
          </ui.Button>
        </>
      }
    >
      <ui.TextInput
        value={name}
        onChange={(v) => {
          setName(v);
          setError(null);
        }}
        placeholder="Smart collection name"
      />
      {/* The kit Select is w-full; the wrapper keeps it from claiming the row. */}
      <div style={{ width: 170 }}>
        <ui.Select
          value={match}
          onChange={(v) => setMatch(v === "any" ? "any" : "all")}
          options={[
            { value: "all", label: "Match all rules" },
            { value: "any", label: "Match any rule" },
          ]}
          ariaLabel="Rule matching"
        />
      </div>

      {rules.map((rule, i) => (
        <RuleRow
          key={i}
          rule={rule}
          onChange={(next) => patchRule(i, next)}
          onRemove={rules.length > 1 ? () => setRules(rules.filter((_, idx) => idx !== i)) : undefined}
        />
      ))}

      <div>
        <ui.Button
          variant="ghost"
          size="sm"
          onClick={() => setRules([...rules, { ...STARTER_RULE }])}
          title="Add rule"
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>{plusIcon(10)} Add rule</span>
        </ui.Button>
      </div>
    </Overlay>
  );
}

function valuePlaceholder(def: FieldDef, op: string): string {
  if (def.kind === "date") return op === "lastdays" || op === "notlastdays" ? "days" : "YYYY-MM-DD";
  if (def.field === "shutter") return "e.g. 1/250";
  if (def.kind === "number") return "value";
  return "text";
}

function RuleRow({
  rule,
  onChange,
  onRemove,
}: {
  rule: Rule;
  onChange(next: Rule): void;
  onRemove?: () => void;
}): ReactElement {
  const t = ui.tokens;
  const def = fieldDef(rule.field);
  const opDef = def?.ops.find((o) => o.op === rule.op);

  // A rule from a newer version of this extension: leave it intact but inert.
  if (!def || !opDef) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: t.textMuted }}>
        <span style={{ flex: 1 }}>
          Unsupported rule ({rule.field} {rule.op}) — kept, but matches nothing here.
        </span>
        {onRemove && <RemoveButton onRemove={onRemove} />}
      </div>
    );
  }

  const changeField = (field: string) => {
    const nextDef = fieldDef(field);
    if (nextDef) onChange(freshRule(nextDef));
  };

  const changeOp = (op: string) => {
    const nextOp = def.ops.find((o) => o.op === op);
    if (!nextOp) return;
    const next: Rule = { field: rule.field, op };
    if (nextOp.values >= 1 && rule.value !== undefined) next.value = rule.value;
    if (nextOp.values >= 1 && next.value === undefined && def.kind === "enum" && def.options) {
      next.value = def.options[0].value;
    }
    if (nextOp.values === 2 && rule.value2 !== undefined) next.value2 = rule.value2;
    onChange(next);
  };

  const valueSlot = (slot: 1 | 2): ReactElement => {
    const key = slot === 1 ? "value" : "value2";
    const current = rule[key] ?? "";
    if (def.kind === "enum" && def.options) {
      return (
        <ui.Select
          value={current}
          onChange={(v) => onChange({ ...rule, [key]: v })}
          options={def.options}
          ariaLabel={`${def.label} value`}
        />
      );
    }
    return (
      <div style={{ width: slot === 2 || opDef.values === 2 ? 90 : 130 }}>
        <ui.TextInput
          value={current}
          onChange={(v) => onChange({ ...rule, [key]: v })}
          placeholder={valuePlaceholder(def, rule.op)}
        />
      </div>
    );
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <ui.Select
        value={rule.field}
        onChange={changeField}
        options={FIELD_DEFS.map((d) => ({ value: d.field, label: d.label }))}
        ariaLabel="Rule field"
      />
      <ui.Select
        value={rule.op}
        onChange={changeOp}
        options={def.ops.map((o) => ({ value: o.op, label: o.label }))}
        ariaLabel="Rule operator"
      />
      {opDef.values >= 1 && valueSlot(1)}
      {opDef.values === 2 && (
        <>
          <span style={{ fontSize: 10, color: t.textMuted }}>and</span>
          {valueSlot(2)}
        </>
      )}
      <span style={{ marginLeft: "auto" }}>{onRemove && <RemoveButton onRemove={onRemove} />}</span>
    </div>
  );
}

function RemoveButton({ onRemove }: { onRemove(): void }): ReactElement {
  const t = ui.tokens;
  const [hover, setHover] = React.useState(false);
  return (
    <button
      onClick={onRemove}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title="Remove rule"
      aria-label="Remove rule"
      style={{
        background: "transparent",
        border: "none",
        padding: "0 4px",
        cursor: "pointer",
        color: hover ? t.labelRed : t.textMuted,
        fontSize: 13,
        lineHeight: 1,
      }}
    >
      ×
    </button>
  );
}
