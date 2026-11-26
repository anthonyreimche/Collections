// Fixed-inset dialogue shell (the shape core dialogues use), rendered from the
// panel's subtree so it works docked, floating, or detached. Backdrop click
// and Escape (taken from core's Escape stack) close.

import type { ReactElement, ReactNode } from "react";
import { React, ui } from "../runtime.ts";

interface OverlayProps {
  title: string;
  width: number;
  onClose(): void;
  children?: ReactNode;
  footer?: ReactNode;
}

export function Overlay({ title, width, onClose, children, footer }: OverlayProps): ReactElement {
  const t = ui.tokens;

  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;
  React.useEffect(() => ui.onEscape(() => onCloseRef.current()), []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 900,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.5)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          width: `min(94vw, ${width}px)`,
          maxHeight: "80vh",
          padding: 14,
          borderRadius: 8,
          border: `1px solid ${t.border}`,
          background: t.surface1,
          boxShadow: "0 12px 48px rgba(0,0,0,0.5)",
          color: t.textPrimary,
          fontSize: 11,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
          {children}
        </div>
        {footer && <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>{footer}</div>}
      </div>
    </div>
  );
}
