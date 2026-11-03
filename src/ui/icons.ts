// Inline SVG factories (no asset pipeline in a runtime-loaded bundle). All
// strokes/fills use currentColor so rows can tint them via CSS colour.

import { React } from "../runtime.ts";
import type { ReactElement } from "react";

function svg(size: number, children: ReactElement[], viewBox = "0 0 12 12"): ReactElement {
  return React.createElement(
    "svg",
    { width: size, height: size, viewBox, fill: "none", "aria-hidden": true },
    ...children,
  );
}

/** A stack of photos: the regular-collection glyph. */
export function collectionIcon(size = 12): ReactElement {
  return svg(size, [
    React.createElement("rect", {
      key: "back", x: 3, y: 1.5, width: 7.5, height: 6, rx: 1,
      stroke: "currentColor", strokeWidth: 1, opacity: 0.55,
    }),
    React.createElement("rect", {
      key: "front", x: 1.5, y: 4, width: 7.5, height: 6, rx: 1,
      stroke: "currentColor", strokeWidth: 1, fill: "var(--color-surface-1)",
    }),
  ]);
}

/** The photo stack with a spark: the smart-collection glyph. */
export function smartIcon(size = 12): ReactElement {
  return svg(size, [
    React.createElement("rect", {
      key: "back", x: 3, y: 1.5, width: 7.5, height: 6, rx: 1,
      stroke: "currentColor", strokeWidth: 1, opacity: 0.55,
    }),
    React.createElement("rect", {
      key: "front", x: 1.5, y: 4, width: 7.5, height: 6, rx: 1,
      stroke: "currentColor", strokeWidth: 1, fill: "var(--color-surface-1)",
    }),
    React.createElement("path", {
      key: "spark",
      d: "M5.25 5.1 L5.85 6.4 L7.15 7 L5.85 7.6 L5.25 8.9 L4.65 7.6 L3.35 7 L4.65 6.4 Z",
      fill: "currentColor",
    }),
  ]);
}

export function plusIcon(size = 12): ReactElement {
  return svg(size, [
    React.createElement("path", {
      key: "p", d: "M6 2.5 V9.5 M2.5 6 H9.5",
      stroke: "currentColor", strokeWidth: 1.2, strokeLinecap: "round",
    }),
  ]);
}
