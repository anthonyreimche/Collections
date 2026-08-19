// Minimal vanilla-DOM toast for actions that run with no extension UI on
// screen (the B shortcut, grid-menu adds). Singleton pill, bottom-center,
// replaced on repeat calls; themed via the app's CSS variables.

let el: HTMLDivElement | null = null;
let hideTimer: ReturnType<typeof setTimeout> | undefined;

const SHOW_MS = 1600;

export function showToast(message: string): void {
  if (typeof document === "undefined") return;
  if (!el) {
    el = document.createElement("div");
    Object.assign(el.style, {
      position: "fixed",
      left: "50%",
      bottom: "48px",
      transform: "translateX(-50%)",
      zIndex: "950",
      padding: "6px 14px",
      borderRadius: "999px",
      border: "1px solid var(--color-border)",
      background: "var(--color-surface-1)",
      color: "var(--color-text-primary)",
      fontSize: "11px",
      boxShadow: "0 6px 20px rgba(0,0,0,0.35)",
      pointerEvents: "none",
      transition: "opacity 150ms ease",
    } satisfies Partial<CSSStyleDeclaration>);
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.style.opacity = "1";
  if (hideTimer !== undefined) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    if (el) el.style.opacity = "0";
  }, SHOW_MS);
}

/** Remove the pill on extension unload so a disable leaves no orphan node. */
export function disposeToast(): void {
  if (hideTimer !== undefined) clearTimeout(hideTimer);
  hideTimer = undefined;
  el?.remove();
  el = null;
}
