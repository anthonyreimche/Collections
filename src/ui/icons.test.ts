// The collection glyphs take the panel surface from the theme tokens.
// Run: node --experimental-strip-types src/ui/icons.test.ts

import assert from "node:assert";
import { initRuntime } from "../runtime.ts";
import { collectionIcon, smartIcon } from "./icons.ts";

interface Drawn {
  type: string;
  props: Record<string, unknown>;
  children: Drawn[];
}

initRuntime({
  react: {
    createElement: (type: string, props: Record<string, unknown>, ...children: Drawn[]): Drawn => ({ type, props, children }),
  },
  ui: { tokens: { surface1: "token:surface1" } },
} as never);

const fills = (icon: unknown) => (icon as Drawn).children.map((c) => c.props.fill).filter((f) => f !== undefined && f !== "currentColor");

assert.deepEqual(fills(collectionIcon()), ["token:surface1"]);
assert.deepEqual(fills(smartIcon()), ["token:surface1"]);

console.log("OK — icons.test.ts");
